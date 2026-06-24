import { NextResponse } from 'next/server';
import { connectDB } from '@/server/db.js';
import Item from '@/server/models/Item.js';
import Batch from '@/server/models/Batch.js';

export const dynamic = 'force-dynamic';

// POST /api/items/bulk-delete - Delete multiple items atomically
// Body: { ids: string[] }
export async function POST(request) {
  try {
    await connectDB();
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No item IDs provided' }, { status: 400 });
    }

    // Fetch all items to be deleted
    const items = await Item.find({ _id: { $in: ids } });

    if (items.length === 0) {
      return NextResponse.json({ error: 'No matching items found' }, { status: 404 });
    }

    // Group items by batchId and tally up stat changes
    const batchChanges = {};
    for (const item of items) {
      const batchId = item.batchId.toString();
      if (!batchChanges[batchId]) {
        batchChanges[batchId] = { total: 0, found: 0, notFound: 0, anomalies: 0 };
      }
      if (item.status === 'Not in CSV') {
        batchChanges[batchId].anomalies += 1;
        if (item.verifiedAt) batchChanges[batchId].found += 1;
      } else {
        batchChanges[batchId].total += 1;
        if (item.status === 'Found') batchChanges[batchId].found += 1;
        else if (item.status === 'Not Found') batchChanges[batchId].notFound += 1;
      }
    }

    // Delete all items in one shot
    await Item.deleteMany({ _id: { $in: ids } });

    // Update each affected batch atomically
    const batchUpdatePromises = Object.entries(batchChanges).map(
      async ([batchId, changes]) => {
        const batch = await Batch.findById(batchId);
        if (!batch) return;
        batch.totalItems = Math.max(0, batch.totalItems - changes.total);
        batch.foundItems = Math.max(0, batch.foundItems - changes.found);
        batch.notFoundItems = Math.max(0, batch.notFoundItems - changes.notFound);
        batch.anomaliesCount = Math.max(0, (batch.anomaliesCount || 0) - changes.anomalies);
        await batch.save();
      }
    );

    await Promise.all(batchUpdatePromises);

    return NextResponse.json({
      success: true,
      deleted: items.length,
      message: `${items.length} item${items.length !== 1 ? 's' : ''} deleted successfully`,
    });
  } catch (error) {
    console.error('Error bulk deleting items:', error);
    return NextResponse.json({ error: 'Failed to delete items' }, { status: 500 });
  }
}
