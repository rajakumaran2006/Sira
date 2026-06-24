import mongoose from 'mongoose';

const ItemSchema = new mongoose.Schema({
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true,
    index: true,
  },
  accessNo: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  authorName: {
    type: String,
    default: '',
    trim: true,
  },
  publisher: {
    type: String,
    default: '',
    trim: true,
  },
  callNo: {
    type: String,
    default: '',
    trim: true,
  },
  location: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['Found', 'Not Found', 'Not in CSV'],
    default: 'Not Found',
  },
  document: {
    type: String,
    default: '',
    trim: true,
  },
  price: {
    type: String,
    default: '',
    trim: true,
  },
  verifiedAt: {
    type: Date,
  },
});

const Item = mongoose.models.Item || mongoose.model('Item', ItemSchema);
export default Item;
