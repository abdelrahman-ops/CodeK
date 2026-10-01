# Mux Setup & Video Delivery Guide — CodeK

This document contains the complete audit and configuration reference for Mux video integration in CodeK.

---

## A. What is Already Implemented?

The CodeK codebase contains a production-ready, gated video pipeline:

1. **Environment Validation (`server/src/config/env.ts`)**:
   - Zod schema validates all Mux credentials at startup.
   - When `NODE_ENV=production` and `VIDEO_PROVIDER` contains `MUX`, the server enforces that `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY`, and `MUX_WEBHOOK_SECRET` are all provided. The server will refuse to start if any are missing.
   - Built-in key normalizer automatically decodes single-line Base64 keys, parses standard PEM headers, and handles escaped `\n` line breaks.

2. **Provider Factory Guard (`server/src/modules/videos/video-provider.factory.ts`)**:
   - Dynamically loads `MuxVideoProvider` when `VIDEO_PROVIDER=MUX`.
   - In production, falling back to the `MOCK` provider is strictly forbidden and throws a fatal error.

3. **Direct Uploads (`server/src/modules/videos/providers/mux-video.provider.ts`)**:
   - Backend calls `client.video.uploads.create()` with:
     - `playback_policy: ['signed']` (never public)
     - `cors_origin: '*'`
     - `passthrough: { lessonId, title }`
   - The browser streams binary video files directly to Mux via HTTP PUT. Video payloads never pass through Fastify.

4. **Idempotent Webhook Processing (`server/src/modules/videos/video.service.ts`)**:
   - Endpoint: `POST /api/v1/webhooks/mux`.
   - Raw request body is captured by `server/src/plugins/raw-body.ts` and verified against `mux-signature` using HMAC-SHA256 via `muxClient.webhooks.unwrap()`.
   - Handles `video.upload.asset_created`, `video.asset.ready`, and `video.asset.errored`.
   - Safe replacement logic: When replacing an existing video on a lesson, the old video remains active for students until the new video reaches `READY` status.

5. **Gated Signed Playback (`server/src/modules/videos/video.service.ts`)**:
   - Grade isolation (`curriculum-auth.ts`): Rejects requests from students belonging to other grades with `404 Not Found`.
   - Financial/attendance gating (`lesson-access.service.ts`): Rejects unauthorized students with `403 Forbidden`.
   - RS256 JWT generation: Backend signs short-lived tokens (1 to 4 hours) using Mux signing keys.

6. **Frontend Integration (`client/src/components/shared/`)**:
   - `admin-video-manager.tsx`: Direct upload with progress indicator.
   - `video-player.tsx`: Plays secure HLS streams using `@mux/mux-player-react`.

---

## B. What You Need to Create in Mux

### Required Variables Summary Table

| Variable | Required? | Where obtained | Exact Mux Dashboard location | Where I put it | Used for |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `VIDEO_PROVIDER` | **YES** | CodeK Configuration | N/A (Project configuration) | `server/.env` & Production Env | Activates Mux provider instead of Mock or Cloudflare |
| `MUX_TOKEN_ID` | **YES** | Mux Dashboard | `Mux Dashboard → Settings → Access Tokens` | `server/.env` & Production Env | Authenticates backend calls to Mux API |
| `MUX_TOKEN_SECRET` | **YES** | Mux Dashboard | `Mux Dashboard → Settings → Access Tokens` | `server/.env` & Production Env | Secret key for Mux API authentication |
| `MUX_SIGNING_KEY_ID` | **YES** | Mux Dashboard | `Mux Dashboard → Settings → Signing Keys` | `server/.env` & Production Env | Key identifier placed in JWT `kid` header for signed video playback |
| `MUX_SIGNING_PRIVATE_KEY` | **YES** | Mux Dashboard | `Mux Dashboard → Settings → Signing Keys` | `server/.env` & Production Env | 2048-bit RSA private key used by backend to sign playback JWTs |
| `MUX_WEBHOOK_SECRET` | **YES** | Mux Dashboard | `Mux Dashboard → Settings → Webhooks` | `server/.env` & Production Env | Verifies HMAC-SHA256 signature on incoming webhook events |

---

### Step-by-Step Dashboard Setup

#### 1. Mux API Access Token
1. Open [Mux Dashboard](https://dashboard.mux.com) → Click **Settings** (gear icon) → **Access Tokens**.
2. Click **Generate new token**.
3. Under permissions, select **Mux Video** with **Full Access** (Read + Write).
4. Copy:
   - **Token ID** → Put in `MUX_TOKEN_ID`
   - **Token Secret** → Put in `MUX_TOKEN_SECRET`
5. Store in `server/.env` (Local) and production environment variables.

#### 2. Mux Signing Key (RS256)
1. In Mux Dashboard, go to **Settings** → **Signing Keys**.
2. Click **Generate new key**.
3. Copy:
   - **Key ID** → Put in `MUX_SIGNING_KEY_ID`
   - **Private Key** → Put in `MUX_SIGNING_PRIVATE_KEY` (Accepts the raw Base64 string directly from Mux or PEM text).
4. Store in `server/.env` (Local) and production environment variables.

#### 3. Mux Webhook Endpoint
1. In Mux Dashboard, go to **Settings** → **Webhooks**.
2. Click **Create new webhook**.
3. Webhook URL:
   - **Local Testing**: `https://<your-ngrok-subdomain>.ngrok-free.dev/api/v1/webhooks/mux`
   - **Production**: `https://api.codek.edu.eg/api/v1/webhooks/mux` (matching `APP_BASE_URL`)
4. Select Events:
   - `video.upload.asset_created`
   - `video.asset.ready`
   - `video.asset.errored`
5. Copy:
   - **Signing Secret** → Put in `MUX_WEBHOOK_SECRET`
6. Store in `server/.env` (Local) and production environment variables.

---

## C. Exact Environment Variables

Add the following to `server/.env` (Local) and your production server environment:

```env
# =======================================================
# MUX VIDEO PROVIDER CONFIGURATION (CODEK)
# =======================================================
VIDEO_PROVIDER=MUX

# Mux API Access Token (Mux Dashboard -> Settings -> Access Tokens)
MUX_TOKEN_ID=<your-mux-token-id>
MUX_TOKEN_SECRET=<your-mux-token-secret>

# Mux Playback Signing Key (Mux Dashboard -> Settings -> Signing Keys)
MUX_SIGNING_KEY_ID=<your-mux-signing-key-id>
MUX_SIGNING_PRIVATE_KEY=<your-mux-signing-private-key-base64-or-pem>

# Mux Webhook Secret (Mux Dashboard -> Settings -> Webhooks)
MUX_WEBHOOK_SECRET=<your-mux-webhook-signing-secret>
```

> **Important**: `MUX_Environment_key` is NOT used anywhere in CodeK. You can delete it from your `.env`.

---

## D. Webhook Configuration Details

- **Full URL**: `https://YOUR_BACKEND_DOMAIN/api/v1/webhooks/mux`
- **Verification**: Fastify captures raw bytes (`request.rawBody`) before JSON parsing. `muxClient.webhooks.unwrap()` verifies the `mux-signature` header against `MUX_WEBHOOK_SECRET`.
- **Events Lifecycle**:
  1. `video.upload.asset_created`: Associates the created Mux `asset_id` with `VideoAsset` and sets status to `PROCESSING`.
  2. `video.asset.ready`: Extracts duration and signed `playback_id`, marks `VideoAsset` as `READY`, and atomically attaches it to the lesson.
  3. `video.asset.errored`: Sets `VideoAsset` status to `ERROR` with failure details and creates an audit log.

---

## E. What You Do NOT Need to Configure Manually

The application configures these automatically through code:

1. **CORS Origins**: Automatically set to `*` on upload creation.
2. **Playback Policy**: Programmatically set to `['signed']`.
3. **Lesson Association**: Passed automatically via upload `passthrough`.
4. **Token Expiration**: Calculated dynamically per lesson duration + 1 hour buffer (clamped between 3,600s and 14,400s).

---

## F. Production vs Local Differences

| Feature | Local (`server/.env`) | Production (`server/.env.production`) |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | `production` |
| `VIDEO_PROVIDER` | `MUX` | `MUX` |
| Webhook URL | Ngrok tunnel (`https://....ngrok-free.dev/api/v1/webhooks/mux`) | Public domain (`https://api.codek.edu.eg/api/v1/webhooks/mux`) |
| Zod Strict Check | Optional warnings | Strict: missing keys crash startup |

---

## G. Testing Checklist

1. **Admin Direct Upload**:
   - Go to `/admin/curriculum` → Select Grade 2 → Click Video on a lesson → Upload an MP4.
   - Browser streams directly to Mux via HTTP PUT.
2. **Webhook Confirmation**:
   - Check server logs: receives `video.upload.asset_created` and `video.asset.ready` with HTTP 200.
   - Database marks `VideoAsset.status = 'READY'` with signed `playbackId`.
3. **Student Playback**:
   - Log in as an enrolled Grade 2 student → Open lesson player → Video streams via signed Mux token.
4. **Security Isolation**:
   - Grade 1/3 student gets `404 Not Found`.
   - Unsubscribed student gets `403 Forbidden`.

---

## H. Why Mux Dashboard Shows "No public playback ID"

When an asset is uploaded in CodeK, its playback policy is **SIGNED**, not public.

In the Mux Dashboard preview window:
- A lock icon and **"No public playback ID for previewing"** is displayed.
- **This is the expected behavior.** It confirms that content protection is functioning properly and that the video cannot be accessed without an authorized, backend-signed token.
