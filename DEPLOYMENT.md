# Restaurant Management Deployment Guide

This guide explains how to deploy the frontend and backend in a simple way.

The values inside `.env.example` are fake examples. Replace every URL, database credential, secret, and Admin password with your real production values.

## Project folders

- `Frontend-Scaffold` contains the React and Vite frontend.
- `Backend-Scaffold` contains the Node.js, Express, and MongoDB backend.

Use Node.js 24 for both projects.

## Before deployment

You need:

- A MongoDB database.
- A hosting service that can run a Node.js server for the backend.
- A Vercel account for the frontend.
- Your final frontend and backend domain names.

Do not commit `.env.production` or `.env.development`. Both files are already ignored by Git.

## 1. Prepare MongoDB

Create a production MongoDB database and database user. Copy its connection string.

It will look similar to:

```env
MONGODB_URI=mongodb+srv://restaurant_user:password@cluster.mongodb.net/restaurant_management?retryWrites=false&w=majority
MONGODB_RETRY_WRITES=false
```

Replace the username, password, cluster address, and database name with the real values. Allow network access only from the backend hosting environment when possible.

## 2. Configure the backend

Open `Backend-Scaffold/.env.production` and enter the production values:

```env
NODE_ENV=production
APP_TIMEZONE=Asia/Kolkata
PORT=5000
MONGODB_URI=your-real-mongodb-connection-string
MONGODB_RETRY_WRITES=false
FRONTEND_URL=https://your-frontend-domain.com
JWT_SECRET=your-private-random-secret-with-at-least-32-characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=a-different-private-random-secret-with-at-least-32-characters
JWT_REFRESH_EXPIRES_IN=7d
JWT_REFRESH_COOKIE_DAYS=7
JSON_BODY_LIMIT=10kb
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=500
LOGIN_RATE_LIMIT_MAX=10
TRUST_PROXY=1

ADMIN_NAME=Restaurant Owner
ADMIN_USERNAME=admin
ADMIN_EMAIL=owner@your-domain.com
ADMIN_PHONE=9999999999
ADMIN_PASSWORD=your-strong-admin-password
```

Change these important values:

| Variable             | What to enter                                              |
| -------------------- | ---------------------------------------------------------- |
| `MONGODB_URI`        | Real production MongoDB connection string                  |
| `MONGODB_RETRY_WRITES` | Use `false` for MongoDB providers without retryable writes |
| `FRONTEND_URL`       | Exact deployed frontend address, without `/api`            |
| `JWT_SECRET`         | Unique private random value of at least 32 characters      |
| `JWT_REFRESH_SECRET` | A different private random value of at least 32 characters |
| `ADMIN_EMAIL`        | Restaurant owner's login email                             |
| `ADMIN_PHONE`        | A 7 to 15 digit phone number                               |
| `ADMIN_PASSWORD`     | A strong password used only for the first Admin            |

Keep `TRUST_PROXY=1` on Vercel or a normal single-proxy host so request limits use the visitor's real IP address. Email variables are optional while `EMAIL_ENABLED=false`; the complete example is in `.env.example`.

On the backend hosting service configure:

- Root directory: `Backend-Scaffold`
- Node version: `24`
- Install command: `npm ci --omit=dev`
- Start command: `npm start`
- Health check path: `/api/health`

Add the same backend environment values in the hosting service's environment settings. Hosting environment values work even when `.env.production` is not uploaded.

After deployment, open:

```text
https://your-backend-domain.com/api/health
```

The expected response is:

```json
{
  "success": true,
  "message": "Restaurant Management API is running"
}
```

## 3. Create the first Admin

The first Admin is created with a one-time command. The password is automatically hashed before it is stored.

Make sure these values exist in the backend production environment:

```env
ADMIN_NAME=Restaurant Owner
ADMIN_USERNAME=admin
ADMIN_EMAIL=owner@your-domain.com
ADMIN_PHONE=9999999999
ADMIN_PASSWORD=your-strong-admin-password
```

Run this command once from the backend hosting shell or one-time job:

```bash
npm run seed:admin
```

The script will not create another Admin when one already exists. After successful creation, remove `ADMIN_PASSWORD` from the hosting environment. You can also remove the other `ADMIN_*` values because they are not needed during normal server startup.

The Admin can log in using either:

- `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`

## 4. Configure the frontend

Open `Frontend-Scaffold/.env.production` and add the deployed backend API address:

```env
VITE_API_URL=https://your-backend-domain.com/api
```

The `/api` part is required. Do not put the frontend URL here.

You must also add `VITE_API_URL` in the Vercel project environment settings before building.

## 5. Deploy the frontend to Vercel

Import the project into Vercel and use:

- Root directory: `Frontend-Scaffold`
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL`

The included `vercel.json` handles React routes. Direct links and page refreshes such as `/orders`, `/billing/123`, and `/settings` will return the application instead of a Vercel 404 page.

After Vercel gives you the final frontend URL, confirm that the backend `FRONTEND_URL` contains that exact address. Restart or redeploy the backend after changing it.

## 6. Test before giving access to users

Check this flow:

1. Open the frontend URL.
2. Log in with the first Admin account.
3. Open Dashboard.
4. Create an Order.
5. Generate a Bill.
6. Update Payment.
7. Confirm that the Sale appears.
8. Create and receive a Purchase.
9. Confirm that Stock increases only once.
10. Complete an Order with a Menu recipe.
11. Confirm that Stock decreases only once.
12. Add an Expense and check Reports.
13. Refresh an inner page and confirm there is no 404 error.

## Local production checks

Frontend:

```bash
cd Frontend-Scaffold
npm ci
npm run build
npm run preview
```

Backend:

```bash
cd Backend-Scaffold
npm ci
npm run lint
npm test
npm start
```

Run the isolated full-flow backend check when a safe MongoDB server is configured:

```bash
npm run test:production
```

This command uses a separate temporary database. It drops that database when the MongoDB user permits it; otherwise it deletes every temporary test record.

## Local development

Frontend development values are stored in `Frontend-Scaffold/.env.development`:

```env
VITE_API_URL=http://localhost:5000/api
```

Backend development values are stored in `Backend-Scaffold/.env.development`. Change the local MongoDB address if your database uses a different host or database name.

Start both applications in separate terminals:

```bash
cd Backend-Scaffold
npm run dev
```

```bash
cd Frontend-Scaffold
npm run dev
```

## Common deployment problems

### Frontend shows a network error

Check that `VITE_API_URL` contains the backend domain and ends with `/api`. Redeploy the frontend after changing a Vite environment variable because it is included during the build.

### Backend returns a CORS error

Check that `FRONTEND_URL` exactly matches the frontend origin, for example `https://restaurant-app.vercel.app`. Do not include `/api` or another path.

### Page refresh returns 404

Confirm that `Frontend-Scaffold/vercel.json` is included in the deployed project and the Vercel root directory is `Frontend-Scaffold`.

### Backend does not start

Check `MONGODB_URI`, `JWT_SECRET`, and `FRONTEND_URL`. Production startup stops when one of these required values is missing. The JWT secret must have at least 32 characters.

### Admin cannot log in

Run `npm run seed:admin` once and check that the username or email matches the values used during the seed. An inactive user cannot log in.

## Final security checklist

- Replace every dummy value from `.env.example`.
- Never commit `.env.production` or `.env.development`.
- Use HTTPS for both frontend and backend.
- Use a unique JWT secret that is not used by another application.
- Use a strong MongoDB password and restrict database network access.
- Remove `ADMIN_PASSWORD` from the hosting environment after creating the Admin.
- Do not automatically run the Admin seed or test-data scripts during server startup.
