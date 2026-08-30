# CodeK (Coding Lab) — Programming Academy Platform

A production-ready management platform and learning portal for an Egyptian Programming Academy. Built with a modern, secure, and performant monorepo architecture.

---

## 🏗️ Architecture Overview

The project is structured as a full-stack monorepo:

```text
Coding-Lab/
├── server/                 # Backend API (Fastify + TypeScript + Prisma + PostgreSQL)
│   ├── prisma/             # Database Schema, Migrations & Seed Scripts
│   ├── src/
│   │   ├── common/         # Auth middlewares, RBAC, error handlers, rate limiting
│   │   ├── config/         # Environment schema (Zod) & database clients
│   │   ├── modules/        # Domain modules (auth, students, parents, groups, attendance, tasks, exams, payments, gamification, etc.)
│   │   └── services/       # Email (Nodemailer SMTP/Gmail), QR codes, audit logs
│   └── tests/              # Vitest automated test suite (50 integration/security tests)
│
├── client/                 # Modern Frontend Web App (React 18 + Vite + Tailwind CSS + Zustand)
│   ├── src/
│   │   ├── components/     # Reusable UI component library (Cards, Modals, Buttons, Tables)
│   │   ├── context/        # Auth Context & Session Management
│   │   ├── hooks/          # Custom utility and data-fetching hooks
│   │   ├── i18n/           # Full Bilingual Support (Arabic RTL & English LTR)
│   │   ├── lib/            # Axios API client & localized formatting helpers
│   │   ├── pages/          # Admin, Student, Parent, and Auth portals
│   │   └── store/          # Zustand global state (Theme, Language, UI)
│   └── public/             # Static brand assets and icons
```

---

## ⚡ Tech Stack

### Backend (`/server`)
- **Runtime & Framework**: Node.js, [Fastify](https://fastify.dev/) with TypeScript
- **Database & ORM**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Security & Auth**:
  - Admin Two-Factor Authentication (Email OTP via Nodemailer with Gmail preset)
  - Role-Based Access Control (`ADMIN`, `STUDENT`, `PARENT`)
  - Cryptographic token hashing (SHA-256) for refresh tokens and OTPs
  - Strict Rate Limiting (`@fastify/rate-limit`) & Helmet headers
  - In-person payment IDOR authorization barriers
- **Testing**: [Vitest](https://vitest.dev/) with Fastify injection testing

### Frontend (`/client`)
- **Framework & Build**: React 18, [Vite](https://vitejs.dev/) with TypeScript
- **Styling & UI**: Tailwind CSS, Lucide Icons, Glassmorphic and responsive dark/light theme
- **State & Data**: [Zustand](https://github.com/pmndrs/zustand) for global state, [TanStack React Query](https://tanstack.com/query) for server caching
- **Localization**: `i18next` with full **Arabic (RTL)** and **English (LTR)** parity

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18.x or higher)
- PostgreSQL (v14+ running locally or in the cloud)
- npm or pnpm

### 1. Backend Setup

```bash
cd server

# Copy environment template
cp .env.example .env

# Edit .env with your PostgreSQL credentials & SMTP settings:
# DATABASE_URL="postgresql://user:pass@localhost:5432/codek"
# SMTP_USER="your-email@gmail.com"
# SMTP_PASS="your-google-app-password"

# Install dependencies
npm install

# Run database migrations and generate Prisma client
npm run db:push
npm run db:generate

# Option A: Seed clean Admin account only (Recommended for Production)
npm run db:seed:admin

# Option B: Seed full development demo dataset
npm run db:seed

# Run tests
npm test

# Start development server
npm run dev
```

The API server will be live at `http://localhost:3000` (Swagger docs at `http://localhost:3000/docs`).

---

### 2. Frontend Setup

```bash
cd client

# Copy environment template
cp .env.example .env

# Install dependencies
npm install

# Build for production
npm run build

# Start frontend dev server
npm run dev
```

The web application will be live at `http://localhost:5173`.

---

## 🔐 Authentication & Roles

1. **Admin Portal**:
   - Enforces **2FA Verification**: Login ID + Password $\rightarrow$ 6-digit verification code sent via Email $\rightarrow$ Authenticated Session.
   - Manages curricula, class groups, attendance roster via QR code, assignment submissions, manual physical tuition payments, exams, and student credentials.
2. **Student Portal**:
   - Login with unique `STU-XXXX` code.
   - Forced password change on initial login.
   - Access unlocked session materials, submit homework tasks, take auto-graded exams, and track XP / streak gamification.
3. **Parent Portal**:
   - Login with linked `PAR-XXXX` credentials.
   - View only linked children (enforced at database and API levels).
   - Real-time visibility into attendance records, submission reviews, tuition status, and exam grades.

---

## 📜 License

Private & Proprietary — Developed for CodeK Academy.
