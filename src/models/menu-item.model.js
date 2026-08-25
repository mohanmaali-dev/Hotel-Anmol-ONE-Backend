import mongoose from 'mongoose';

const ingredientSchema = new mongoose.Schema(
  {
    stockItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockItem',
      required: true,
    },
    stockItemName: {
      type: String,
      required: true,
      trim: true,
    },
    quantityUsed: {
      type: Number,
      required: true,
      min: 0.001,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    stockQuantityUsed: {
      type: Number,
      min: 0.000001,
      default: function defaultStockQuantityUsed() {
        return this.quantityUsed;
      },
    },
    stockUnit: {
      type: String,
      trim: true,
      default: function defaultStockUnit() {
        return this.unit;
      },
    },
    conversionFactor: { type: Number, required: true, min: 0.000001, default: 1 },
  },
  { _id: false },
);

const menuItemSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    itemNameKey: { type: String, unique: true, sparse: true, select: false },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuCategory',
      required: true,
      index: true,
    },
    sellingPrice: {
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
    description: {
      type: String,
      trim: true,
      default: '',
    },
    availability: {
      type: String,
      enum: ['Available', 'Unavailable'],
      default: 'Available',
      index: true,
    },
    trackStock: {
      type: Boolean,
      default: false,
    },
    ingredients: {
      type: [ingredientSchema],
      default: [],
      validate: [
        {
          validator(ingredients) {
            return !this.trackStock || ingredients.length > 0;
          },
          message: 'At least one ingredient is required when stock tracking is enabled',
        },
        {
          validator(ingredients) {
            const stockItemIds = ingredients.map((ingredient) => String(ingredient.stockItemId));
            return new Set(stockItemIds).size === stockItemIds.length;
          },
          message: 'Duplicate stock items are not allowed in a recipe',
        },
      ],
    },
  },
  { timestamps: true, versionKey: false },
);

menuItemSchema.pre('validate', function setItemNameKey() {
  this.itemNameKey = this.itemName?.trim().toLocaleLowerCase('en-IN');
});

export const MenuItem = mongoose.model('MenuItem', menuItemSchema);
