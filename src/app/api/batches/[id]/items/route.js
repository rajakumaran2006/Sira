import { NextResponse } from 'next/server';
import { connectDB } from '@/server/db.js';
import Item from '@/server/models/Item.js';

export const dynamic = 'force-dynamic';

// GET /api/batches/[id]/items - Get items of a batch
export async function GET(request, { params }) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    
    const query = { batchId: params.id };
    
    if (status && status !== 'All') {
      // If status is Anomalies, we query for 'Not in CSV'
      if (status === 'Anomalies') {
        query.status = 'Not in CSV';
      } else {
        query.status = status;
      }
    }
    
    if (search) {
      query.$or = [
        { accessNo: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }
    
    const items = await Item.find(query).sort({ verifiedAt: -1, accessNo: 1 });
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json({ error: 'Failed to fetch batch items' }, { status: 500 });
  }
}
