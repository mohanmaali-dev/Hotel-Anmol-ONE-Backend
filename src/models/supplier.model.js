import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    contactPerson: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^\d{7,15}$/, 'Phone must contain 7 to 15 digits'],
    },
    alternatePhone: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: (value) => !value || /^\d{7,15}$/.test(value),
        message: 'Alternate phone must contain 7 to 15 digits',
      },
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      default: undefined,
      set: (value) => value?.trim().toLowerCase() || undefined,
      validate: {
        validator: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: 'Email must be valid',
      },
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    gstTaxNumber: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
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

export const Supplier = mongoose.model('Supplier', supplierSchema);
