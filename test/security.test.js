import assert from 'node:assert/strict';
import test from 'node:test';

import { comparePassword, hashPassword } from '../src/utils/password.js';
import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../src/utils/jwt.js';
import {
  getDefaultPermissions,
  hasPermission,
  normalizePermissions,
} from '../src/utils/permissions.js';

test('passwords are hashed and can be verified', async () => {
  const password = 'SecurePass123!';
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  assert.equal(await comparePassword(password, hash), true);
  assert.equal(await comparePassword('wrong-password', hash), false);
});

test('access and refresh tokens use valid independent session lifetimes', () => {
  const userId = '507f1f77bcf86cd799439011';
  const access = verifyAccessToken(createAccessToken(userId));
  const refresh = verifyRefreshToken(createRefreshToken(userId));
  assert.equal(access.userId, userId);
  assert.equal(refresh.userId, userId);
  assert.ok(refresh.exp > access.exp);
  assert.throws(() => verifyRefreshToken(createAccessToken(userId)));
});

test('Admin has full access while Waiter stays restricted', () => {
  const admin = { role: 'Admin', permissions: [] };
  const waiter = { role: 'Waiter', permissions: getDefaultPermissions('Waiter') };
  assert.equal(hasPermission(admin, 'users', 'delete'), true);
  assert.equal(hasPermission(waiter, 'orders', 'create'), true);
  assert.equal(hasPermission(waiter, 'sales', 'view'), false);
});

test('permission payloads reject unknown modules and actions', () => {
  assert.throws(
    () => normalizePermissions([{ module: 'database', actions: ['delete'] }], 'Staff'),
    /Invalid permission module/,
  );
  assert.throws(
    () => normalizePermissions([{ module: 'orders', actions: ['approve'] }], 'Staff'),
    /Invalid permission action/,
  );
});
