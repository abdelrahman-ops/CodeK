# BullMQ + Redis Background Job System

This document describes the production-hardened background processing architecture for CodeK Academy using **BullMQ** and **Redis**.

---

## 1. Overview & Objectives

In CodeK Academy, operations such as sending transactional emails (SMTP) and handling video post-processing/cleanup (Mux) are decoupled from the HTTP request-response cycle using BullMQ and Redis to achieve:

- **Sub-100ms HTTP Response Times**: User registration, login, and webhook endpoints commit database state immediately and return without waiting for external network I/O.
- **Zero Secrets in Redis or BullMQ**: Redis payloads and job IDs contain **only non-secret reference IDs** (`authTokenId`). Plaintext OTP codes, password reset tokens, JWTs, and API credentials are never stored in Redis or emitted in logs.
- **Legitimate Resend Protection**: Deterministic job IDs are keyed by immutable record UUIDs (`authTokenId`), preventing deduplication from accidentally suppressing legitimate user resends while cleanly deduplicating network retries.
- **Fail-Loud Production Semantics**: If Redis is unavailable in production, operations critically depending on queueing fail explicitly (`QueueServiceUnavailableError` / HTTP 503) instead of silently swallowing errors or pretending jobs were queued.
- **Database-Backed Worker Idempotency**: Worker retries never produce duplicate audit logs, duplicate notifications, or corrupted lesson durations.
- **Mux Video Upload Safety**: Raw video bytes remain strictly between the browser and Mux. Redis holds only lightweight metadata. Video cleanup jobs target explicit provider asset IDs, never dynamically inferring "current" lesson video.
- **Horizontal Scalability**: The Fastify HTTP API and the BullMQ worker process are completely decoupled and scale independently.

---

## 2. Architecture & Security Boundary

```text
                                  ┌────────────────────────┐
                                  │       PostgreSQL       │
                                  │   (Source of Truth)    │
                                  │  - AuthToken           │
                                  │    - tokenHash (SHA)   │
                                  │    - encryptedToken*   │
                                  │    - status (PENDING)  │
                                  │  - VideoAsset          │
                                  └───────────▲────────────┘
                                              │
                         ┌────────────────────┴────────────────────┐
                         │                                         │
                   ┌─────┴─────┐                             ┌─────┴─────┐
                   │ Fastify   │                             │  Worker   │
                   │ API       │                             │ Process   │
                   │ (HTTP)    │                             │(src/worker│
                   └─────┬─────┘                             └─────▲─────┘
                         │                                         │
                         │ enqueue { email, authTokenId }          │ consume & decrypt
                         ▼                                         │
                   ┌─────────────────────────────────────────────────────┐
                   │                     Redis                           │
                   │  - Queue: email (payloads have NO secrets)          │
                   │  - Queue: video (payloads have NO video bytes)      │
                   └─────────────────────────────────────────────────────┘
                         │                                         │
                          ▼                                         ▼
                    Email Provider                            Mux / Provider
```

*\*Note: `encryptedToken` is encrypted at rest with AES-256-GCM using a dedicated `DELIVERY_ENCRYPTION_KEY` (independent of `JWT_SECRET`) and purged to `null` immediately upon delivery.*

### Cryptographic Delivery Key & Rotation Policy
- **Dedicated Key**: The encryption key is strictly derived from `DELIVERY_ENCRYPTION_KEY` (validated by Zod to be 32+ characters, or 64 hex chars). It is never derived from `JWT_SECRET`.
- **Key Rotation Considerations**: Rotating `DELIVERY_ENCRYPTION_KEY` requires draining or completing all pending email jobs in BullMQ first. Any pending `AuthToken` records whose `encryptedToken` was encrypted under the old key will fail decryption (`decryptDeliverySecret` returns `null`), dropping the un-deliverable job safely rather than crashing the worker.

### Crash & Retry Semantics (At-Least-Once Delivery)
The background email delivery model provides **at-least-once delivery with safe application state**:
- **Execution Order**:
  1. Worker loads `AuthToken` by `authTokenId` from PostgreSQL.
  2. If `status !== 'PENDING'` or `expiresAt < now` or `encryptedToken === null`, worker drops/skips the job.
  3. Worker decrypts secret and transmits email to provider.
  4. Worker updates PostgreSQL: sets `encryptedToken: null`.
- **Crash Scenario**: If the worker crashes *after* sending the email but *before* setting `encryptedToken: null`:
  - BullMQ retries the job according to the exponential backoff policy.
  - The worker re-reads the record and sends the email a second time.
  - The recipient receives a duplicate email, but the authentication secret and hash in PostgreSQL are **identical and safe**.
  - Worker successfully clears `encryptedToken: null`.
- **State Invariant**: The worker NEVER marks an `AuthToken` as verified or alters its `status`. Verification occurs exclusively when the user interacts with the API synchronously.

---

## 3. Queue Design & Secret-Free Payloads

CodeK Academy uses exactly **two queues**:

### 1. `email` Queue

Responsible for asynchronous email delivery.

| Job Type | Deterministic Job ID | Payload (Zero Plaintext Secrets) | Worker Action |
| :--- | :--- | :--- | :--- |
| `EMAIL_VERIFICATION` | `verify_${authTokenId}` | `{ email, authTokenId, studentName }` | Fetches `AuthToken` from Postgres, verifies `status === 'PENDING'`, decrypts code via AES-256-GCM, calls `EmailService`, and purges `encryptedToken: null`. |
| `ADMIN_LOGIN_OTP` | `admin_otp_${authTokenId}` | `{ email, authTokenId, adminName }` | Fetches `AuthToken` from Postgres, verifies `status === 'PENDING'`, decrypts OTP, calls `EmailService`, and purges `encryptedToken: null`. |
| `PASSWORD_RESET` | `reset_${authTokenId}` | `{ email, authTokenId, userName }` | Fetches `AuthToken` from Postgres, decrypts reset token, constructs link, dispatches email, and purges `encryptedToken: null`. |
| `CUSTOM_MAIL` | `custom_${to}_${hash}` | `{ to, subject, text, html }` | Dispatches generic transactional announcements (non-secret). |

### 2. `video` Queue

Responsible for asynchronous video lifecycle orchestration around Mux.

| Job Type | Deterministic Job ID | Payload | Worker Action |
| :--- | :--- | :--- | :--- |
| `VIDEO_READY` | `video_ready_${videoAssetId}_${providerVideoId}` | `{ videoAssetId, providerVideoId, playbackId, durationSeconds, targetLessonId, replacesAssetId }` | Idempotently synchronizes lesson durations and writes audit logs (checks existing log before insertion). |
| `VIDEO_FAILED` | `video_failed_${videoAssetId}_${providerVideoId}` | `{ videoAssetId, providerVideoId, errorMessage }` | Idempotently logs processing failure to audit log. |
| `VIDEO_CLEANUP` | `video_cleanup_${provider}_${providerVideoId}` | `{ provider, providerVideoId, videoAssetId }` | Asynchronously calls Mux SDK to delete the **exact specified `providerVideoId`** with retry support. |

---

## 4. Deterministic Job IDs & Resend Protection

A naive job ID strategy (e.g. `verify_${email}`) suppresses legitimate user resends because BullMQ deduplicates any job with the same ID.

In CodeK:
1. **Verification**:
   - User registers $\rightarrow$ `AuthToken` record created with UUID `id_1` $\rightarrow$ Job ID: `verify_id_1`.
   - User requests resend $\rightarrow$ New `AuthToken` record created with UUID `id_2` $\rightarrow$ Job ID: `verify_id_2`.
   - **Result**: The resend is enqueued and delivered immediately without collision.
2. **Password Reset**:
   - User requests reset $\rightarrow$ `AuthToken` created with UUID `id_1` $\rightarrow$ Job ID: `reset_id_1`.
   - User requests reset again $\rightarrow$ `AuthToken` created with UUID `id_2` $\rightarrow$ Job ID: `reset_id_2`.
   - **Result**: Second legitimate request succeeds.
3. **Deduplication Boundary**:
   - If an automated retry or duplicate HTTP request attempts to enqueue the *exact same challenge* (`id_1`), BullMQ deduplicates it and does not send duplicate emails.

---

## 5. Offline Fallback Semantics

| Environment | Behavior When Redis Is Unavailable | Rationale |
| :--- | :--- | :--- |
| **Production** (`NODE_ENV === 'production'`) | **Fails Loudly**: Throws `QueueServiceUnavailableError` (HTTP 503). Never silently sends synchronously or pretends the job was queued. | Prevents silent latency spikes on HTTP workers, ensures monitoring alarms trigger immediately, and forces webhooks (e.g. Mux) to retry automatically via standard exponential backoff. |
| **Development & Test** (`NODE_ENV !== 'production'`) | **Isolated Fallback**: Dispatches email directly with explicit `console.warn` log. | Enables local developer onboarding and offline mock testing without requiring a live Redis daemon. |

---

## 6. Worker Idempotency Guarantees

Mux webhooks can be duplicated and BullMQ jobs can retry after network interruptions. The `VIDEO_READY` worker is safe against partial failure:

```text
Mux READY webhook
        ↓
VIDEO_READY job
        ↓
worker starts
        ↓
lesson duration syncs (Idempotent: PostgreSQL update)
        ↓
worker crashes before audit log completes
        ↓
BullMQ retries job
        ↓
worker checks PostgreSQL: audit log already exists?
        ├── YES → skip insertion (no duplicate)
        └── NO  → insert audit log
```

- **Lesson Duration**: Updating `videoDurationSeconds` in PostgreSQL is naturally idempotent.
- **Audit Logging**: Uses database-backed existence query checking `(action, entityType, entityId, metadata.videoAssetId)` before inserting.
- **No In-Memory Flags**: Idempotency is persisted entirely in PostgreSQL.

---

## 7. Video Cleanup Safety

When an admin deletes or replaces an existing video:
1. The cleanup job payload explicitly specifies the exact provider asset to delete:
   ```typescript
   {
     provider: 'MUX',
     providerVideoId: 'mux_old_asset_123'
   }
   ```
2. The worker strictly calls `videoProvider.deleteVideo(providerVideoId)`.
3. The worker **never** queries `prisma.lesson` or guesses the "current video". If a new video `mux_new_asset_456` has already been attached to the lesson, the cleanup job targeting `mux_old_asset_123` cannot accidentally delete the new asset.

---

## 8. Queue Failure Semantics & Reliability Boundaries

PostgreSQL and Redis do not form a 2-phase commit distributed transaction. The system semantics are explicitly defined:

1. **Student Registration**:
   - `User`, `Student`, and `AuthToken` commit to PostgreSQL first.
   - Enqueue to BullMQ occurs immediately after.
   - If Redis is down: Endpoint throws HTTP 503. User sees "Failed to send verification email. Please try again."
   - **Client Recovery**: User requests verification resend (`POST /api/v1/auth/verify-email/resend`). The resend generates a new `AuthToken` and enqueues once Redis is restored.
2. **Admin 2FA Login**:
   - Password verified and `AuthToken` generated.
   - If Redis is down: Returns HTTP 503.
   - **Client Recovery**: Admin clicks "Resend OTP" after cooldown expires.
3. **Mux Webhook**:
   - `VideoAsset` status is updated to `READY` in PostgreSQL.
   - If Redis is down: Webhook endpoint throws HTTP 500/503.
   - **Provider Recovery**: Mux automatically retries delivery of the webhook with exponential backoff for up to 24 hours. When Redis recovers, the webhook retry is processed and enqueued.

---

## 9. Local Development & Operational Commands

### 1. Start Infrastructure via Docker Compose
```bash
docker compose up -d
```
Starts:
- PostgreSQL 16 on `localhost:5432` (`coding_lab_postgres`)
- Redis 7 on `localhost:6379` (`coding_lab_redis`)

### 2. Start API Server (Terminal 1)
```bash
npm run dev
```

### 3. Start Background Worker (Terminal 2)
```bash
npm run dev:worker
```
Or in production:
```bash
npm run worker
```

### 4. Run Real Local Runtime Verification
```bash
npx tsx scripts/verify-real-runtime.ts
```
Performs end-to-end verification of PostgreSQL, Redis, Worker consumption, OTP decryption, DB secret purge, and graceful shutdown.
