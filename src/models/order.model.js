import mongoose from 'mongoose';

import { orderItemSchema } from './order-item.model.js';

const orderSchema = new mongoose.Schema(
  {
    orderNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    orderType: {
      type: String,
      enum: ['Dine In', 'Parcel', 'Room'],
      required: true,
    },
    areaType: {
      type: String,
      trim: true,
      default: '',
    },
    areaRoomNo: {
      type: String,
      required: true,
      trim: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    biller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: 'An order must contain at least one item',
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
      enum: ['Cash', 'UPI', 'Card'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Partial', 'Not Paid'],
      default: 'Not Paid',
    },
    orderStatus: {
      type: String,
      enum: ['Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled'],
      default: 'Pending',
      index: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    stockDeducted: {
      type: Boolean,
      default: false,
      index: true,
    },
    stockProcessing: {
      type: Boolean,
      default: false,
    },
    stockDeductedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

export const Order = mongoose.model('Order', orderSchema);
