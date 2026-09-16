# CodeK Academy — Production Deployment & Operations Guide

## 1. Production Architecture & Topology

CodeK Academy uses a production-tested modular monolith architecture:

```
[ Students / Admins / Parents ]
             │ (HTTPS)
             ▼
┌─────────────────────────────────────────────────────────┐
│              Frontend: Single Page Application          │
│   • React 18, TypeScript, Vite 5, TailwindCSS          │
│   • Hosting: Vercel (or Cloudflare Pages / AWS S3+CF)   │
│   • Domain: https://app.codek.edu.eg                    │
└──────────────────────────┬──────────────────────────────┘
                           │ (REST API / Bearer + HttpOnly Cookie)
                           ▼
┌─────────────────────────────────────────────────────────┐
│               Backend: Fastify Modular Monolith         │
│   • Node.js runtime, Fastify 4, Prisma 7, Zod           │
│   • Hosting: Container/VM (Docker/Render/Railway/ECS)   │
│     or Vercel Serverless (via server/vercel.json)       │
│   • Domain: https://api.codek.edu.eg                    │
└────────────┬─────────────────────────────┬──────────────┘
             │ (Pooled Connection via pg)   │ (Server-to-Server Webhook)
             ▼                             ▼
┌─────────────────────────┐   ┌───────────────────────────┐
│  Database: PostgreSQL   │   │  Payment Gateway: Paymob  │
│  • Host: Neon (AWS) /   │   │  • Intention API v1       │
│    AWS RDS / Supabase   │   │  • HMAC-SHA512 Webhook    │
│  • SSL required         │   │  • 250 EGP / 30 Days      │
└─────────────────────────┘   └───────────────────────────┘
```

### Recommended Production Topology
- **Frontend**: Vercel (`client/vercel.json`), rewritten to `/index.html` for SPA client-side routing.
- **Backend**: Container / Cloud VM running `node dist/server.js` (or Vercel Serverless via `server/vercel.json`).
- **Database**: Managed PostgreSQL (e.g., Neon AWS `us-east-2` with connection pooler and SSL).
- **Video**: Cloudflare Stream (`VIDEO_PROVIDER=CLOUDFLARE_STREAM`) with signed playback tokens or `EXTERNAL` for vetted HTTPS embeds.
- **Payments**: Paymob Accept Egypt (`PAYMENT_PROVIDER=paymob`) with server-to-server webhook confirmation.
- **Domains & Origins**:
  - Frontend: `https://app.codek.edu.eg`
  - Backend API: `https://api.codek.edu.eg`

---

## 2. Prerequisites
- **Node.js**: `v20.x` or `v22.x` LTS.
- **PostgreSQL**: PostgreSQL 15+ with SSL enabled.
- **Domain Names**: With TLS/SSL certificates provisioned (Let's Encrypt, Cloudflare, or AWS ACM).
- **Paymob Account**: Merchant account on `accept.paymob.com` with Card and Mobile Wallet integrations.
- **Video Host**: Cloudflare Stream account with API token and signing keys.

---

## 3. Environment Variables Reference

### Backend (`server/.env`)

| Variable | Classification | Description / Value |
| :--- | :--- | :--- |
| `NODE_ENV` | REQUIRED_PRODUCTION | Must be set to `production`. |
| `PORT` | OPTIONAL_PRODUCTION | Server port (default `3000`). |
| `HOST` | OPTIONAL_PRODUCTION | Bind address (`0.0.0.0`). |
| `DATABASE_URL` | REQUIRED_PRODUCTION, SECRET | PostgreSQL connection string with `?sslmode=require`. |
| `JWT_SECRET` | REQUIRED_PRODUCTION, SECRET | Strong random secret (>=32 chars) for access tokens. |
| `JWT_REFRESH_SECRET`| REQUIRED_PRODUCTION, SECRET | Strong distinct random secret (>=32 chars) for refresh tokens. |
| `JWT_EXPIRES_IN` | OPTIONAL_PRODUCTION | Access token lifetime (default `15m`). |
| `JWT_REFRESH_EXPIRES_IN` | OPTIONAL_PRODUCTION | Refresh token lifetime (default `30d`). |
| `CORS_ORIGIN` | REQUIRED_PRODUCTION | Comma-separated allowed origins (e.g. `https://app.codek.edu.eg`). Wildcards (`*`) are rejected. |
| `COOKIE_SAMESITE` | OPTIONAL_PRODUCTION | `lax` (same site apex) or `none` (cross-site with HTTPS). |
| `DB_POOL_MAX` | OPTIONAL_PRODUCTION | Max pool connections (default `10`). |
| `DB_POOL_IDLE_TIMEOUT_MS` | OPTIONAL_PRODUCTION | Idle connection timeout in ms (default `30000`). |
| `DB_POOL_CONNECTION_TIMEOUT_MS` | OPTIONAL_PRODUCTION | Connection acquisition timeout in ms (default `5000`). |
| `VIDEO_PROVIDER` | REQUIRED_PRODUCTION | `CLOUDFLARE_STREAM` or `EXTERNAL`. (Mock provider is forbidden in production). |
| `CLOUDFLARE_STREAM_ACCOUNT_ID` | REQUIRED_PRODUCTION (if CF) | Cloudflare account ID. |
| `CLOUDFLARE_STREAM_API_TOKEN` | REQUIRED_PRODUCTION (if CF) | Cloudflare Stream API token. |
| `CLOUDFLARE_STREAM_KEY_ID` | REQUIRED_PRODUCTION (if CF) | Cloudflare signed key ID. |
| `CLOUDFLARE_STREAM_KEY_PEM` | REQUIRED_PRODUCTION (if CF) | Cloudflare private key PEM. |
| `PAYMENT_PROVIDER` | REQUIRED_PRODUCTION | Set to `paymob`. |
| `PAYMOB_SECRET_KEY` | REQUIRED_PRODUCTION, SECRET | Paymob live secret key (`egy_sk_live_...`). |
| `PAYMOB_PUBLIC_KEY` | REQUIRED_PRODUCTION, PUBLIC | Paymob live public key (`egy_pk_live_...`). |
| `PAYMOB_HMAC_SECRET`| REQUIRED_PRODUCTION, SECRET | Paymob webhook HMAC secret. |
| `PAYMOB_INTEGRATION_ID_CARD` | REQUIRED_PRODUCTION | Paymob card integration ID. |
| `PAYMOB_INTEGRATION_ID_WALLET` | OPTIONAL_PRODUCTION | Paymob wallet integration ID. |
| `PAYMOB_API_BASE` | OPTIONAL_PRODUCTION | `https://accept.paymob.com`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | OPTIONAL_PRODUCTION | SMTP credentials for transactional 2FA OTP and onboarding emails. |

### Frontend (`client/.env`)

| Variable | Classification | Description / Value |
| :--- | :--- | :--- |
| `VITE_API_URL` | REQUIRED_PRODUCTION, PUBLIC | Full URL to backend API v1 (e.g. `https://api.codek.edu.eg/api/v1`). |

> ⚠️ **CRITICAL SECURITY NOTE**: Never embed backend secrets (JWT keys, DB URL, Paymob secret key, HMAC secret) in client environment variables.

---

## 4. Database Setup & Migration Procedure

### Rule 1: Production Migrations Are Strictly Forward-Only
In production, database migrations MUST be applied using:
```bash
cd server
npx prisma migrate deploy
```

> 🚫 **NEVER RUN IN PRODUCTION**:
> - `npx prisma db push` (destroys migration consistency and can cause silent data loss)
> - `npx prisma migrate reset` (drops database tables entirely)
> - `npx prisma db seed` (wipes tables; blocked by production fail-safe)

### Pre-Deployment Migration Verification
Before deploying new code:
```bash
# Verify schema syntax
npx prisma validate

# Check migration status
npx prisma migrate status
```

---

## 5. Production Admin Provisioning

To provision the initial administrator in production without data wiping or password resets:

```bash
cd server
ADMIN_LOGIN_ID=ADM-001 \
ADMIN_EMAIL=admin@codek.edu.eg \
ADMIN_PASSWORD="StrongProductionPassword123!" \
ADMIN_NAME="Abdelrahman Ataa" \
npm run db:bootstrap:admin
```

### Safety Invariants:
1. **Create-If-Missing**: If an admin with the same login ID or email exists, the script exits safely without touching the account or password.
2. **Strong Password Requirement**: Enforces >=12 chars with uppercase, lowercase, numbers, and symbols.
3. **No Credential Logging**: Zero passwords or tokens printed to logs.
4. **Zero Data Deletion**: Does not truncate or modify any existing table.

---

## 6. Paymob Webhook Configuration

1. In Paymob Dashboard (`https://accept.paymob.com`), navigate to **Developers** → **Payment Integrations**.
2. Set the **Transaction Processed Callback (Server-to-Server)** URL:
   ```text
   https://api.codek.edu.eg/api/v1/billing/webhook/paymob
   ```
3. Set the **Transaction Response Callback (Redirect)** URL:
   ```text
   https://app.codek.edu.eg/student/subscription?payment=complete
   ```
4. Copy the **HMAC Secret** from Paymob dashboard into `PAYMOB_HMAC_SECRET`.
5. Verify that `POST /api/v1/billing/webhook/paymob` is accessible from Paymob IP ranges.

### Key Architectural Invariants:
- The redirect URL (`/student/subscription?payment=complete`) is **informative only**. It NEVER confirms payments or activates access.
- The webhook callback is the **sole authoritative source of truth**.
- Webhook verification uses **timing-safe HMAC-SHA512**.
- Duplicate webhooks are deduplicated idempotently via `providerEventId`.
- Amount and currency are validated strictly (250 EGP / 25000 piasters).

---

## 7. Video Provider Configuration

### Option A: Cloudflare Stream (Recommended)
1. Set `VIDEO_PROVIDER=CLOUDFLARE_STREAM`.
2. Configure Cloudflare Stream credentials in `server/.env`.
3. Videos are streamed via signed time-limited tokens generated server-side.
4. Unsubscribed students or expired accounts are blocked at the API layer (`/api/v1/lessons/:id/playback`).

### Option B: External Video Provider
1. Set `VIDEO_PROVIDER=EXTERNAL`.
2. Allows vetted HTTPS video URLs (YouTube, Vimeo, CDN).
3. Entitlement gating remains enforced server-side before playback URLs are returned.

> 🚫 The `MOCK` video provider throws an immediate fatal error if invoked in production.

---

## 8. Health Checks & Observability

Fastify exposes two dedicated probe endpoints:

### Liveness Probe (`GET /health`)
- **Purpose**: Verifies the Node.js process is responsive.
- **Expected Status**: `200 OK`
- **Response**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-09-04T04:00:00.000Z",
    "env": "production"
  }
  ```

### Readiness Probe (`GET /ready`)
- **Purpose**: Verifies that critical dependencies (PostgreSQL) are operational before routing traffic.
- **Expected Status**: `200 OK` (or `503 Service Unavailable` on DB failure).
- **Response (Ready)**:
  ```json
  {
    "status": "ready",
    "timestamp": "2026-09-04T04:00:00.000Z",
    "database": "connected"
  }
  ```
- **Response (Unavailable)**:
  ```json
  {
    "status": "not_ready",
    "timestamp": "2026-09-04T04:00:00.000Z",
    "database": "disconnected"
  }
  ```

---

## 9. Backup & Disaster Recovery Strategy

| Area | Status | Policy / Procedure |
| :--- | :--- | :--- |
| **PostgreSQL Snapshots** | REQUIRED CONFIGURATION | Configure automated daily snapshots with minimum 14-day retention in managed database console. |
| **Point-in-Time Recovery (PITR)** | REQUIRED CONFIGURATION | Enable WAL-based PITR (e.g. Neon or AWS RDS) to allow restoration to any second within retention window. |
| **Manual Backup Command** | VERIFIED | `pg_dump -Fc -h $DB_HOST -U $DB_USER -d $DB_NAME > codek_backup_$(date +%Y%m%d).dump` |
| **Restore Procedure** | VERIFIED | `pg_restore --clean --if-exists -h $DB_HOST -U $DB_USER -d $DB_NAME backup_file.dump` |
| **Migration Rollback** | VERIFIED | Apply a forward migration to revert schema changes (expand-and-contract pattern). Never run `prisma migrate reset`. |
| **Code Rollback** | VERIFIED | Re-deploy previous immutable container image tag or Vercel deployment ID. |

---

## 10. Post-Deployment Smoke Test Execution

Run the deterministic smoke test suite against the deployed target:

```bash
cd server
API_URL=https://api.codek.edu.eg npm run smoke-test
```

### Verification Checklist:
- [ ] `GET /` returns `200 OK` with `status: "online"`
- [ ] `GET /health` returns `200 OK` with `status: "healthy"`
- [ ] `GET /ready` returns `200 OK` with `database: "connected"`
- [ ] `POST /api/v1/auth/login` rejects invalid credentials with `401`
- [ ] `POST /api/v1/billing/webhook/paymob` rejects missing/tampered HMAC with `403`
- [ ] Student login receives access token + HttpOnly Secure cookie
- [ ] Locked premium lesson returns `allowed: false, reason: "SUBSCRIPTION_REQUIRED"`
- [ ] Free lesson preview returns `allowed: true, reason: "FREE_PREVIEW"`
