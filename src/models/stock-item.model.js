import mongoose from 'mongoose';

const stockItemSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    currentQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    purchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    minimumStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['In Stock', 'Low Stock', 'Out of Stock'],
      default: 'Out of Stock',
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);

stockItemSchema.pre('validate', function calculateStockStatus() {
  if (this.currentQuantity <= 0) this.status = 'Out of Stock';
  else if (this.currentQuantity <= this.minimumStock) this.status = 'Low Stock';
  else this.status = 'In Stock';
});

stockItemSchema.virtual('stockValue').get(function getStockValue() {
  return this.currentQuantity * this.purchasePrice;
});

stockItemSchema.set('toJSON', { virtuals: true });
stockItemSchema.set('toObject', { virtuals: true });

export const StockItem = mongoose.model('StockItem', stockItemSchema);
