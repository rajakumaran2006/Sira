import { NextResponse } from 'next/server';
import { connectDB } from '@/server/db.js';
import Batch from '@/server/models/Batch.js';
import Item from '@/server/models/Item.js';

export const dynamic = 'force-dynamic';

// GET /api/batches/[id] - Get specific batch stats
export async function GET(request, { params }) {
  try {
    await connectDB();
    const batch = await Batch.findById(params.id);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }
    return NextResponse.json(batch);
  } catch (error) {
    console.error('Error fetching batch:', error);
    return NextResponse.json({ error: 'Failed to fetch batch' }, { status: 500 });
  }
}

// DELETE /api/batches/[id] - Delete specific batch and its items
export async function DELETE(request, { params }) {
  try {
    await connectDB();
    const batch = await Batch.findById(params.id);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Delete all items in the batch
    await Item.deleteMany({ batchId: batch._id });
    // Delete batch itself
    await Batch.findByIdAndDelete(batch._id);

    return NextResponse.json({ message: 'Batch and items deleted successfully' });
  } catch (error) {
    console.error('Error deleting batch:', error);
    return NextResponse.json({ error: 'Failed to delete batch' }, { status: 500 });
  }
}
