import { NextResponse } from 'next/server';
import { connectDB } from '@/server/db.js';
import Batch from '@/server/models/Batch.js';
import Item from '@/server/models/Item.js';

export const dynamic = 'force-dynamic';

// POST /api/batches/[id]/scan - Verify scanned item in a batch
export async function POST(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const { accessNo } = await request.json();
    const batchId = id;
    
    if (!accessNo) {
      return NextResponse.json({ error: 'Access No (barcode) is required' }, { status: 400 });
    }
    
    const cleanAccessNo = String(accessNo).trim();
    
    // 1. Fetch batch
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }
    
    // 2. Search for item in current batch
    let item = await Item.findOne({ batchId, accessNo: cleanAccessNo });
    
    if (item) {
      // Scanned item was found in the database list
      if (item.status === 'Found') {
        // Already verified
        return NextResponse.json({ 
          success: true, 
          alreadyVerified: true, 
          message: `Item ${cleanAccessNo} is already verified.`, 
          item 
        });
      }
      
      // Update item status to Found
      item.status = 'Found';
      item.verifiedAt = new Date();
      await item.save();
      
      // Update batch counters
      batch.foundItems += 1;
      // Handle when migrating status
      if (batch.notFoundItems > 0) {
        batch.notFoundItems -= 1;
      }
      await batch.save();
      
      return NextResponse.json({ 
        success: true, 
        alreadyVerified: false, 
        message: `Verified: ${item.title}`, 
        item 
      });
    } else {
      // ANOMALY: Access No not in Excel file
      // Automatically add it as "Not in CSV" so user has a record
      const anomalyItem = new Item({
        batchId,
        accessNo: cleanAccessNo,
        title: `Unknown Scanned Asset [${cleanAccessNo}]`,
        status: 'Not in CSV',
        verifiedAt: new Date(),
        authorName: 'N/A',
        location: 'Scanned Anomaly'
      });
      
      const savedAnomaly = await anomalyItem.save();
      
      // Increment batch found items and anomalies count
      batch.foundItems = (batch.foundItems || 0) + 1;
      batch.anomaliesCount = (batch.anomaliesCount || 0) + 1;
      await batch.save();
      
      return NextResponse.json({ 
        success: false, 
        anomaly: true,
        message: `Item [${cleanAccessNo}] not found in batch. Added as anomaly.`, 
        item: savedAnomaly 
      });
    }
  } catch (error) {
    console.error('Error verifying scan:', error);
    return NextResponse.json({ error: 'Failed to verify scanned item' }, { status: 500 });
  }
}
