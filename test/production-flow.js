import { randomBytes, randomInt } from 'node:crypto';
import { spawn } from 'node:child_process';

import 'dotenv/config';
import mongoose from 'mongoose';

const sourceMongoUri = process.env.MONGODB_URI;
if (!sourceMongoUri) throw new Error('MONGODB_URI is required');

const databaseName = `restaurant_deployment_check_${Date.now()}_${randomInt(1000, 10000)}`;
const mongoUrl = new URL(sourceMongoUri);
mongoUrl.pathname = `/${databaseName}`;
const testMongoUri = mongoUrl.toString();
const port = randomInt(5200, 5700);
const apiUrl = `http://127.0.0.1:${port}/api`;
const adminPassword = `${randomBytes(24).toString('base64url')}Aa1!`;
const productionEnv = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: String(port),
  MONGODB_URI: testMongoUri,
  FRONTEND_URL: 'http://127.0.0.1:4173',
  JWT_ACCESS_SECRET: randomBytes(48).toString('hex'),
  ADMIN_NAME: 'Production Check Admin',
  ADMIN_USERNAME: 'production-check-admin',
  ADMIN_EMAIL: 'production-check@example.test',
  ADMIN_PHONE: '9999999999',
  ADMIN_PASSWORD: adminPassword,
};

const runNode = (file, extraEnv = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file], {
      cwd: process.cwd(),
      env: { ...productionEnv, ...extraEnv },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${file} exited with code ${code}`));
    });
  });

const waitForApi = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}/health`);
      if (response.ok) return;
    } catch {
      // The server may still be connecting to MongoDB.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Production API did not become ready');
};

const stopServer = (server) =>
  new Promise((resolve) => {
    if (!server || server.exitCode !== null) return resolve();
    server.once('exit', resolve);
    server.kill('SIGTERM');
  });

const removeTestDatabase = async () => {
  const connection = mongoose.createConnection(testMongoUri, { autoIndex: false });
  await connection.asPromise();
  if (connection.name !== databaseName) {
    await connection.close();
    throw new Error('Refusing to remove an unexpected database');
  }
  await connection.dropDatabase();
  await connection.close();
};

let server;
try {
  await runNode('src/scripts/seed-admin.js');
  await runNode('src/scripts/seed-admin.js');
  server = spawn(process.execPath, ['test/vercel-entry.js'], {
    cwd: process.cwd(),
    env: productionEnv,
    stdio: 'inherit',
  });
  await waitForApi();
  await runNode('test/smoke-flow.js', {
    SMOKE_API_URL: apiUrl,
    SMOKE_USERNAME: productionEnv.ADMIN_USERNAME,
    SMOKE_PASSWORD: adminPassword,
  });
} finally {
  await stopServer(server);
  await removeTestDatabase();
}
