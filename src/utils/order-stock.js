import { MenuItem } from '../models/menu-item.model.js';
import { Order } from '../models/order.model.js';
import { combineRequiredIngredients, checkStockRequirements } from './menu-stock.js';
import { applyStockMovement, rollbackAppliedMovement } from './stock-movement.js';

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const createInsufficientStockError = (availability) => {
  const error = createError('Insufficient stock', 400);
  error.items = availability.ingredients
    .filter((ingredient) => !ingredient.sufficient)
    .map((ingredient) => ({
      item: ingredient.stockItemName,
      required: ingredient.requiredQuantity,
      available: ingredient.currentQuantity,
    }));
  return error;
};

export const getOrderStockRequirements = async (order) => {
  const menuItemIds = [...new Set(order.items.map((item) => String(item.menuItemId)))];
  const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } }).lean();
  const menuById = new Map(menuItems.map((item) => [String(item._id), item]));
  const missingItems = order.items
    .filter((item) => !menuById.has(String(item.menuItemId)))
    .map((item) => item.itemName);

  if (missingItems.length > 0) {
    throw createError(
      `Cannot complete order because menu items no longer exist: ${[...new Set(missingItems)].join(', ')}`,
      400,
    );
  }

  return combineRequiredIngredients(
    order.items.map((item) => ({
      menuItem: menuById.get(String(item.menuItemId)),
      quantity: item.quantity,
    })),
  );
};

const unlockOrder = (orderId) =>
  Order.updateOne(
    { _id: orderId, stockDeducted: { $ne: true } },
    { $set: { stockProcessing: false } },
  );

export const completeOrderWithStock = async (order, user) => {
  if (order.stockDeducted) return order;

  const claimedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      updatedAt: order.updatedAt,
      stockDeducted: { $ne: true },
      stockProcessing: { $ne: true },
      orderStatus: { $ne: 'Cancelled' },
    },
    { $set: { stockProcessing: true } },
    { returnDocument: 'after', runValidators: true },
  );

  if (!claimedOrder) {
    const latestOrder = await Order.findById(order._id);
    if (!latestOrder) throw createError('Order not found', 404);
    if (latestOrder.stockDeducted) return latestOrder;
    if (latestOrder.stockProcessing) {
      throw createError('Order stock deduction is already in progress', 409);
    }
    throw createError('Order changed while completion was requested. Please try again', 409);
  }

  const appliedMovements = [];
  let requirements = [];
  try {
    requirements = await getOrderStockRequirements(claimedOrder);
    const availability = await checkStockRequirements(requirements);
    if (!availability.available) throw createInsufficientStockError(availability);

    for (const ingredient of requirements) {
      const movement = await applyStockMovement({
        stockItemId: ingredient.stockItemId,
        type: 'OUT',
        quantity: ingredient.requiredQuantity,
        orderId: claimedOrder._id,
        reference: claimedOrder.orderNo,
        reason: 'Order Usage',
        date: new Date(),
        note: `Ingredients used for ${claimedOrder.orderNo}.`,
        user,
      });
      appliedMovements.push(movement);
    }

    claimedOrder.orderStatus = 'Completed';
    claimedOrder.stockDeducted = true;
    claimedOrder.stockProcessing = false;
    claimedOrder.stockDeductedAt = new Date();
    await claimedOrder.save();
    return claimedOrder;
  } catch (error) {
    const rollbackResults = await Promise.allSettled(
      appliedMovements.reverse().map((movement) => rollbackAppliedMovement(movement)),
    );
    await unlockOrder(claimedOrder._id);
    if (rollbackResults.some((result) => result.status === 'rejected')) {
      throw createError('Order completion failed and stock requires manual review', 500);
    }
    if (
      !error.items &&
      error.statusCode === 400 &&
      error.message.startsWith('Insufficient stock')
    ) {
      const latestAvailability = await checkStockRequirements(requirements);
      throw createInsufficientStockError(latestAvailability);
    }
    throw error;
  }
};
