import { NextResponse } from 'next/server';
import { connectDB } from '@/server/db.js';
import Batch from '@/server/models/Batch.js';
import Item from '@/server/models/Item.js';

export const dynamic = 'force-dynamic';

// GET /api/batches/[id]/export - Export batch data as CSV
export async function GET(request, { params }) {
  try {
    await connectDB();
    const batch = await Batch.findById(params.id);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }
    
    const items = await Item.find({ batchId: batch._id }).sort({ accessNo: 1 });
    
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
    const sanitizedBatchName = batch.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="sira_export_${sanitizedBatchName}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting batch:', error);
    return NextResponse.json({ error: 'Failed to export batch' }, { status: 500 });
  }
}
