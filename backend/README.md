# StitchFlow MongoDB persistence

The Express API uses MongoDB through Mongoose for users, buyer organizations,
production units, orders/TNA milestones, production updates, production issues,
and issue-review audit records. The API does not start until MongoDB is
reachable. Transactions are used for production output changes and issue review,
so MongoDB must run as a replica set (Atlas does this by default).

## Requirements

- Node.js and npm versions supported by the root Vite application.
- A MongoDB Atlas cluster or local MongoDB replica set.
- The frontend and backend run in separate terminals for local development.

## Atlas setup

1. Create a MongoDB Atlas project and cluster.
2. Create a database user with access only to the StitchFlow database. Do not
   use an Atlas account password as the database password.
3. In **Network Access**, allow only your current development IP address. Avoid
   `0.0.0.0/0`; remove temporary IP entries when no longer needed.
4. Copy the Node.js connection string from **Connect → Drivers**. Replace the
   username, password, and database name in the local `.env` file. URL-encode
   reserved characters in the database password. Never paste credentials into
   chat, source code, screenshots, or Git.
5. Keep TLS enabled (the Atlas URI default), use a strong unique database
   password, and use Atlas backups for any data you need to retain.

## Local MongoDB replica set on Windows

Install MongoDB Community Server and MongoDB Shell (`mongosh`). In one CMD
terminal, create the data directory if necessary and start a local single-node
replica set:

```cmd
if not exist C:\data\db mkdir C:\data\db
mongod --replSet rs0 --bind_ip 127.0.0.1 --dbpath C:\data\db
```

Keep that terminal open. In a second CMD terminal, initialize the replica set
once and check that it becomes primary:

```cmd
mongosh --host 127.0.0.1:27017 --eval "rs.initiate()"
mongosh --host 127.0.0.1:27017 --eval "rs.status().myState"
```

The second command should print `1`. For subsequent runs, start `mongod` again;
do not run `rs.initiate()` a second time. This loopback-only setup is for local
development and is not production hardening.

## Configure and run (Windows CMD)

From the repository root, install backend dependencies, copy the example
environment file, and generate a private JWT secret:

```cmd
npm install --prefix backend
copy backend\.env.example backend\.env
node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"
notepad backend\.env
```

Set `MONGODB_URI` to your Atlas URI or the local replica-set URI below, and put
the generated value in `JWT_SECRET`. Keep `backend\.env` private and untracked.
The local URI is:

```text
mongodb://127.0.0.1:27017/stitchflow?replicaSet=rs0
```

`PORT` defaults to `3001`, `HOST` to `127.0.0.1` during development, and
`FRONTEND_URL` to `http://127.0.0.1:5173`. In production, `HOST` defaults to
`0.0.0.0` so a hosting platform or reverse proxy can reach the API. Configure
`FRONTEND_URL` as an HTTP(S) origin without a path. `OPENAI_API_KEY` and
`OPENAI_MODEL` are optional for the existing issue-classification integration;
leave them blank to run the rest of the app without live classification.

Seed the five demo accounts, two buyer organizations, three demo production
units, three sample orders and representative issue records:

```cmd
npm run seed --prefix backend
```

Seeding is idempotent and inserts only missing records; it will not reset
changes to existing demo records. It is disabled when `NODE_ENV=production`.
All five demo accounts use
`StitchFlowDemo2026!`; these are for local demonstration only. Set unique
passwords before using a non-local environment.

## Initial administrator bootstrap

The public API does not provide unauthenticated administrator creation. To
create the first administrator for a production database, keep public access
closed and run this one-time command from a trusted operator terminal after
configuring `MONGODB_URI` in `backend\.env`:

```cmd
set "STITCHFLOW_ALLOW_ADMIN_BOOTSTRAP=true"
npm run admin:create --prefix backend
set "STITCHFLOW_ALLOW_ADMIN_BOOTSTRAP="
```

The command prompts for the administrator name and email, requires an explicit
confirmation phrase, and reads the new password twice without echoing it.
Passwords must be at least 10 characters and at most 72 UTF-8 bytes. The
password is stored only as a bcrypt hash. The command refuses to run in
production unless the temporary opt-in above is set, and the database
transaction and one-time lock prevent creating another initial administrator.
After it succeeds, clear the temporary CMD variable and close the operator
session. Existing administrators are managed through the authenticated admin
interface; this bootstrap command cannot be used to reset or replace them.
Demo seeding remains disabled in production.

Open two more CMD terminals in the repository root:

Terminal 1 — backend:

```cmd
npm run api:dev
```

Terminal 2 — frontend:

```cmd
npm run dev -- --host 127.0.0.1
```

Open the Vite URL shown in Terminal 2. Stop each process with `Ctrl+C`. The
backend must be connected and seeded before signing in. The frontend no longer
uses browser-local records as a fallback; a backend/database error is shown
with a retry action rather than displaying stale sample state.

## Data behavior and migration from browser storage

Orders, production updates, and issue history are persisted in MongoDB after
this phase. The current-stage output is stored separately from production
updates: the baseline output plus updates for that **same stage** determines
the current output. Output from different stages is never combined.

Existing browser `localStorage` is not cleared, overwritten, or automatically
imported. Records still present in the browser will not appear in the database
until you explicitly export and import them. The import is additive: duplicate
PO numbers and previously imported record IDs are skipped, never used to
overwrite database records. Invalid records or records whose buyer/unit/order
cannot be resolved are skipped and listed in the import report. Review the
report and resulting records before relying on imported data.

To export the old browser's records, open the app in the browser profile that
contains them, open Developer Tools → Console, and run:

```js
const bundle = {
  orders: JSON.parse(localStorage.getItem("stitchflow.production-orders.v1") || "null"),
  productionUpdates: JSON.parse(localStorage.getItem("stitchflow.production-updates.v1") || "null"),
  issues: JSON.parse(localStorage.getItem("stitchflow.production-issues.v1") || "null"),
};
const link = document.createElement("a");
link.href = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
link.download = "stitchflow-browser-export.json";
link.click();
URL.revokeObjectURL(link.href);
```

Protect the downloaded file as sensitive business data. Move it into
`backend\` without committing it, then in a CMD terminal from the repository
root run:

```cmd
npm run import:browser --prefix backend -- stitchflow-browser-export.json
```

The demo seed must already exist. Import maps the legacy `North Mill (Demo)`,
`Riverside Works (Demo)`, and `East Works (Demo)` names to `Unit A`, `Unit B`,
and `Unit C`, respectively. Missing buyer organizations (using the exported
buyer name/country) and other missing production units are created additively
to support imported orders; the demo seed itself still creates only its
approved demo records. Legacy submissions are associated with the seeded demo
supervisor/merchandiser. The importer preserves legacy order totals, stage
baselines, TNA milestones, update quantities, and issue notes/classification
history where the database schema accepts them. Browser attachment metadata is
retained, but local attachment blobs are not uploaded or imported. Review every
skipped record in the CLI output; fix or manually recreate records that cannot
be mapped. Do not delete the browser's original storage or export until you've
verified the database contents and made a backup.

## Tests and build

Run from the repository root:

```cmd
npm test
npm test --prefix backend
npm run test:db --prefix backend
npm run build
git diff --check
```

The database integration suite uses an isolated MongoDB replica set from
`mongodb-memory-server` and may download a MongoDB binary on its first run. It
does not contact your Atlas/local database. The regular backend test suite
injects an in-memory repository. Neither test suite changes persistent data.

## API, access, and operational notes

- `POST /api/auth/login` and `GET /api/auth/me` — authentication and active
  account profile.
- `GET /api/orders`, `GET /api/orders/:orderId`, `POST /api/orders`, and
  `PATCH /api/orders/:orderId` — role- and association-scoped order workflows.
- `GET /api/order-options` — merchandiser-only buyer organizations and
  production units available for order entry.
- `GET /api/production-updates`, `POST /api/production-updates`, and
  `PATCH`/`DELETE /api/production-updates/:updateId` — production update history
  and stage-output maintenance.
- `GET /api/issues`, `POST /api/issues`, `POST /api/issues/classify`, and
  `PATCH /api/issues/:issueId/review` — persisted issue reporting,
  classification, and merchandiser review.
- `GET /api/users`, `POST /api/users`, and `PATCH /api/users/:userId` — admin
  user management.
- `GET /api/health` — service and database readiness.

Buyer access is limited to the buyer organization on the authenticated account;
supervisors are limited to their assigned production unit. Do not rely on
client-supplied IDs or filters for authorization. Access tokens remain
short-lived and in frontend memory. Passwords are stored as bcrypt hashes.
Use TLS, restricted network access, private environment variables, least
privilege database credentials, backups, and monitoring before any deployment
outside local development. This phase does not implement server-side token
revocation or refresh-token sessions.
