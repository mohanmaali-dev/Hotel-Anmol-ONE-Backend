import mongoose from 'mongoose';

const menuCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    nameKey: { type: String, unique: true, sparse: true, select: false },
    description: {
      type: String,
      trim: true,
      default: '',
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

menuCategorySchema.pre('validate', function setNameKey() {
  this.nameKey = this.name?.trim().toLocaleLowerCase('en-IN');
});

export const MenuCategory = mongoose.model('MenuCategory', menuCategorySchema);
