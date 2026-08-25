import mongoose from 'mongoose';

const orderIngredientSchema = new mongoose.Schema(
  {
    stockItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockItem', required: true },
    stockItemName: { type: String, required: true, trim: true },
    quantityUsed: { type: Number, required: true, min: 0.001 },
    unit: { type: String, required: true, trim: true },
    stockQuantityUsed: { type: Number, min: 0.000001, default: function defaultStockQuantityUsed() { return this.quantityUsed; } },
    stockUnit: { type: String, trim: true, default: function defaultStockUnit() { return this.unit; } },
    conversionFactor: { type: Number, required: true, min: 0.000001, default: 1 },
  },
  { _id: false },
);

const orderItemSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    servingSize: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    recipeCaptured: {
      type: Boolean,
      default: false,
    },
    trackStock: {
      type: Boolean,
      default: false,
    },
    ingredients: {
      type: [orderIngredientSchema],
      default: [],
    },
  },
  { timestamps: false, versionKey: false },
);

export { orderItemSchema };
export const OrderItem = mongoose.model('OrderItem', orderItemSchema);
