# CodeK Frontend Client Web Application

React 18 + Vite + Tailwind CSS + Zustand web portal for the CodeK Academy platform.

---

## ✨ Features

- 🌐 **Full Bilingual Support**: Instant switching between English (LTR) and Arabic (RTL) with localized layouts and typography.
- 🌓 **Adaptive Dark / Light Themes**: Polished glassmorphism design with system preference detection.
- 🛡️ **Role-Based Portals**:
  - **Admin Command Center**: Roster QR scanning, tuition payments, curriculum editor, task reviews, exam designer, and audit logs.
  - **Student Space**: Unlocked lessons, assignment submissions, auto-graded quizzes, XP level progression, streak counter, and monthly masked leaderboard.
  - **Parent Dashboard**: Real-time progress monitoring for enrolled children with attendance reports and tuition tracking.
- ⚡ **Optimistic & Resilient Data Fetching**: TanStack React Query caching with auto-retry and offline resilience.

---

## ⚙️ Environment Variables (`.env`)

```env
# API URL (Relative '/api/v1' proxies through Vite dev server to Fastify)
VITE_API_URL=/api/v1
```

---

## 📦 Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Launch Vite development server at `http://localhost:5173` |
| `npm run build` | Build optimized production bundle to `/dist` |
| `npm run preview` | Preview production build locally |

---

## 🚀 Production Build

To create the production build:

```bash
npm run build
```

The output in `/dist` is ready to be served by any static web server (Nginx, Caddy, Cloudflare Pages, Vercel, etc.) or served via Fastify static assets.
