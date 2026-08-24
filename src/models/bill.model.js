import mongoose from 'mongoose';

import { orderItemSchema } from './order-item.model.js';

const billSchema = new mongoose.Schema(
  {
    billNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    orderNo: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    orderType: {
      type: String,
      enum: ['Dine In', 'Parcel', 'Room'],
      required: true,
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: 'A bill must contain at least one item',
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    additionalCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentType: {
      type: String,
      enum: ['Cash', 'UPI', 'Card', null],
      default: null,
      validate: {
        validator(value) {
          return this.paidAmount <= 0 || Boolean(value);
        },
        message: 'Payment type is required when paid amount is greater than 0',
      },
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator(value) {
          return value <= this.finalAmount;
        },
        message: 'Paid amount cannot exceed final amount',
      },
    },
    dueAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Partial', 'Not Paid'],
      default: 'Not Paid',
      index: true,
    },
    biller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

billSchema.pre('validate', function calculatePaymentFields() {
  this.dueAmount = Math.max(0, this.finalAmount - this.paidAmount);
  if (this.paidAmount <= 0) this.paymentStatus = 'Not Paid';
  else if (this.paidAmount < this.finalAmount) this.paymentStatus = 'Partial';
  else this.paymentStatus = 'Paid';
});

export const Bill = mongoose.model('Bill', billSchema);
