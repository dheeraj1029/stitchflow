# StitchFlow deployment guide

This guide covers the existing React/Vite frontend and Express/Mongoose API.
There is no deployed URL or hosting-provider-specific configuration in this
repository.

## 1. Prerequisites

- Node.js 20 or newer and npm.
- MongoDB Atlas or another MongoDB replica set/sharded cluster. Standalone
  MongoDB is not supported because production updates and issue reviews use
  transactions.
- A production frontend host that serves the Vite `dist` directory and supports
  SPA route fallback.
- A backend host that can reach MongoDB over TLS and accept traffic from the
  frontend reverse proxy.
- TLS termination, private environment-variable storage, restricted database
  network access, backups, and monitoring.

## 2. Local Windows CMD setup

From the repository root:

```cmd
npm install
npm install --prefix backend
copy backend\.env.example backend\.env
node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"
notepad backend\.env
```

Generate the JWT secret locally and place it in `JWT_SECRET`. Do not paste it
into chat, commit it, or put it in frontend configuration.

## 3. Frontend setup

The frontend is a Vite single-page application. During local development, start
it from the repository root:

```cmd
npm run dev -- --host 127.0.0.1
```

For production, build the static site and serve `dist` over HTTPS with a
single-page-app fallback to `index.html`:

```cmd
npm run build
```

The frontend calls relative `/api` paths. Production hosting must route `/api`
to the backend on the same public origin (normally through a reverse proxy).
The Vite development proxy is not a production proxy. Browser-facing API calls
to a separate domain are not currently configurable.

## 4. Backend setup

The API is started with:

```cmd
npm start --prefix backend
```

It validates its configuration, connects to MongoDB before listening, and exits
with a safe error if startup configuration or database connectivity is invalid.
`GET /api/health` reports API/database readiness and returns `503` while the
database is disconnected. The backend closes its HTTP listener and MongoDB
connection on `SIGINT`/`SIGTERM`.

The API binds to `127.0.0.1` by default in development. In production it binds
to `0.0.0.0` unless `HOST` is explicitly set. Keep the service behind a
TLS-terminating reverse proxy; do not expose the database publicly.

## 5. MongoDB Atlas setup

1. Create a dedicated Atlas database user with only the required application
   database permissions.
2. Restrict Atlas network access to the backend host's egress IP/range. Do not
   use `0.0.0.0/0` for a production deployment.
3. Use the TLS-enabled Atlas driver URI in `MONGODB_URI`; URL-encode reserved
   characters in credentials.
4. Confirm the cluster supports replica-set transactions (Atlas does).
5. Configure backups and test recovery procedures before storing business data.

Do not run destructive migrations or tests against a production database.
`npm run test:db --prefix backend` uses an isolated in-memory replica set.

## 6. Environment variables

Set these in the backend host's private environment configuration. Never
include real values in source control or this document.

| Variable | Required | Description |
|---|---:|---|
| `MONGODB_URI` | Yes | TLS-enabled MongoDB replica-set/sharded connection URI. |
| `JWT_SECRET` | Yes | Unique random secret of at least 32 bytes. Keep server-side only. |
| `JWT_EXPIRES_IN` | No | Access-token lifetime accepted by `jsonwebtoken`; defaults to `1h`. |
| `NODE_ENV` | No | Set to `production` for a production deployment. |
| `PORT` | No | API listen port; defaults to `3001`. Honor the port assigned by the host. |
| `HOST` | No | Bind interface; defaults to loopback in development and `0.0.0.0` in production. |
| `FRONTEND_URL` | No | Exact frontend HTTP(S) origin allowed by CORS; defaults to local Vite origin. |
| `OPENAI_API_KEY` | No | Server-side key for the paid classification provider. Keep unset to disable it. |
| `OPENAI_MODEL` | No | Provider model name; required along with the API key for classification. |
| `STITCHFLOW_ALLOW_ADMIN_BOOTSTRAP` | Command only | Must be `true` in the same process environment to run the one-time production admin bootstrap CLI; do not leave it set for the API service. |

Classification is disabled unless both OpenAI variables are configured. Automated
tests use mocks and do not call the paid provider.

Access tokens are signed and expire, but the application does not implement
refresh tokens or a token revocation list. Logout clears the client token only;
it does not revoke a copied token immediately. Deactivating a user blocks their
existing token on the next authenticated request because the server reloads
their active account state.

The login endpoint accepts five requests per client IP in each 15-minute
window; successful and unsuccessful requests count, and further requests
receive HTTP 429. Its current in-memory counter is per API process, resets when
that process restarts, and is not shared across replicas. Keep the configured
limit in production. The application does not currently enable Express
`trust proxy`, so behind a reverse proxy it sees the proxy as the request IP;
clients sharing that proxy may share one quota. Before relying on IP-based
limits behind a proxy, configure only the exact trusted proxy address/hop count
for that deployment. Trusting arbitrary forwarded headers would allow clients
to bypass the limit.

## 7. Demo seed

For a local development database only:

```cmd
npm run seed --prefix backend
```

The seed inserts missing demonstration records without overwriting existing
records. It refuses to run when `NODE_ENV=production`. The documented demo
accounts share the local-only password `StitchFlowDemo2026!`; do not expose
these accounts to public traffic. For a production database, establish the
first administrator using the private one-time procedure in section 11; demo
seeding is not available in production.

## 8. Start commands

Local development uses three Windows CMD terminals from the repository root:

```cmd
mongod --replSet rs0 --bind_ip 127.0.0.1 --dbpath C:\data\db
```

Initialize a newly created local replica set only once:

```cmd
mongosh --host 127.0.0.1:27017 --eval "rs.initiate()"
```

Start the backend and frontend in separate terminals:

```cmd
npm run api:dev
```

```cmd
npm run dev -- --host 127.0.0.1
```

The local MongoDB URI is
`mongodb://127.0.0.1:27017/stitchflow?replicaSet=rs0`.

## 9. Test commands

Run from the repository root:

```cmd
npm test
npm test --prefix backend
npm run test --prefix backend
npm run test:db --prefix backend
npm run build
git diff --check
```

The database suite drops only its isolated in-memory test database. It does not
use a configured Atlas/local database.

## 10. Demo login instructions

After running the local demo seed, sign in with one of these accounts:

- `admin@stitchflow.demo`
- `merchandiser@stitchflow.demo`
- `supervisor@stitchflow.demo`
- `buyer.b@stitchflow.demo` (Company B)
- `buyer.c@stitchflow.demo` (Company C)

For local demonstration only, each account uses `StitchFlowDemo2026!`. These
credentials must not be used in a public deployment.

## 11. Initial administrator bootstrap

The public API does not expose unauthenticated administrator creation. To
create the first administrator for a production database, keep public access
closed and run this one-time command from a trusted operator terminal on a
machine with the private `backend\.env` configured:

```cmd
set "STITCHFLOW_ALLOW_ADMIN_BOOTSTRAP=true"
npm run admin:create --prefix backend
set "STITCHFLOW_ALLOW_ADMIN_BOOTSTRAP="
```

The CLI requires an explicit confirmation, prompts twice for a hidden password,
and creates an active administrator with a bcrypt-hashed password. It refuses
to create an admin if one already exists; a MongoDB transaction and persistent
one-time lock also prevent a second bootstrap. The temporary CMD variable is
inherited by the CLI; clear it immediately after the command and never set it
for the API service. After creating the first admin, create other required
users through the authenticated admin interface before enabling intended
access. If all admin accounts are later lost, recover through a separately
authorized operator/database procedure; do not make bootstrap a public
recovery endpoint.

## 12. Troubleshooting

- **API exits with missing `MONGODB_URI` or `JWT_SECRET`:** check the private
  `backend\.env` file and restart the API. Do not display its values in logs.
- **MongoDB connection fails:** verify Atlas IP access, TLS-enabled URI, database
  credentials, and replica-set support.
- **Transactions unsupported:** use Atlas or a local replica set, not a
  standalone MongoDB process.
- **Health endpoint returns `503`:** check backend logs and MongoDB reachability;
  API persistence requests also fail with `503` rather than reporting success.
- **Browser requests are blocked:** use the configured exact frontend origin
  and route `/api` through the same-origin reverse proxy.
- **Demo seed refuses to run:** demo seeding is intentionally disabled under
  `NODE_ENV=production`; use an isolated development database.
- **Classification is unavailable:** check whether both OpenAI environment
  variables are configured. Other workflows remain available without them.

## 13. Production deployment requirements

- Set `NODE_ENV=production`, `MONGODB_URI`, a unique `JWT_SECRET`, `PORT`,
  `HOST`, and the exact `FRONTEND_URL` using the host's secret manager.
- Build and serve the frontend static assets over HTTPS. Configure SPA fallback
  and reverse proxy `/api` to the backend.
- Configure the proxy to forward the host-assigned backend port and the
  configured frontend origin; keep the MongoDB endpoint private.
- Do not run the demo seed in production. Establish the initial administrator
  using the private CLI procedure above; disable demonstration users before
  public access.
- Configure monitoring for `/api/health`, safe log retention, backups, and
  incident response. Do not log request bodies, passwords, bearer tokens,
  database URIs, or OpenAI keys.
- Test upgrades and restore procedures against a staging replica set first.
- No paid host has been selected, and this project has not been deployed.
