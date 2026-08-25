import mongoose from 'mongoose';

const paymentHistorySchema = new mongoose.Schema(
  {
    recordType: { type: String, enum: ['Bill', 'Purchase'], required: true, index: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    previousPaidAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, min: 0 },
    previousPaymentType: { type: String, enum: ['Cash', 'UPI', 'Card', null], default: null },
    paymentType: { type: String, enum: ['Cash', 'UPI', 'Card', null], default: null },
    previousPaymentStatus: {
      type: String,
      enum: ['Paid', 'Partial', 'Not Paid'],
      required: true,
    },
    paymentStatus: { type: String, enum: ['Paid', 'Partial', 'Not Paid'], required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, trim: true, default: 'Payment updated' },
  },
  { timestamps: true, versionKey: false },
);

paymentHistorySchema.index({ recordType: 1, recordId: 1, createdAt: -1 });

export const PaymentHistory = mongoose.model('PaymentHistory', paymentHistorySchema);
