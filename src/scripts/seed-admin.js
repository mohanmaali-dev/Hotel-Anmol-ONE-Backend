import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';
import { User } from '../modules/users/user.model.js';
import { getDefaultPermissions } from '../utils/permissions.js';

const requiredAdminValues = () => {
  const names = ['ADMIN_NAME', 'ADMIN_USERNAME', 'ADMIN_EMAIL', 'ADMIN_PHONE', 'ADMIN_PASSWORD'];
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(`Missing admin environment variables: ${missing.join(', ')}`);
  }
  if (process.env.ADMIN_PASSWORD.length < 8) {
    throw new Error('ADMIN_PASSWORD must contain at least 8 characters');
  }
  return {
    name: process.env.ADMIN_NAME.trim(),
    username: process.env.ADMIN_USERNAME.trim().toLowerCase(),
    email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
    phone: process.env.ADMIN_PHONE.trim(),
    password: process.env.ADMIN_PASSWORD,
  };
};

const seedAdmin = async () => {
  await connectDatabase();

  const existingAdmin = await User.exists({ role: 'Admin' });
  if (existingAdmin) {
    logger.info('An Admin user already exists; no user was created');
    return;
  }

  const values = requiredAdminValues();
  await User.create({
    ...values,
    role: 'Admin',
    permissions: getDefaultPermissions('Admin'),
    isActive: true,
  });
  logger.info('First Admin user created successfully');
};

seedAdmin()
  .catch((error) => {
    logger.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
