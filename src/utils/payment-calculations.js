const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

export const calculatePayment = (finalAmountValue, paidAmountValue, paymentType) => {
  const finalAmount = Number(finalAmountValue);
  const paidAmount = Number(paidAmountValue ?? 0);

  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    throw createValidationError('Paid amount cannot be negative');
  }

  if (paidAmount > finalAmount) {
    throw createValidationError('Paid amount cannot exceed final amount');
  }

  if (paidAmount > 0 && !paymentType) {
    throw createValidationError('Payment type is required when paid amount is greater than 0');
  }

  let paymentStatus = 'Not Paid';
  if (paidAmount >= finalAmount && finalAmount > 0) paymentStatus = 'Paid';
  else if (paidAmount > 0) paymentStatus = 'Partial';

  return {
    paidAmount,
    dueAmount: finalAmount - paidAmount,
    paymentType: paymentType || null,
    paymentStatus,
  };
};
