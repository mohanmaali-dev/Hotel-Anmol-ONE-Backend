import mongoose from 'mongoose';

const stockCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameKey: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);

stockCategorySchema.pre('validate', function normalizeName() {
  this.name = this.name?.trim();
  this.nameKey = this.name?.toLocaleLowerCase('en-IN');
});

export const StockCategory = mongoose.model('StockCategory', stockCategorySchema);
