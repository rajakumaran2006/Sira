import { NextResponse } from 'next/server';
import { connectDB } from '@/server/db.js';
import Item from '@/server/models/Item.js';
import Batch from '@/server/models/Batch.js';

export const dynamic = 'force-dynamic';

// PATCH /api/items/[itemId] - Toggle/update item verification status
export async function PATCH(request, { params }) {
  try {
    await connectDB();
    const { itemId } = await params;
    const { status } = await request.json(); // 'Found' or 'Not Found' or 'Not in CSV'

    const item = await Item.findById(itemId);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const batch = await Batch.findById(item.batchId);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const oldStatus = item.status;
    const isVerified = status === 'Found';

    if (oldStatus === 'Not in CSV') {
      const wasVerified = !!item.verifiedAt;
      if (isVerified && !wasVerified) {
        item.verifiedAt = new Date();
        batch.foundItems = (batch.foundItems || 0) + 1;
      } else if (!isVerified && wasVerified) {
        item.verifiedAt = null;
        batch.foundItems = Math.max(0, (batch.foundItems || 0) - 1);
      }
      // Ensure it stays "Not in CSV"
      item.status = 'Not in CSV';
      await item.save();
    } else {
      if (oldStatus === status) {
        return NextResponse.json({ success: true, item });
      }

      // Update item status and verifiedAt
      item.status = status;
      if (status === 'Found') {
        item.verifiedAt = new Date();
      } else {
        item.verifiedAt = null;
      }
      await item.save();

      // Adjust batch stats for normal CSV items
      if (oldStatus === 'Found' && status === 'Not Found') {
        batch.foundItems = Math.max(0, batch.foundItems - 1);
        batch.notFoundItems += 1;
      } else if (oldStatus === 'Not Found' && status === 'Found') {
        batch.foundItems += 1;
        batch.notFoundItems = Math.max(0, batch.notFoundItems - 1);
      }
    }

    await batch.save();
    return NextResponse.json({ success: true, item, batch });
  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

// DELETE /api/items/[itemId] - Delete a book/item permanently
export async function DELETE(request, { params }) {
  try {
    await connectDB();
    const { itemId } = await params;

    const item = await Item.findById(itemId);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const batch = await Batch.findById(item.batchId);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const status = item.status;

    // Delete item
    await Item.deleteOne({ _id: itemId });

    // Update batch stats
    if (status === 'Not in CSV') {
      batch.anomaliesCount = Math.max(0, (batch.anomaliesCount || 0) - 1);
      if (item.verifiedAt) {
        batch.foundItems = Math.max(0, batch.foundItems - 1);
      }
    } else {
      batch.totalItems = Math.max(0, batch.totalItems - 1);
      if (status === 'Found') {
        batch.foundItems = Math.max(0, batch.foundItems - 1);
      } else if (status === 'Not Found') {
        batch.notFoundItems = Math.max(0, batch.notFoundItems - 1);
      }
    }

    await batch.save();
    return NextResponse.json({ success: true, message: 'Item deleted successfully', batch });
  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
