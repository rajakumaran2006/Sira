import { NextResponse } from 'next/server';
import { connectDB } from '@/server/db.js';
import Batch from '@/server/models/Batch.js';
import Item from '@/server/models/Item.js';
import * as xlsx from 'xlsx';

export const dynamic = 'force-dynamic';

// 1. GET /api/batches - Get all batches
export async function GET() {
  try {
    await connectDB();
    const batches = await Batch.find().sort({ createdAt: -1 });
    return NextResponse.json(batches);
  } catch (error) {
    console.error('Error fetching batches:', error);
    return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 });
  }
}

// 2. POST /api/batches - Create batch via CSV/XLSX upload
export async function POST(request) {
  try {
    await connectDB();
    
    const formData = await request.formData();
    const batchName = formData.get('batchName');
    const file = formData.get('file');

    if (!batchName) {
      return NextResponse.json({ error: 'Batch Name is required' }, { status: 400 });
    }

    // Check if batch name already exists (case-insensitive)
    const escapedBatchName = batchName.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const existingBatch = await Batch.findOne({ 
      name: { $regex: new RegExp(`^${escapedBatchName}$`, 'i') } 
    });
    if (existingBatch) {
      return NextResponse.json({ error: 'A batch with this name already exists' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'Inventory file is required' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const bufferString = fileBuffer.toString('utf8');
    
    let jsonData = [];

    // Check if the uploaded file is a TSV (can read as text if named .xls but is text)
    if (fileName.endsWith('.tsv') || (bufferString.includes('\t') && !bufferString.startsWith('PK'))) {
      // Parse TSV manually
      const lines = bufferString.split(/\r?\n/);
      if (lines.length > 0) {
        jsonData = lines.map(line => 
          line.split('\t').map(col => col.replace(/^"|"$/g, '').trim())
        ).filter(row => row.length > 0 && row.some(cell => cell !== ''));
      }
    } else {
      // Use SheetJS for Excel / CSV
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    }

    if (jsonData.length < 2) {
      return NextResponse.json({ error: 'The uploaded file is empty or has no header row.' }, { status: 400 });
    }

    // Column header mapping
    const headers = jsonData[0] || [];
    let accessNoIdx = 0;
    let titleIdx = 1;
    let authorIdx = -1;
    let publisherIdx = -1;
    let callNoIdx = -1;
    let locationIdx = -1;
    let documentIdx = -1;
    let priceIdx = -1;

    headers.forEach((header, idx) => {
      const h = String(header).toLowerCase().replace(/[\s_-]/g, '');
      if (h.includes('accessno') || h.includes('barcode') || h.includes('id') || h === 'accno' || h === 'access') {
        accessNoIdx = idx;
      } else if (h.includes('title') || h.includes('itemname') || h === 'name' || h === 'booktitle') {
        titleIdx = idx;
      } else if (h.includes('author')) {
        authorIdx = idx;
      } else if (h.includes('publisher')) {
        publisherIdx = idx;
      } else if (h.includes('callno') || h.includes('callnumber')) {
        callNoIdx = idx;
      } else if (h.includes('location')) {
        locationIdx = idx;
      } else if (h.includes('document') || h.includes('type')) {
        documentIdx = idx;
      } else if (h.includes('price') || h.includes('cost')) {
        priceIdx = idx;
      }
    });

    const itemsData = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length === 0) continue;

      const accessNo = String(row[accessNoIdx] || '').trim();
      const title = String(row[titleIdx] || '').trim();

      if (!accessNo || !title) continue;

      itemsData.push({
        accessNo,
        title,
        authorName: authorIdx !== -1 && row[authorIdx] ? String(row[authorIdx]).trim() : '',
        publisher: publisherIdx !== -1 && row[publisherIdx] ? String(row[publisherIdx]).trim() : '',
        callNo: callNoIdx !== -1 && row[callNoIdx] ? String(row[callNoIdx]).trim() : '',
        location: locationIdx !== -1 && row[locationIdx] ? String(row[locationIdx]).trim() : '',
        status: 'Not Found',
        document: documentIdx !== -1 && row[documentIdx] ? String(row[documentIdx]).trim() : 'BOOK',
        price: priceIdx !== -1 && row[priceIdx] ? String(row[priceIdx]).trim() : '0.00',
      });
    }

    if (itemsData.length === 0) {
      return NextResponse.json({ error: 'Could not parse any valid items (must have Access No and Title).' }, { status: 400 });
    }

    // Create new Batch record
    const newBatch = new Batch({
      name: batchName,
      totalItems: itemsData.length,
      foundItems: 0,
      notFoundItems: itemsData.length,
      createdAt: new Date()
    });

    const savedBatch = await newBatch.save();

    // Save items mapping to Batch ID
    const itemsToSave = itemsData.map(item => ({
      ...item,
      batchId: savedBatch._id
    }));

    const chunkSize = 500;
    for (let i = 0; i < itemsToSave.length; i += chunkSize) {
      const chunk = itemsToSave.slice(i, i + chunkSize);
      await Item.insertMany(chunk);
    }

    return NextResponse.json(savedBatch, { status: 201 });
  } catch (error) {
    console.error('Error creating batch:', error);
    return NextResponse.json({ error: 'Failed to create and parse batch' }, { status: 500 });
  }
}
