# StitchFlow Phase 7 demo API

The existing Express API now provides demo authentication, role-based
authorization, organization-scoped buyer order and issue APIs, temporary admin
user management, and the Phase 6 issue-classification route. The repository is
in-memory demo data, not a production database. It resets whenever the API
process restarts.

## Demo accounts

All five seeded accounts use this shared demo password:

```text
StitchFlowDemo2026!
```

| Role | Email |
|---|---|
| Admin | `admin@stitchflow.demo` |
| Merchandiser | `merchandiser@stitchflow.demo` |
| Supervisor | `supervisor@stitchflow.demo` |
| Buyer — Company B | `buyer.b@stitchflow.demo` |
| Buyer — Company C | `buyer.c@stitchflow.demo` |

Only a bcrypt password hash is stored for these accounts. Do not reuse the demo
password for any real account.

## Windows CMD setup

From the repository root, install the backend packages and copy the example
environment file:

```cmd
npm install --prefix backend
copy backend\.env.example backend\.env
```

Generate a cryptographically random secret:

```cmd
node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"
```

Put that generated value in `backend\.env` as `JWT_SECRET`. Keep `.env` files
out of Git. Configure `JWT_EXPIRES_IN` as needed; the default is `1h`.
`OPENAI_API_KEY` and `OPENAI_MODEL` remain server-only and can be left blank.
No live OpenAI request is required for Phase 7.

Open two Windows CMD terminals in the repository root.

Terminal 1 — backend:

```cmd
npm run api:dev
```

Terminal 2 — frontend:

```cmd
npm run dev -- --host 127.0.0.1
```

Open the Vite URL printed in Terminal 2. The default Vite API proxy forwards
`/api` to `127.0.0.1:3001`; the default CORS origin is
`http://127.0.0.1:5173`.

If `JWT_SECRET` is omitted, the API generates a cryptographically random
process-only development secret and prints a warning. Sessions then become
invalid when the backend restarts. Configure a random value in `.env` for
repeatable local testing.

## Authentication and security

- Passwords use bcrypt hashes; plaintext passwords and hashes are not returned
  by APIs.
- Login returns an HS256 JWT containing only the subject identifier. Protected
  middleware verifies it and reads the current active role and associations
  from the server-side repository.
- Access tokens are held in frontend memory only. Reloading the page requires
  signing in again; logout and expired/invalid-token responses clear the
  in-memory session.
- The login endpoint is rate-limited to five attempts per 15 minutes per IP.
  Classification retains its Phase 6 limit of ten requests per minute.
- Helmet security headers and a single configured CORS origin are applied.
- Buyer organization and supervisor production-unit authorization is derived
  from the authenticated server-side user, never from browser query/body
  filters.
- The backend binds to loopback for local demo use. This setup is not intended
  for production deployment.

## Role summary

| Role | API and UI access |
|---|---|
| ADMIN | View all demo orders and issues; manage users, roles, associations, and account status. Cannot review issue classifications or edit orders. |
| MERCHANDISER | Manage existing internal order/TNA workflows; view issues and production data; confirm/reject issues through the role-guarded API. |
| SUPERVISOR | View orders and issues for the assigned production unit; submit production updates and issue reports; cannot manage orders/users or review classifications. |
| BUYER | Buyer portal only; backend returns only the account's own orders and confirmed, buyer-safe issue warnings. |

## API endpoints

Protected endpoints require `Authorization: Bearer <accessToken>`.

- `POST /api/auth/login` — email/password login; returns a short-lived access
  token and safe profile.
- `GET /api/auth/me` — current active server-side profile.
- `GET /api/users`, `POST /api/users`, `PATCH /api/users/:userId` — admin only.
  The last active admin cannot be disabled or reassigned.
- `GET /api/orders`, `GET /api/orders/:orderId` — server-scoped by buyer
  organization or supervisor production unit. Buyer responses omit internal
  notes and contain only confirmed warning details.
- `GET /api/issues` — server-scoped; buyers receive only confirmed issues with
  buyer-safe fields.
- `POST /api/issues` — supervisor/merchandiser issue submission.
- `POST /api/issues/classify` — supervisor/merchandiser classification. The
  Phase 6 OpenAI integration remains server-side and returns a safe 503 when
  credentials are not configured.
- `PATCH /api/issues/:issueId/review` — merchandiser only; confirm/reject with
  an audit event.
- `GET /api/health` — local service health.

Buyer organization query parameters are ignored for authorization. Direct
cross-organization order IDs return 404. No buyer notification is sent.

## Demo data and persistence boundary

The API's seeded users, organizations, production units, orders, and confirmed
issues are separate temporary in-memory demo data. Admin-created users and
API-submitted issues also disappear on API restart. Replace this repository
with persistent storage in Phase 8.

Existing internal order/TNA editing, production updates, and Phase 6 issue
history remain localStorage-based browser workflows. They are not shared,
encrypted, or a secure multi-user database. The buyer portal does not load or
merge those localStorage records; it uses only the authenticated backend
endpoints. Do not store confidential production or personal information in
this demo.

Run all repository tests from the root with `npm test`, or backend tests alone
with `npm test --prefix backend`. Tests mock classification and do not call
OpenAI.
