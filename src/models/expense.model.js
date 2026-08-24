import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    expenseNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    category: {
      type: String,
      enum: [
        'Rent',
        'Electricity',
        'Gas',
        'Salary',
        'Maintenance',
        'Transport',
        'Wastage',
        'Other',
      ],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => Number.isFinite(value) && value > 0,
        message: 'Amount must be greater than 0',
      },
    },
    paymentType: {
      type: String,
      enum: ['Cash', 'UPI', 'Card'],
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    reference: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

export const Expense = mongoose.model('Expense', expenseSchema);
