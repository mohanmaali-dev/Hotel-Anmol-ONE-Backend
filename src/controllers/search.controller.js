import { User } from '../modules/users/user.model.js';
import { Bill } from '../models/bill.model.js';
import { Expense } from '../models/expense.model.js';
import { MenuItem } from '../models/menu-item.model.js';
import { Order } from '../models/order.model.js';
import { Purchase } from '../models/purchase.model.js';
import { Sale } from '../models/sale.model.js';
import { StockItem } from '../models/stock-item.model.js';
import { Supplier } from '../models/supplier.model.js';
import { sendSuccess } from '../utils/api-response.js';
import { hasPermission } from '../utils/permissions.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const search = async (request, response) => {
  const query = String(request.query.q || '').trim();
  if (query.length < 2) return sendSuccess(response, { data: [] });
  const pattern = new RegExp(escapeRegex(query), 'i');
  const sources = [
    [
      'Orders',
      'orders',
      () =>
        Order.find({
          $or: [{ orderNo: pattern }, { customerName: pattern }, { areaRoomNo: pattern }],
        })
          .select('orderNo customerName orderType')
          .limit(4)
          .lean(),
      (row) => ({
        id: row._id,
        title: row.orderNo,
        detail: `${row.customerName} · ${row.orderType}`,
      }),
    ],
    [
      'Bills',
      'billing',
      () =>
        Bill.find({ $or: [{ billNo: pattern }, { orderNo: pattern }, { customerName: pattern }] })
          .select('billNo orderNo customerName')
          .limit(4)
          .lean(),
      (row) => ({
        id: row._id,
        title: row.billNo,
        detail: `Order ${row.orderNo} · ${row.customerName}`,
      }),
    ],
    [
      'Sales',
      'sales',
      () =>
        Sale.find({
          $or: [
            { saleNo: pattern },
            { billNo: pattern },
            { orderNo: pattern },
            { customerName: pattern },
          ],
        })
          .select('saleNo billNo customerName')
          .limit(4)
          .lean(),
      (row) => ({
        id: row._id,
        title: row.saleNo,
        detail: `Bill ${row.billNo} · ${row.customerName}`,
      }),
    ],
    [
      'Purchases',
      'purchases',
      () =>
        Purchase.find({
          $or: [{ purchaseNo: pattern }, { supplierName: pattern }, { supplierInvoiceNo: pattern }],
        })
          .select('purchaseNo supplierName')
          .limit(4)
          .lean(),
      (row) => ({ id: row._id, title: row.purchaseNo, detail: row.supplierName }),
    ],
    [
      'Stock',
      'stock',
      () =>
        StockItem.find({ itemName: pattern })
          .select('itemName currentQuantity unit')
          .limit(4)
          .lean(),
      (row) => ({
        id: row._id,
        title: row.itemName,
        detail: `${row.currentQuantity} ${row.unit} available`,
      }),
    ],
    [
      'Menu',
      'menu',
      () =>
        MenuItem.find({ itemName: pattern })
          .populate('categoryId', 'name')
          .select('itemName categoryId')
          .limit(4)
          .lean(),
      (row) => ({ id: row._id, title: row.itemName, detail: row.categoryId?.name || 'Menu item' }),
    ],
    [
      'Suppliers',
      'suppliers',
      () =>
        Supplier.find({
          $or: [
            { name: pattern },
            { contactPerson: pattern },
            { phone: pattern },
            { email: pattern },
          ],
        })
          .select('name phone contactPerson')
          .limit(4)
          .lean(),
      (row) => ({ id: row._id, title: row.name, detail: row.phone || row.contactPerson }),
    ],
    [
      'Expenses',
      'expenses',
      () =>
        Expense.find({
          $or: [{ expenseNo: pattern }, { description: pattern }, { reference: pattern }],
        })
          .select('expenseNo description category')
          .limit(4)
          .lean(),
      (row) => ({ id: row._id, title: row.expenseNo, detail: row.description || row.category }),
    ],
    [
      'Users',
      'users',
      () =>
        User.find({
          $or: [{ name: pattern }, { username: pattern }, { email: pattern }, { phone: pattern }],
        })
          .select('name username role')
          .limit(4)
          .lean(),
      (row) => ({ id: row._id, title: row.name, detail: `${row.username} · ${row.role}` }),
    ],
  ].filter(([, module]) => hasPermission(request.user, module, 'view'));

  const groups = await Promise.all(
    sources.map(async ([source, , find, map]) => ({
      source,
      records: (await find()).map(map),
    })),
  );
  const data = groups
    .flatMap((group) => group.records.map((record) => ({ ...record, source: group.source })))
    .slice(0, 16);
  return sendSuccess(response, { message: 'Search completed', data });
};
