import assert from 'node:assert/strict';

const apiUrl = process.env.SMOKE_API_URL;
const username = process.env.SMOKE_USERNAME;
const password = process.env.SMOKE_PASSWORD;

if (!apiUrl || !username || !password) {
  throw new Error('SMOKE_API_URL, SMOKE_USERNAME, and SMOKE_PASSWORD are required');
}

const request = async (path, { token, expected = 200, ...options } = {}) => {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  assert.equal(response.status, expected, `${options.method || 'GET'} ${path}: ${body.message}`);
  return body;
};

const post = (path, body, token, expected = 201) =>
  request(path, { method: 'POST', body: JSON.stringify(body), token, expected });
const put = (path, body, token, expected = 200) =>
  request(path, { method: 'PUT', body: JSON.stringify(body), token, expected });
const login = async (identifier, loginPassword, expected = 200) =>
  request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ usernameOrEmail: identifier, password: loginPassword }),
    expected,
  });

const run = async () => {
  const loginResult = await login(username, password);
  const token = loginResult.data.token;
  await request('/health');
  await Promise.all([
    request('/sales/summary', { token }),
    request('/orders?page=1&limit=5', { token }),
    request('/stock/summary', { token }),
  ]);

  const supplier = (
    await post(
      '/suppliers',
      {
        supplierName: 'Smoke Fresh Foods',
        contactPerson: 'Smoke Contact',
        phone: '9888800001',
        email: 'supplier-smoke@example.test',
        address: 'Temporary Test Address',
        status: 'Active',
      },
      token,
    )
  ).data;

  const stockInputs = [
    ['Bun', 'Bakery', 'Piece', 10, 2],
    ['Patty', 'Frozen', 'Piece', 30, 2],
    ['Sauce', 'Condiments', 'ml', 0.5, 100],
  ];
  for (const category of [...new Set(stockInputs.map(([, value]) => value))]) {
    await post('/stock/categories', { name: category, status: 'Active' }, token);
  }
  const stockItems = [];
  for (const [itemName, category, unit, purchasePrice, minimumStock] of stockInputs) {
    stockItems.push(
      (
        await post(
          '/stock/items',
          {
            itemName: `Smoke ${itemName}`,
            category,
            unit,
            openingQuantity: 0,
            purchasePrice,
            minimumStock,
            supplierId: supplier._id,
          },
          token,
        )
      ).data,
    );
  }

  const purchase = (
    await post(
      '/purchases',
      {
        supplierId: supplier._id,
        supplierInvoiceNo: 'SMOKE-INV-1',
        purchaseStatus: 'Ordered',
        discount: 10,
        additionalCharges: 5,
        paidAmount: 100,
        paymentType: 'UPI',
        items: [
          {
            stockItemId: stockItems[0]._id,
            itemName: 'Ignored',
            unit: 'Wrong',
            quantity: 20,
            purchasePrice: 12,
          },
          {
            stockItemId: stockItems[1]._id,
            itemName: 'Ignored',
            unit: 'Wrong',
            quantity: 10,
            purchasePrice: 35,
          },
          {
            stockItemId: stockItems[2]._id,
            itemName: 'Ignored',
            unit: 'Wrong',
            quantity: 1000,
            purchasePrice: 0.6,
          },
        ],
      },
      token,
    )
  ).data;
  assert.equal(purchase.subtotal, 1190);
  assert.equal(purchase.finalAmount, 1185);
  assert.equal(purchase.dueAmount, 1085);
  assert.equal(purchase.paymentStatus, 'Partial');

  const received = (
    await put(`/purchases/${purchase._id}/status`, { purchaseStatus: 'Received' }, token)
  ).data;
  assert.equal(received.stockUpdated, true);
  await put(`/purchases/${purchase._id}/status`, { purchaseStatus: 'Received' }, token);
  let bun = (await request(`/stock/items/${stockItems[0]._id}`, { token })).data;
  assert.equal(bun.currentQuantity, 20, 'receiving twice must not duplicate stock');

  const category = (
    await post(
      '/menu/categories',
      {
        name: 'Smoke Main Course',
        description: 'Temporary test category',
        status: 'Active',
      },
      token,
    )
  ).data;
  const menuItem = (
    await post(
      '/menu/items',
      {
        itemName: 'Smoke Burger',
        categoryId: category._id,
        sellingPrice: 200,
        servingSize: '1 Plate',
        availability: 'Available',
        trackStock: true,
        ingredients: [
          { stockItemId: stockItems[0]._id, quantityUsed: 1, unit: 'Piece' },
          { stockItemId: stockItems[1]._id, quantityUsed: 1, unit: 'Piece' },
          { stockItemId: stockItems[2]._id, quantityUsed: 20, unit: 'ml' },
        ],
      },
      token,
    )
  ).data;

  const order = (
    await post(
      '/orders',
      {
        orderType: 'Dine In',
        areaType: 'Indoor',
        areaRoomNo: 'T-1',
        customerName: 'Smoke Customer',
        discount: 10,
        additionalCharges: 5,
        paymentType: 'Cash',
        paymentStatus: 'Not Paid',
        items: [{ menuItemId: menuItem._id, itemName: 'Tampered Name', quantity: 2, rate: 1 }],
      },
      token,
    )
  ).data;
  assert.equal(order.items[0].itemName, 'Smoke Burger');
  assert.equal(order.items[0].servingSize, '1 Plate');
  assert.equal(order.items[0].rate, 200, 'backend must use the menu selling price');
  assert.equal(order.subtotal, 400);
  assert.equal(order.finalAmount, 395);

  const bill = (await post(`/bills/from-order/${order._id}`, {}, token)).data;
  assert.equal(bill.finalAmount, 395);
  assert.equal(bill.items[0].servingSize, '1 Plate');
  const existingBill = (await post(`/bills/from-order/${order._id}`, {}, token)).data;
  assert.equal(existingBill._id, bill._id, 'generating twice must return the existing bill');
  const paidBill = (
    await put(
      `/bills/${bill._id}/payment`,
      {
        paymentType: 'UPI',
        paidAmount: 100,
      },
      token,
    )
  ).data;
  assert.equal(paidBill.paymentStatus, 'Partial');
  assert.equal(paidBill.dueAmount, 295);
  const sales = await request(`/sales?search=${encodeURIComponent(bill.billNo)}`, { token });
  assert.equal(sales.data.length, 1, 'one bill must create exactly one sale');
  assert.equal(sales.data[0].paidAmount, 100, 'bill payment must sync to sale');

  await put(`/orders/${order._id}`, { orderStatus: 'Completed' }, token);
  await put(`/orders/${order._id}`, { orderStatus: 'Completed' }, token);
  bun = (await request(`/stock/items/${stockItems[0]._id}`, { token })).data;
  assert.equal(bun.currentQuantity, 18, 'completing twice must deduct stock once');

  const cancelledOrder = (
    await post(
      '/orders',
      {
        orderType: 'Parcel',
        areaType: 'Counter',
        areaRoomNo: 'P-1',
        customerName: 'Cancelled Customer',
        paymentType: 'Cash',
        paymentStatus: 'Not Paid',
        items: [{ menuItemId: menuItem._id, quantity: 1, rate: 0 }],
      },
      token,
    )
  ).data;
  await put(`/orders/${cancelledOrder._id}`, { orderStatus: 'Cancelled' }, token);
  await put(`/orders/${cancelledOrder._id}`, { orderStatus: 'Completed' }, token, 400);
  await post(
    '/stock/out',
    {
      stockItemId: stockItems[0]._id,
      quantity: 999,
      reason: 'Other',
      reference: 'negative-check',
    },
    token,
    400,
  );
  bun = (await request(`/stock/items/${stockItems[0]._id}`, { token })).data;
  assert.equal(bun.currentQuantity, 18, 'failed stock out must not change stock');

  await post(
    '/expenses',
    {
      category: 'Maintenance',
      amount: 250,
      paymentType: 'Cash',
      description: 'Smoke test maintenance',
      reference: 'SMOKE-EXP-1',
    },
    token,
  );
  const [expenseReport, purchaseReport, stockReport, salesReport] = await Promise.all([
    request('/reports/expenses', { token }),
    request('/reports/purchases', { token }),
    request('/reports/stock', { token }),
    request('/reports/sales', { token }),
  ]);
  assert.equal(expenseReport.summary.totalExpenses, 250);
  assert.equal(purchaseReport.summary.totalPurchaseAmount, 1185);
  assert.equal(stockReport.summary.totalStockOut, 44);
  assert.equal(salesReport.summary.totalSales, 395);

  const inactiveUser = (
    await post(
      '/users',
      {
        fullName: 'Inactive Smoke User',
        username: 'inactive-smoke',
        phone: '9888800002',
        password: 'Inactive123!',
        confirmPassword: 'Inactive123!',
        role: 'Staff',
        status: 'Inactive',
      },
      token,
    )
  ).data;
  assert.equal(inactiveUser.status, 'Inactive');
  await login('inactive-smoke', 'Inactive123!', 403);

  await post(
    '/users',
    {
      fullName: 'Waiter Smoke User',
      username: 'waiter-smoke',
      phone: '9888800003',
      password: 'Waiter123!',
      confirmPassword: 'Waiter123!',
      role: 'Waiter',
      status: 'Active',
    },
    token,
  );
  const waiterToken = (await login('waiter-smoke', 'Waiter123!')).data.token;
  await request('/orders?page=1&limit=1', { token: waiterToken });
  await request('/sales/summary', { token: waiterToken, expected: 403 });

  const history = await request('/stock/history?page=1&limit=100', { token });
  assert.ok(history.data.some((entry) => entry.purchaseId === purchase._id));
  assert.ok(history.data.some((entry) => entry.orderId === order._id));

  console.log(
    'Smoke flow passed: auth, orders, billing, sales, purchases, stock, menu, expenses, reports, RBAC',
  );
};

await run();
