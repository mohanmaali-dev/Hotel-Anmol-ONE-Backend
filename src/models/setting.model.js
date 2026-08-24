import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'restaurant-settings',
      unique: true,
      immutable: true,
    },
    restaurant: {
      name: { type: String, trim: true, default: 'Restaurant' },
      phone: {
        type: String,
        trim: true,
        default: '',
        validate: {
          validator: (value) => !value || /^\d{7,15}$/.test(value),
          message: 'Phone must contain 7 to 15 digits',
        },
      },
      email: { type: String, trim: true, lowercase: true, default: '' },
      address: { type: String, trim: true, default: '' },
      gstTaxNumber: { type: String, trim: true, default: '' },
      currency: {
        type: String,
        enum: ['INR', 'USD', 'EUR', 'GBP'],
        default: 'INR',
      },
      logoName: { type: String, trim: true, default: '' },
    },
    billing: {
      billPrefix: { type: String, trim: true, default: 'BILL' },
      taxPercentage: { type: Number, min: 0, max: 100, default: 0 },
      defaultAdditionalCharge: { type: Number, min: 0, default: 0 },
      allowDiscount: { type: Boolean, default: true },
      footerMessage: {
        type: String,
        trim: true,
        default: 'Thank you for dining with us!',
      },
    },
    order: {
      defaultOrderType: {
        type: String,
        enum: ['Dine In', 'Parcel', 'Room'],
        default: 'Dine In',
      },
      autoGenerateOrderNumber: { type: Boolean, default: true },
      autoGenerateBillNumber: { type: Boolean, default: true },
    },
    stock: {
      lowStockAlertEnabled: { type: Boolean, default: true },
      defaultMinimumStock: { type: Number, min: 0, default: 5 },
    },
  },
  { timestamps: true },
);

export const Setting = mongoose.model('Setting', settingSchema);
