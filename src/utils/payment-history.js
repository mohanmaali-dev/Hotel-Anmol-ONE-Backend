import { PaymentHistory } from '../models/payment-history.model.js';

export const recordPaymentChange = async ({
  recordType,
  recordId,
  previous,
  current,
  changedBy,
  reason,
  session,
}) => {
  const unchanged =
    Number(previous.paidAmount) === Number(current.paidAmount) &&
    previous.paymentType === current.paymentType &&
    previous.paymentStatus === current.paymentStatus;
  if (unchanged) return null;

  const [history] = await PaymentHistory.create(
    [
      {
        recordType,
        recordId,
        previousPaidAmount: previous.paidAmount,
        paidAmount: current.paidAmount,
        previousPaymentType: previous.paymentType || null,
        paymentType: current.paymentType || null,
        previousPaymentStatus: previous.paymentStatus,
        paymentStatus: current.paymentStatus,
        changedBy,
        reason: String(reason || '').trim() || 'Payment updated',
      },
    ],
    { session },
  );
  return history;
};

export const getPaymentHistory = (recordType, recordId) =>
  PaymentHistory.find({ recordType, recordId })
    .populate('changedBy', 'name username')
    .sort({ createdAt: -1 })
    .lean();
