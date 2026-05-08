# Multi-Tenant Feature Flag Management System

Built for Byepo Technologies technical assessment.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Compose                       │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Super Admin  │    │  Org Admin   │    │   End User   │   │
│  │  (Next.js)   │    │  (Next.js)   │    │  (Next.js)   │   │
│  │  port 3001   │    │  port 3002   │    │  port 3003   │   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘   │
│         │                   │                   │           │
│         └───────────────────┼───────────────────┘           │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │  Express API    │                      │
│                    │  (Node.js)      │                      │
│                    │  port 3000      │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │   PostgreSQL    │                      │
│                    │   port 5432     │                      │
│                    └─────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## Stack

- **Backend**: Node.js + Express + Prisma ORM
- **Database**: PostgreSQL 16
- **Frontend x3**: Next.js 14 (App Router) + Tailwind CSS
- **Auth**: Custom JWT with refresh token rotation (bcrypt + jsonwebtoken)
- **Infra**: Docker + Docker Compose

## Running the Project

### Option A — Docker (recommended, one command)

Prerequisites: Docker + Docker Compose installed.

```bash
git clone <repo-url>
cd byepo-feature-flags

docker compose up --build
```

Docker will automatically:
1. Start PostgreSQL and wait for it to be healthy
2. Run Prisma migrations
3. Seed the super admin account
4. Start all four services

| App | URL |
|---|---|
| Backend API | http://localhost:3000 |
| Super Admin | http://localhost:3001 |
| Org Admin | http://localhost:3002 |
| End User | http://localhost:3003 |

---

### Option B — Local Development (no Docker)

Prerequisites: Node.js 20+, PostgreSQL running locally.

**1. Backend**

```bash
cd backend
npm install

# Edit .env — set DATABASE_URL to your local postgres connection string

npx prisma migrate dev --name init
node prisma/seed.js
npm run dev
# Runs on http://localhost:3000
```

**2. Super Admin Frontend**

```bash
cd frontend-super-admin
npm install
npm run dev
# Runs on http://localhost:3001
```

**3. Org Admin Frontend**

```bash
cd frontend-org-admin
npm install
npm run dev
# Runs on http://localhost:3002
```

**4. End User Frontend**

```bash
cd frontend-end-user
npm install
npm run dev
# Runs on http://localhost:3003
```

---

## Default Credentials

Super Admin is seeded automatically on first run:

| Field | Value |
|---|---|
| Email | admin@byepo.com |
| Password | superadmin123 |

Configurable via environment variables: `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`.

---

## Typical Flow

1. **Super Admin** logs in at `:3001` → creates an organization (e.g. "Acme Corp")
2. **Org Admin** signs up at `:3002` → selects "Acme Corp" → creates feature flags (e.g. `dark_mode`, `beta_dashboard`)
3. **End User** signs up at `:3003` → selects "Acme Corp" → checks if `dark_mode` is enabled for their org

---

## API Reference

```
POST /auth/login                   { email, password } → { accessToken, refreshToken }
POST /auth/signup                  { email, password, orgId, role } → { accessToken, refreshToken }
POST /auth/refresh                 { refreshToken } → { accessToken, refreshToken }
POST /auth/logout                  { refreshToken }

GET  /super/organizations/public   → [ { id, name } ]   (no auth — for signup dropdowns)
GET  /super/organizations          → full list with counts (SUPER_ADMIN only)
POST /super/organizations          { name }
DELETE /super/organizations/:id

GET    /admin/flags                → flags scoped to admin's org
POST   /admin/flags                { featureKey, isEnabled }
PATCH  /admin/flags/:id            { isEnabled?, featureKey? }
DELETE /admin/flags/:id

POST /user/flags/check             { featureKey } → { featureKey, isEnabled }
```

---

## Key Technical Decisions

**Refresh token rotation**
Every `/auth/refresh` call is single-use — the old token is deleted from the DB and a new pair is issued. If a refresh token is stolen and used, the legitimate user's next request invalidates the attacker's token and forces re-login. Tokens are stored in the `refresh_tokens` table with expiry timestamps; logout explicitly deletes the token making it immediately invalid server-side.

**Flag check caching**
`/user/flags/check` is the hot-read path. Responses are cached in a `Map` with a 60-second TTL using the key `${orgId}:${featureKey}`. Any create, update, or delete on a flag triggers `invalidateOrgCache(orgId)` which purges all entries for that org. This keeps reads fast without serving stale data after mutations.

**org_id always from JWT, never from client**
Every admin and user route derives `orgId` from `req.user` (set by the auth middleware from the verified JWT). Client-supplied org IDs are ignored entirely. This prevents a user from querying or mutating flags belonging to another org.

**DB-level uniqueness**
`(featureKey, orgId)` has a `@@unique` constraint in Prisma. Two orgs can both have `dark_mode` — but one org cannot have it twice. Application-level checks alone aren't sufficient since concurrent requests could bypass them; the DB constraint is the final guarantee.

**Public org listing**
`/super/organizations/public` returns only `id` and `name` — the minimum needed for signup dropdowns. The full `/super/organizations` endpoint (which includes user counts, flag counts, and timestamps) stays behind SUPER_ADMIN auth. This avoids exposing operational data while keeping signup UX smooth.

---

## Self-Assessment

| Category | Score | Notes |
|---|---|---|
| Performance | 7/10 | In-memory Map cache on flag check endpoint (60s TTL, org-scoped invalidation on every mutation). Single-use refresh token rotation with DB-backed invalidation. Would use Redis for cache in multi-instance deployments. |
| Readability | 8/10 | Routes → Services separation, Zod validation on all inputs, consistent error shapes across all endpoints. |
| Stability | 7/10 | Input validation on all endpoints, org-scoped DB queries from JWT (never client), unique constraint at DB level, cascade delete for org removal. |
| Testability | 6/10 | Cache service is pure and unit-testable. Routes need supertest integration tests — skipped for time. |

---

## Trade-offs & What I'd Do Differently

**Cache**
Current Map cache is per-process — works correctly for a single instance but would serve inconsistent data if the backend scaled horizontally. Redis with org-scoped key namespacing would solve this and is the natural next step.

**Org selection at signup**
Currently a public dropdown — any user can see org names and sign up for any org. In production this would be invite-based: super admin generates a signup token scoped to an org, which is the only way to join it.

**Refresh token storage**
Implemented single-use rotation — each `/auth/refresh` call invalidates the old token and issues a new pair, so stolen refresh tokens are mitigated on the next legitimate use. HTTP-only cookies would be a stronger storage mechanism over `localStorage` in a production browser client, as they're not accessible to JavaScript and are immune to XSS token theft.

**Frontend state**
`localStorage` for tokens is acceptable at this scale and keeps the implementation simple. For a larger app, Zustand or a similar state manager would handle token expiry, auto-refresh coordination, and shared auth state more cleanly across components.

**Cascade deletes**
Currently handled in application code (delete flags → delete users → delete org). In production, `onDelete: Cascade` in the Prisma schema would push this to the DB layer and make it atomic, eliminating the window where a partial delete could leave orphaned records.