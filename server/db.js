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
    
    console.log('No batches found. Seeding default batch...');
    
    let itemsData = [];
    const xlsPath = path.join(process.cwd(), 'DL-CSE Book list.xls');
    
    if (!fs.existsSync(xlsPath)) {
      console.warn(`Seed file not found at: ${xlsPath}. Generating mock inventory data fallback.`);
      const mockBooks = [
        { title: "Introduction to Algorithms", authorName: "Thomas H. Cormen", callNo: "QA76.6 .I58 2009", location: "Main Library - Stack 3", document: "BOOK", price: "89.99" },
        { title: "Computer Networking: A Top-Down Approach", authorName: "James Kurose", callNo: "TK5105.5 .K87 2016", location: "Main Library - Stack 4", document: "BOOK", price: "120.00" },
        { title: "Clean Code: A Handbook of Agile Software Craftsmanship", authorName: "Robert C. Martin", callNo: "QA76.76.D47 M37 2008", location: "CS Dept Library - Shelf A", document: "BOOK", price: "45.50" },
        { title: "Design Patterns: Elements of Reusable Object-Oriented Software", authorName: "Erich Gamma", callNo: "QA76.64 .D47 1994", location: "CS Dept Library - Shelf A", document: "BOOK", price: "55.00" },
        { title: "Database System Concepts", authorName: "Abraham Silberschatz", callNo: "QA76.9.D3 S56 2019", location: "Main Library - Stack 3", document: "BOOK", price: "140.00" },
        { title: "Artificial Intelligence: A Modern Approach", authorName: "Stuart Russell", callNo: "Q335 .R87 2020", location: "Main Library - Stack 5", document: "BOOK", price: "150.00" },
        { title: "Compilers: Principles, Techniques, and Tools", authorName: "Alfred V. Aho", callNo: "QA76.76.T83 C65 2006", location: "Main Library - Stack 3", document: "BOOK", price: "115.00" },
        { title: "Operating System Concepts", authorName: "Abraham Silberschatz", callNo: "QA76.76.O63 S55 2018", location: "Main Library - Stack 4", document: "BOOK", price: "135.00" },
        { title: "The Pragmatic Programmer", authorName: "Andrew Hunt", callNo: "QA76.6 .H85 1999", location: "CS Dept Library - Shelf B", document: "BOOK", price: "48.00" },
        { title: "Refactoring: Improving the Design of Existing Code", authorName: "Martin Fowler", callNo: "QA76.76.R42 F69 2018", location: "CS Dept Library - Shelf A", document: "BOOK", price: "50.00" },
        { title: "Computer Architecture: A Quantitative Approach", authorName: "John L. Hennessy", callNo: "QA76.9.C66 H45 2017", location: "Main Library - Stack 4", document: "BOOK", price: "95.00" },
        { title: "Modern Operating Systems", authorName: "Andrew S. Tanenbaum", callNo: "QA76.76.O63 T36 2015", location: "Main Library - Stack 4", document: "BOOK", price: "125.00" },
        { title: "Introduction to the Theory of Computation", authorName: "Michael Sipser", callNo: "QA267 .S56 2012", location: "Main Library - Stack 3", document: "BOOK", price: "85.00" },
        { title: "JavaScript: The Definitive Guide", authorName: "David Flanagan", callNo: "QA76.73.J39 F53 2020", location: "CS Dept Library - Shelf B", document: "BOOK", price: "42.00" },
        { title: "Structure and Interpretation of Computer Programs", authorName: "Harold Abelson", callNo: "QA76.6 .A2 1996", location: "CS Dept Library - Shelf C", document: "BOOK", price: "65.00" }
      ];
      
      mockBooks.forEach((book, idx) => {
        const accessNo = `CSE${String(idx + 1).padStart(3, '0')}`;
        itemsData.push({
          accessNo,
          title: book.title,
          authorName: book.authorName,
          publisher: "Pearson Education",
          callNo: book.callNo,
          location: book.location,
          status: 'Not Found',
          document: book.document,
          price: book.price
        });
      });
    } else {
      const content = fs.readFileSync(xlsPath, 'utf8');
      const lines = content.split(/\r?\n/);
      
      if (lines.length < 2) {
        console.warn('Seed file is empty or invalid. Skipping seed.');
        return;
      }
      
      // Parse TSV lines
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
    const existingUser = await User.findOne({ username: { $regex: /^itadmin$/i } });
    if (existingUser) {
      if (
        existingUser.username !== 'ITADMIN' ||
        existingUser.password !== 'ITADMINSAKTHI' ||
        existingUser.avatarUrl !== '/sakthivel.webp'
      ) {
        existingUser.username = 'ITADMIN';
        existingUser.password = 'ITADMINSAKTHI';
        existingUser.avatarUrl = '/sakthivel.webp';
        await existingUser.save();
        console.log('Updated existing default admin user to uppercase credentials and avatarUrl.');
      } else {
        console.log('Database already has default user with correct uppercase credentials and avatarUrl.');
      }
      return;
    }
    
    console.log('No users found or ITADMIN not found. Seeding default admin user...');
    const defaultUser = new User({
      username: 'ITADMIN',
      password: 'ITADMINSAKTHI',
      avatarUrl: '/sakthivel.webp'
    });
    
    await defaultUser.save();
    console.log('Successfully seeded default admin user with uppercase credentials.');
  } catch (error) {
    console.error('Error seeding default user:', error);
  }
}

