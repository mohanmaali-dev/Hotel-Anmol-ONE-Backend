import { Sale } from '../models/sale.model.js';

const getSaleNo = (billNo) => billNo.replace(/^[^-]+-/, 'SALE-');

export const syncSaleFromBill = (bill, { session } = {}) =>
  Sale.findOneAndUpdate(
    { billId: bill._id },
    {
      $set: {
        billNo: bill.billNo,
        orderId: bill.orderId,
        orderNo: bill.orderNo,
        date: bill.date,
        customerName: bill.customerName,
        orderType: bill.orderType,
        finalAmount: bill.finalAmount,
        paidAmount: bill.paidAmount,
        dueAmount: bill.dueAmount,
        paymentType: bill.paymentType,
        paymentStatus: bill.paymentStatus,
        biller: bill.biller,
      },
      $setOnInsert: {
        saleNo: getSaleNo(bill.billNo),
      },
    },
    {
      returnDocument: 'after',
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      session,
    },
  );
