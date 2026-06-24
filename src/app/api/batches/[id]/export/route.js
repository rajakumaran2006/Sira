import { NextResponse } from 'next/server';
import { connectDB } from '@/server/db.js';
import Batch from '@/server/models/Batch.js';
import Item from '@/server/models/Item.js';

export const dynamic = 'force-dynamic';

// GET /api/batches/[id]/export - Export batch data as CSV
export async function GET(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const batch = await Batch.findById(id);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }
    
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'All';
    
    const query = { batchId: batch._id };
    if (statusFilter === 'Found') {
      query.status = 'Found';
    } else if (statusFilter === 'Not Found') {
      query.status = 'Not Found';
    } else if (statusFilter === 'Anomalies' || statusFilter === 'Not in CSV') {
      query.status = 'Not in CSV';
    }
    
    const items = await Item.find(query).sort({ accessNo: 1 });
    
    // Construct CSV file
    const headers = ['Access No', 'Title', 'Author Name', 'Publisher', 'Call No', 'Location', 'Status', 'Document', 'Price', 'Verified At'];
    
    const csvRows = [headers.join(',')];
    
    for (const item of items) {
      const row = [
        `"${item.accessNo.replace(/"/g, '""')}"`,
        `"${item.title.replace(/"/g, '""')}"`,
        `"${(item.authorName || '').replace(/"/g, '""')}"`,
        `"${(item.publisher || '').replace(/"/g, '""')}"`,
        `"${(item.callNo || '').replace(/"/g, '""')}"`,
        `"${(item.location || '').replace(/"/g, '""')}"`,
        `"${item.status}"`,
        `"${(item.document || '').replace(/"/g, '""')}"`,
        `"${(item.price || '').replace(/"/g, '""')}"`,
        `"${item.verifiedAt ? item.verifiedAt.toISOString() : ''}"`
      ];
      csvRows.push(row.join(','));
    }
    
    const csvContent = csvRows.join('\n');
    const sanitizedBatchName = batch.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    
    let suffix = 'all';
    if (statusFilter === 'Found') {
      suffix = 'found';
    } else if (statusFilter === 'Not Found') {
      suffix = 'not_found';
    } else if (statusFilter === 'Anomalies' || statusFilter === 'Not in CSV') {
      suffix = 'not_in_csv';
    }
    
    const filename = `${sanitizedBatchName}_${suffix}.csv`;
    
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting batch:', error);
    return NextResponse.json({ error: 'Failed to export batch' }, { status: 500 });
  }
}
