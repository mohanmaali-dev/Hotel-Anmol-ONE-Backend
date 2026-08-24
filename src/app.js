import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { corsOptions } from './config/cors.js';
import { env, validateEnvironment } from './config/env.js';
import { ensureDatabaseConnection } from './middlewares/database.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { notFoundHandler } from './middlewares/not-found.middleware.js';
import { globalRateLimiter } from './middlewares/rate-limit.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { userRouter } from './modules/users/user.routes.js';
import { billRouter } from './routes/bill.routes.js';
import { expenseRouter } from './routes/expense.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { menuRouter } from './routes/menu.routes.js';
import { orderRouter } from './routes/order.routes.js';
import { purchaseRouter } from './routes/purchase.routes.js';
import { reportRouter } from './routes/report.routes.js';
import { saleRouter } from './routes/sale.routes.js';
import { settingRouter } from './routes/setting.routes.js';
import { stockRouter } from './routes/stock.routes.js';
import { supplierRouter } from './routes/supplier.routes.js';

validateEnvironment();

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));
app.use(compression());
app.use(globalRateLimiter);
app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.jsonBodyLimit }));
app.use(cookieParser());

if (env.nodeEnv !== 'test') {
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
}

app.use('/api', ensureDatabaseConnection);
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/expenses', expenseRouter);
app.use('/api/menu', menuRouter);
app.use('/api/orders', orderRouter);
app.use('/api/bills', billRouter);
app.use('/api/sales', saleRouter);
app.use('/api/settings', settingRouter);
app.use('/api/purchases', purchaseRouter);
app.use('/api/reports', reportRouter);
app.use('/api/stock', stockRouter);
app.use('/api/suppliers', supplierRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
