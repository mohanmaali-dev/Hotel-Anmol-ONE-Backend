import mongoose from 'mongoose';

const saleSchema = new mongoose.Schema(
  {
    saleNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill',
      required: true,
      unique: true,
      index: true,
    },
    billNo: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
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
      required: true,
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
    finalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    dueAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentType: {
      type: String,
      enum: ['Cash', 'UPI', 'Card', null],
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Partial', 'Not Paid'],
      required: true,
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

export const Sale = mongoose.model('Sale', saleSchema);
