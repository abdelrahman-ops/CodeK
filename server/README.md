# CodeK Backend API Server

Fastify + TypeScript + Prisma + PostgreSQL backend service powering the CodeK Academy platform.

---

## 🛠️ Architecture & Technologies

- **Fastify v4**: High-performance HTTP server
- **Prisma ORM**: Type-safe PostgreSQL client with declarative data modeling
- **Nodemailer**: Email delivery service with Gmail preset & custom SMTP transport
- **JWT & Crypto**: Short-lived Access Tokens (15m), rotating Refresh Tokens (7d), and hashed One-Time Passwords (SHA-256)
- **Vitest**: Integration and unit testing suite with in-memory Fastify injections

---

## ⚙️ Environment Variables (`.env`)

Create a `.env` file in `/server` based on `.env.example`:

```env
# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Database (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/codek?schema=public"

# JWT Secrets
JWT_SECRET="super-secret-jwt-key"
JWT_REFRESH_SECRET="super-secret-refresh-key"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Default Admin Credentials
ADMIN_LOGIN_ID="ADM-001"
ADMIN_EMAIL="admin@codek.local"
ADMIN_PASSWORD="AdminPassword@123"
ADMIN_NAME="Admin Name"

# Email / SMTP Configuration (for 2FA OTPs)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="CodeK Academy <your-email@gmail.com>"
```

---

## 📦 Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start Fastify in development mode with `tsx watch` |
| `npm run build` | Compile TypeScript into `/dist` |
| `npm start` | Run compiled production bundle |
| `npm test` | Run Vitest test suite (50 tests) |
| `npm run db:push` | Sync Prisma schema with the PostgreSQL database |
| `npm run db:seed:admin` | Seed **Admin account only** from `.env` (for production) |
| `npm run db:seed` | Seed full development dataset (Admin, Students, Parents, Groups, etc.) |
| `npm run db:studio` | Launch Prisma Studio GUI |

---

## 🔒 Security Specifications

1. **Admin 2FA Verification**:
   - Step 1: `POST /api/v1/auth/login` checks credentials and issues a 5-minute temporary token + sends a 6-digit OTP code to the admin's email.
   - Step 2: `POST /api/v1/auth/verify-2fa` validates the hashed OTP code, marks it used, and generates the real session tokens.
2. **Physical Payment IDOR Protection**:
   - `GET /api/v1/payments/student/:studentId` enforces RBAC:
     - `ADMIN`: Access any student's billing history.
     - `STUDENT`: Access only their own records (`req.user.studentId === studentId`).
     - `PARENT`: Access only linked children through `ParentStudent` relationship.
3. **Session Token Rotation**:
   - Refresh tokens are hashed in the database and rotated on each `/auth/refresh` invocation. Replay attempts immediately revoke tokens.
