import mongoose from 'mongoose';

const purchaseItemSchema = new mongoose.Schema(
  {
    stockItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockItem',
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
      min: 0.001,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    purchaseDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    supplierInvoiceNo: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    items: {
      type: [purchaseItemSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: 'A purchase must contain at least one item',
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
    },
    purchaseStatus: {
      type: String,
      enum: ['Draft', 'Ordered', 'Received', 'Cancelled'],
      default: 'Draft',
      index: true,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    orderedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    stockUpdatePending: {
      type: Boolean,
      default: false,
      index: true,
    },
    stockUpdated: {
      type: Boolean,
      default: false,
      index: true,
    },
    stockProcessing: {
      type: Boolean,
      default: false,
    },
    stockUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

purchaseSchema.pre('validate', function calculatePaymentFields() {
  this.dueAmount = Math.max(0, this.finalAmount - this.paidAmount);
  if (this.paidAmount <= 0) this.paymentStatus = 'Not Paid';
  else if (this.paidAmount < this.finalAmount) this.paymentStatus = 'Partial';
  else this.paymentStatus = 'Paid';
});

export const Purchase = mongoose.model('Purchase', purchaseSchema);
