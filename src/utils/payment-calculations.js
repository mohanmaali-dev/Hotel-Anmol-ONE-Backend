import { roundMoney } from './money.js';

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

export const calculatePayment = (finalAmountValue, paidAmountValue, paymentType) => {
  const finalAmount = roundMoney(finalAmountValue);
  const paidAmount = roundMoney(paidAmountValue ?? 0);

  if (!Number.isFinite(finalAmount) || finalAmount < 0) {
    throw createValidationError('Final amount is invalid');
  }

  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    throw createValidationError('Paid amount cannot be negative');
  }

  if (paidAmount > finalAmount) {
    throw createValidationError('Paid amount cannot exceed final amount');
  }

  if (paidAmount > 0 && !paymentType) {
    throw createValidationError('Payment type is required when paid amount is greater than 0');
  }
  if (paymentType && !['Cash', 'UPI', 'Card'].includes(paymentType)) {
    throw createValidationError('Payment type must be Cash, UPI, or Card');
  }

  let paymentStatus = 'Not Paid';
  if (paidAmount >= finalAmount && finalAmount > 0) paymentStatus = 'Paid';
  else if (paidAmount > 0) paymentStatus = 'Partial';

  return {
    paidAmount,
    dueAmount: roundMoney(finalAmount - paidAmount),
    paymentType: paidAmount > 0 ? paymentType : null,
    paymentStatus,
  };
};
