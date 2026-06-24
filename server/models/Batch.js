import mongoose from 'mongoose';

const BatchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  totalItems: {
    type: Number,
    default: 0,
  },
  foundItems: {
    type: Number,
    default: 0,
  },
  notFoundItems: {
    type: Number,
    default: 0,
  },
  isDefault: {
    type: Boolean,
    default: false,
  }
});

const Batch = mongoose.models.Batch || mongoose.model('Batch', BatchSchema);
export default Batch;
