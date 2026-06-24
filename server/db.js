import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import Batch from './models/Batch.js';
import Item from './models/Item.js';
import User from './models/User.js';

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sira';
  
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoURI).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
    console.log('MongoDB Connected successfully.');
    // Check if seeding is needed
    await seedDefaultBatch();
    await seedDefaultUser();
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

async function seedDefaultBatch() {
  try {
    const batchCount = await Batch.countDocuments();
    if (batchCount > 0) {
      console.log('Database already has batches. Skipping seed.');
      return;
    }
    
    console.log('No batches found. Seeding default batch from DL-CSE Book list.xls...');
    
    const xlsPath = path.join(process.cwd(), 'DL-CSE Book list.xls');
    if (!fs.existsSync(xlsPath)) {
      console.warn(`Seed file not found at: ${xlsPath}. Skipping seed.`);
      return;
    }
    
    const content = fs.readFileSync(xlsPath, 'utf8');
    const lines = content.split(/\r?\n/);
    
    if (lines.length < 2) {
      console.warn('Seed file is empty or invalid. Skipping seed.');
      return;
    }
    
    // Parse TSV lines
    const itemsData = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cols = line.split('\t').map(col => col.replace(/^"|"$/g, '').trim());
      if (cols.length < 2) continue;
      
      const accessNo = cols[0];
      const title = cols[1];
      
      if (!accessNo || !title) continue;
      
      itemsData.push({
        accessNo,
        title,
        authorName: cols[2] || '',
        publisher: cols[3] || '',
        callNo: cols[4] || '',
        location: cols[5] || '',
        status: 'Not Found', // verification status defaults to Not Found
        document: cols[7] || '',
        price: cols[8] || '',
      });
    }
    
    if (itemsData.length === 0) {
      console.warn('Parsed 0 items from seed file. Skipping seed.');
      return;
    }
    
    // Create the default batch record
    const defaultBatch = new Batch({
      name: 'DL-CSE Book List',
      totalItems: itemsData.length,
      foundItems: 0,
      notFoundItems: itemsData.length,
      isDefault: true,
      createdAt: new Date()
    });
    
    const savedBatch = await defaultBatch.save();
    
    // Map items to the batch ID
    const itemsToSave = itemsData.map(item => ({
      ...item,
      batchId: savedBatch._id
    }));
    
    // Insert in chunks to avoid memory issues with MongoDB
    const chunkSize = 500;
    for (let i = 0; i < itemsToSave.length; i += chunkSize) {
      const chunk = itemsToSave.slice(i, i + chunkSize);
      await Item.insertMany(chunk);
    }
    
    console.log(`Successfully seeded default batch "${savedBatch.name}" with ${itemsToSave.length} books.`);
  } catch (error) {
    console.error('Error seeding default batch:', error);
  }
}

async function seedDefaultUser() {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('Database already has users. Skipping user seed.');
      return;
    }
    
    console.log('No users found. Seeding default admin user...');
    const defaultUser = new User({
      username: 'itadmin',
      password: 'itadminsakthi'
    });
    
    await defaultUser.save();
    console.log('Successfully seeded default admin user.');
  } catch (error) {
    console.error('Error seeding default user:', error);
  }
}
