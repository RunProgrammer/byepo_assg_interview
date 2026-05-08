# Multi-Tenant Feature Flag Management System

Built for Byepo Technologies technical assessment.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Compose                        │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Super Admin  │    │  Org Admin   │    │   End User   │  │
│  │  (Next.js)   │    │  (Next.js)   │    │  (Next.js)   │  │
│  │  port 3001   │    │  port 3002   │    │  port 3003   │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
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
- **Auth**: Custom JWT (bcrypt + jsonwebtoken)
- **Infra**: Docker + Docker Compose

## Running the Project

### Option A — Docker (recommended, one command)

Prerequisites: Docker + Docker Compose installed.

```bash
# Clone the repo
git clone <repo-url>
cd byepo-feature-flags

# Start everything
docker compose up --build
```

That's it. Docker will:
1. Start PostgreSQL
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

# Create a .env file (copy from .env.example or edit .env directly)
# Set DATABASE_URL to your local postgres connection string

npx prisma migrate dev --name init
node prisma/seed.js
npm run dev
# Backend runs on http://localhost:3000
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

Change these via environment variables: `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`.

---

## Typical Flow

1. **Super Admin** logs in at `:3001` → creates an organization (e.g. "Acme Corp")
2. **Org Admin** signs up at `:3002` → picks "Acme Corp" → creates feature flags (e.g. `dark_mode`, `beta_dashboard`)
3. **End User** signs up at `:3003` → picks "Acme Corp" → checks if `dark_mode` is enabled

---

## API Reference

```
POST /auth/login              { email, password }
POST /auth/signup             { email, password, orgId, role }

GET  /super/organizations     → list all orgs
POST /super/organizations     { name }

GET    /admin/flags           → list flags for admin's org
POST   /admin/flags           { featureKey, isEnabled }
PATCH  /admin/flags/:id       { isEnabled?, featureKey? }
DELETE /admin/flags/:id

POST /user/flags/check        { featureKey } → { featureKey, isEnabled }
```

---

## Self-Assessment

| Category | Score | Notes |
|---|---|---|
| Performance | 7/10 | In-memory cache on flag check endpoint (60s TTL, org-scoped invalidation). Would use Redis for multi-instance. |
| Readability | 8/10 | Routes → Services separation, Zod validation, consistent error shapes. |
| Stability | 7/10 | Input validation on all endpoints, org-scoped DB queries from JWT (never client), unique constraint at DB level. |
| Testability | 6/10 | Cache service is pure and unit-testable. Routes need supertest integration tests — skipped for time. |

## Trade-offs & What I'd Do Differently

- **Cache**: Moved to Redis for horizontal scaling. Current Map cache is per-process.
- **Org selection at signup**: In production, orgs would be invite-based rather than a public dropdown.
- **Refresh tokens**: Current JWT is long-lived (7d). Would add refresh token rotation for production.
- **Frontend state**: Would add a proper state manager (Zustand) for larger apps. localStorage for JWT is fine at this scale.
