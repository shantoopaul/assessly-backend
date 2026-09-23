# Assessly Backend

> A production-grade **Developer Assessment Platform** API — where reviewers create timed coding assessments, candidates pay via Stripe and attempt them, and reviewers evaluate submissions with a full audit trail.

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7.x-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7+-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Stripe](https://img.shields.io/badge/Stripe-API-635BFF?logo=stripe&logoColor=white)](https://stripe.com/)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Live API](#-live-api)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Roles & Permissions](#-roles--permissions)
- [Core Features](#-core-features)
- [Database Schema](#-database-schema)
- [API Documentation](#-api-documentation)
- [Postman Collection](#-postman-collection)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Stripe Setup](#-stripe-setup)
- [Demo Credentials](#-demo-credentials)
- [Testing the End-to-End Flow](#-testing-the-end-to-end-flow)
- [Project Structure](#-project-structure)
- [Engineering Decisions](#-engineering-decisions)
- [Security](#-security)
- [Performance](#-performance)
- [Deployment](#-deployment)
- [Scripts](#-scripts)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🎯 Overview

**Assessly** is a backend platform that solves a real-world problem: **how do companies assess developer candidates fairly, securely, and at scale?**

Instead of scattered Google Forms and manual scoring, Assessly provides a single system where:

1. **Reviewers** create timed assessments with MCQ, text, and code questions
2. **Candidates** enroll, pay via Stripe, and attempt under a strict timer
3. **Reviewers** claim submissions, grade free-form answers, and issue pass/fail verdicts
4. **Admins** manage users, monitor platform stats, and audit every critical action

The backend is **fully headless** — no UI required. All functionality is exercised via the documented REST API.

### Why this project?

It demonstrates:

- ✅ **Multi-role RBAC** with three distinct actors and strictly enforced boundaries
- ✅ **Payment integration** with real Stripe Checkout + webhook verification
- ✅ **Complex state machines** — `AttemptStatus`, `PaymentStatus`, `AssessmentStatus`
- ✅ **Concurrency safety** via Prisma transactions and serializable isolation
- ✅ **Soft deletes + audit logs** for compliance-style traceability
- ✅ **Redis caching** for hot read paths (assessment listings)
- ✅ **Strict validation** at every layer with Zod

---

## 🌐 Live API

| Environment | Base URL |
|---|---|
| **Production** | `https://assessly-backend-hxtz.onrender.com/api/v1` |
| **Local** | `http://localhost:5000/api/v1` |

**Health check:** `GET /health`

```bash
curl https://assessly-backend-hxtz.onrender.com/health
```

> ⚠️ Deployed on Render's free tier — the first request after inactivity may take ~30s to cold-start.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js 20+ | JavaScript runtime |
| Language | TypeScript (ESM) | Type safety across the codebase |
| Framework | Express 5 | HTTP server + routing |
| Database | PostgreSQL 16 | Primary relational store |
| ORM | Prisma 7 (multi-file schema) | Type-safe DB access + migrations |
| Validation | Zod 4 | Runtime input validation |
| Auth | JWT (access + refresh), bcryptjs | Stateless auth with revocable sessions |
| Social Login | google-auth-library | Google ID token verification |
| Cache | Redis 6 | Assessment listing cache |
| Payments | Stripe | Checkout Sessions + PaymentIntents + webhooks |
| Email | Nodemailer | Transactional emails (SMTP) |
| File Uploads | Multer + Cloudinary | Avatar uploads |
| Rate Limiting | express-rate-limit | Abuse prevention |
| Security | Helmet, CORS | Headers + origin control |
| Linting | Biome | Fast lint + format |
| Build | tsup | ESM/CJS bundler for production |
| Dev Runner | tsx | Instant TS execution |

---

## 🏗️ Architecture

The project follows a **modular, layered architecture** where each feature lives in its own folder:

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────┐
│  Route Layer (.route.ts)                    │  ← Route definitions + middleware chains
├─────────────────────────────────────────────┤
│  Validation Layer (.validation.ts)          │  ← Zod schemas
├─────────────────────────────────────────────┤
│  Controller Layer (.controller.ts)          │  ← Request/response shaping
├─────────────────────────────────────────────┤
│  Service Layer (.service.ts)                │  ← Business logic, transactions
├─────────────────────────────────────────────┤
│  Data Layer (Prisma)                        │  ← PostgreSQL access
└─────────────────────────────────────────────┘
    │
    ▼
Structured JSON Response
```

**Cross-cutting concerns:**

- `middleware/auth.ts` — Bearer token verification + RBAC
- `middleware/validateRequest.ts` — Zod body/params/query validation
- `middleware/globalErrorHandler.ts` — Central error → HTTP mapping
- `middleware/rateLimiter.ts` — Global + auth-specific rate limits
- `utils/audit.ts` — Fire-and-forget audit logging
- `utils/cache.ts` — Redis cache helpers

---

## 👥 Roles & Permissions

The platform has **three distinct roles**, enforced via `auth(...roles)` middleware on every protected route.

### 🟢 CANDIDATE

- Register / login (email + Google)
- Browse published assessments
- Enroll in assessments (free or paid)
- Attempt assessments (timed, answers auto-saved)
- Submit attempts, view results and reviewer feedback
- Manage own profile and avatar

### 🔵 REVIEWER

Everything a candidate can *view*, plus:

- Create and manage own assessments
- Add / update / soft-delete questions
- Publish assessments (requires ≥ 1 question with points)
- Claim submitted attempts from the queue
- Grade free-form answers and issue PASS/FAIL verdicts
- View own assigned reviews

### 🔴 ADMIN

Everything a reviewer can do, plus:

- Manage **all** users (list, filter, search)
- Block / unblock users (revokes sessions)
- Change user roles (revokes sessions)
- Soft-delete users (blocked if active work)
- View dashboard statistics
- View full audit log

### Permission Matrix

| Action | Candidate | Reviewer | Admin |
|---|:---:|:---:|:---:|
| Register / Login | ✅ | ✅ | ✅ |
| Browse published assessments | ✅ | ✅ | ✅ |
| Enroll in assessment | ✅ | ❌ | ❌ |
| Attempt assessment | ✅ | ❌ | ❌ |
| Create assessment | ❌ | ✅ (own) | ✅ (all) |
| Add / edit questions | ❌ | ✅ (own) | ✅ (all) |
| Publish assessment | ❌ | ✅ (own) | ✅ (all) |
| Claim attempt for review | ❌ | ✅ | ❌ |
| Evaluate attempt | ❌ | ✅ | ❌ |
| Manage users | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ✅ |
| View dashboard stats | ❌ | ❌ | ✅ |

---

## ✨ Core Features

### 🔐 Authentication & Sessions

- Email/password registration and login
- Google Sign-In (ID token verification via `google-auth-library`)
- **Dual-token JWT strategy:**
  - Short-lived access token (15 min) — sent as `Authorization: Bearer`
  - Long-lived refresh token (7 days) — exchanged for new pairs
- **Revocable sessions** via `tokenVersion` — bump on logout, block, or role change
- Password hashing with bcrypt (`BCRYPT_SALT_ROUNDS = 12`)

### 📝 Assessment Lifecycle

```
DRAFT ─────► PUBLISHED ─────► ARCHIVED
  │             │                 ▲
  │             │                 │ (soft delete)
  ▼             ▼                 │
(edit freely)  (content locked   │
                after first       │
                attempt)          │
```

- **DRAFT** — fully editable, not visible to candidates
- **PUBLISHED** — visible to candidates; editing blocked once an attempt exists
- **ARCHIVED** — read-only; soft-deleted assessments land here

### ❓ Question Types

- **MCQ** — auto-scored (compares response to `correctAnswer`)
- **TEXT** — manually scored by a reviewer
- **CODE** — manually scored by a reviewer (stored as text; execution out of scope)

### 🎯 Attempt State Machine

```
PENDING_PAYMENT ──(payment success)──► READY
                                        │
                                        ▼
                                   IN_PROGRESS ──(submit)──► SUBMITTED
                                                                 │
                                                                 ▼
                                                            UNDER_REVIEW
                                                                 │
                                                                 ▼
                                                              EVALUATED
```

Attempts are:
- **Timed** — `expiresAt` computed from `durationMinutes` on start
- **Sequential** — auto-incremented `attemptNo` per (candidate, assessment)
- **Race-safe** — enrollment uses serializable transactions

### 💳 Stripe Integration

Two supported flows:

**1. Checkout Session (recommended for web)**
```
POST /payments/attempts/:attemptId/checkout
  → returns checkoutUrl
  → user pays on Stripe
  → Stripe webhook fires checkout.session.completed
  → Payment → SUCCEEDED, Attempt → READY
```

**2. PaymentIntent (for custom UIs / mobile)**
```
POST /payments/attempts/:attemptId/initiate
  → returns clientSecret
  → frontend confirms with Stripe.js
  → webhook fires payment_intent.succeeded
  → Payment → SUCCEEDED, Attempt → READY
```

**Handled webhook events:**
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `payment_intent.processing`

### 👀 Review Workflow

1. Candidate submits → attempt status = `SUBMITTED`
2. Reviewer lists `/reviews/queue` → sees unclaimed attempts
3. Reviewer claims → **atomic** `updateMany` prevents double-claiming → `UNDER_REVIEW`
4. Reviewer grades non-MCQ answers → `POST /reviews/:attemptId/evaluate`
5. System computes `finalScore` (0-100), determines PASS/FAIL vs `passingScore`, sets `EVALUATED`

### 📊 Admin Operations

- Paginated, searchable, filterable user list
- Block / unblock (increments `tokenVersion` → all sessions revoked)
- Change roles (same revocation behavior)
- **Guarded by business rules** — cannot block yourself, cannot delete users with active work
- Dashboard stats: user counts, published assessments, attempt totals, payment gross
- Full audit log with actor details, filterable by action and entity type

### 🧾 Audit Logging

Every critical action writes to `AuditLog`:

- `AUTH_REGISTER`, `AUTH_LOGIN`, `AUTH_GOOGLE_LOGIN`, `AUTH_LOGOUT`
- `ASSESSMENT_CREATE`, `ASSESSMENT_PUBLISH`, `ASSESSMENT_UPDATE`, `ASSESSMENT_SOFT_DELETE`
- `QUESTION_CREATE`, `QUESTION_UPDATE`, `QUESTION_SOFT_DELETE`
- `ATTEMPT_ENROLL`, `ATTEMPT_START`, `ATTEMPT_SUBMIT`
- `PAYMENT_INITIATE`, `PAYMENT_CONFIRM`, `CHECKOUT_SESSION_CREATED`
- `REVIEW_CLAIM`, `REVIEW_EVALUATE`
- `ADMIN_USER_STATUS_UPDATE`, `ADMIN_USER_ROLE_UPDATE`, `ADMIN_USER_SOFT_DELETE`
- `PROFILE_UPDATE`, `PROFILE_AVATAR_UPDATE`

---

## 🗄️ Database Schema

Prisma schema is **split into multiple files** under `prisma/schema/` for readability.

### Entities

| Entity | Description |
|---|---|
| `User` | All actors (candidate / reviewer / admin) |
| `Assessment` | Assessment metadata + config |
| `Question` | MCQ / TEXT / CODE with options and correct answer |
| `Attempt` | A candidate's attempt at an assessment |
| `Answer` | A single answer within an attempt |
| `Review` | Reviewer's final verdict on an attempt |
| `Payment` | Stripe payment record for an attempt |
| `AuditLog` | Immutable trail of critical actions |

### Relationships

```
User (1) ──► (N) Assessment           [author]
User (1) ──► (N) Attempt              [candidate]
User (1) ──► (N) Attempt              [reviewer]
User (1) ──► (N) Review
User (1) ──► (N) Payment
User (1) ──► (N) AuditLog

Assessment (1) ──► (N) Question
Assessment (1) ──► (N) Attempt

Attempt (1) ──► (N) Answer
Attempt (1) ──► (0..1) Payment
Attempt (1) ──► (0..1) Review

Question (1) ──► (N) Answer
```

### Enums

| Enum | Values |
|---|---|
| `Role` | `CANDIDATE`, `REVIEWER`, `ADMIN` |
| `UserStatus` | `ACTIVE`, `BLOCKED` |
| `AssessmentStatus` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `Difficulty` | `JUNIOR`, `MID`, `SENIOR` |
| `QuestionType` | `MCQ`, `TEXT`, `CODE` |
| `AttemptStatus` | `PENDING_PAYMENT`, `READY`, `IN_PROGRESS`, `SUBMITTED`, `UNDER_REVIEW`, `EVALUATED`, `CANCELLED` |
| `PaymentStatus` | `PENDING`, `REQUIRES_ACTION`, `SUCCEEDED`, `FAILED`, `CANCELLED` |
| `ReviewDecision` | `PASS`, `FAIL` |

### Key Indexes

Optimized for the queries that actually run:

- `Assessment(status, deletedAt, createdAt)` — listing published assessments
- `Assessment(difficulty, status)` — filtering by difficulty
- `Attempt(candidateId, status, createdAt)` — candidate's own attempts
- `Attempt(reviewerId, status)` — reviewer's queue
- `Attempt(assessmentId, status)` — per-assessment stats
- `Payment(userId, status, createdAt)` — payment history
- `User(role, status, deletedAt)` — admin user management
- `AuditLog(action, createdAt)` — audit filtering

### Constraints

- **Unique:** `User.email`, `User.googleId`, `Assessment.slug`, `Payment.stripePaymentIntentId`, `Payment.stripeCheckoutSessionId`, `Review.attemptId`, `Payment.attemptId`
- **Composite unique:** `(candidateId, assessmentId, attemptNo)`, `(attemptId, questionId)`, `(assessmentId, order)`
- **Foreign keys:** Restrict on user/assessment deletion; Cascade on answers; SetNull on reviewer

---

## 📡 API Documentation

**Base URL:** `{BASE_URL}/api/v1`

**Total endpoints:** **40+** across 9 resource groups.

### Response Format

**Success:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { },
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "path": "body.email", "message": "Invalid email address" }
  ]
}
```

### Endpoint Groups

| # | Group | Base Path | Auth |
|---|---|---|---|
| 1 | Authentication | `/auth` | Public |
| 2 | User Profile | `/users` | Any role |
| 3 | Assessments (Public) | `/assessments` | Public |
| 4 | Assessments (Manage) | `/assessments/manage` | REVIEWER / ADMIN |
| 5 | Questions | `/assessments/:id/questions` | REVIEWER / ADMIN |
| 6 | Attempts | `/attempts` | CANDIDATE |
| 7 | Payments | `/payments` | CANDIDATE / ADMIN |
| 8 | Reviews | `/reviews` | REVIEWER |
| 9 | Admin | `/admin` | ADMIN |

### Quick Reference

<details>
<summary><b>🔐 Authentication</b> (5 endpoints)</summary>

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new candidate |
| `POST` | `/auth/login` | Email/password login |
| `POST` | `/auth/google` | Google ID token login |
| `POST` | `/auth/refresh-token` | Rotate access + refresh tokens |
| `POST` | `/auth/logout` | Revoke all sessions |

</details>

<details>
<summary><b>👤 User Profile</b> (3 endpoints)</summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/users/me` | Get authenticated user's profile |
| `PATCH` | `/users/me` | Update profile (name) |
| `PATCH` | `/users/me/avatar` | Upload avatar (multipart) |

</details>

<details>
<summary><b>📚 Assessments — Public</b> (2 endpoints)</summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/assessments` | List published (paginated, filterable, cached) |
| `GET` | `/assessments/:id` | Get published assessment by ID |

</details>

<details>
<summary><b>🛠️ Assessments — Manage</b> (6 endpoints)</summary>

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/assessments` | Create assessment (DRAFT) |
| `GET` | `/assessments/manage/mine` | List managed assessments |
| `GET` | `/assessments/manage/:id` | Full managed detail |
| `PATCH` | `/assessments/:id` | Update assessment |
| `PATCH` | `/assessments/:id/publish` | Publish assessment |
| `DELETE` | `/assessments/:id` | Soft delete |

</details>

<details>
<summary><b>❓ Questions</b> (3 endpoints)</summary>

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/assessments/:id/questions` | Add question (MCQ / TEXT / CODE) |
| `PATCH` | `/assessments/:id/questions/:questionId` | Update question |
| `DELETE` | `/assessments/:id/questions/:questionId` | Soft delete question |

</details>

<details>
<summary><b>🎯 Attempts</b> (6 endpoints)</summary>

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/attempts/enroll/:assessmentId` | Enroll in an assessment |
| `GET` | `/attempts/my` | List own attempts |
| `GET` | `/attempts/:attemptId` | Get own attempt detail |
| `POST` | `/attempts/:attemptId/start` | Start attempt (starts timer) |
| `PUT` | `/attempts/:attemptId/answers/:questionId` | Save/update an answer |
| `POST` | `/attempts/:attemptId/submit` | Submit attempt |

</details>

<details>
<summary><b>💳 Payments</b> (5 + 1 webhook endpoints)</summary>

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/payments/attempts/:attemptId/checkout` | Create Stripe Checkout Session |
| `POST` | `/payments/attempts/:attemptId/initiate` | Create PaymentIntent |
| `POST` | `/payments/:paymentId/confirm` | Confirm PaymentIntent |
| `GET` | `/payments/attempts/:attemptId` | Get payment by attempt |
| `GET` | `/payments/:paymentId` | Get payment by ID |
| `POST` | `/payments/webhook` | Stripe webhook (raw body) |

</details>

<details>
<summary><b>📝 Reviews</b> (5 endpoints)</summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/reviews/queue` | Unclaimed submitted attempts |
| `GET` | `/reviews/mine` | Assigned to me |
| `GET` | `/reviews/:attemptId` | Review detail with answers |
| `POST` | `/reviews/:attemptId/claim` | Atomically claim |
| `POST` | `/reviews/:attemptId/evaluate` | Submit scores + verdict |

</details>

<details>
<summary><b>👑 Admin</b> (6 endpoints)</summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/users` | List users (paginated, filtered) |
| `PATCH` | `/admin/users/:userId/status` | Block / unblock |
| `PATCH` | `/admin/users/:userId/role` | Change role |
| `DELETE` | `/admin/users/:userId` | Soft delete |
| `GET` | `/admin/stats` | Dashboard stats |
| `GET` | `/admin/audit-logs` | Audit log (paginated) |

</details>

---

## 📮 Postman Collection

The complete Postman collection is included in `docs/postman/`:

- **Collection:** `docs/postman/Assessly Backend API.postman_collection.json`

### 📖 Public Postman Docs

👉 **[View interactive Postman documentation](https://documenter.getpostman.com/view/55072385/2sBYB2rnKS)**

### Import Steps

1. Open Postman → **File → Import**
2. Drop both JSON files
3. Select the **"Assessly - Local"** environment (top-right dropdown)
4. Start the backend (`npm run dev`) and seed users (`npm run seed`)
5. Run requests in order — auth tokens and resource IDs are **auto-saved** to environment

### Features of the Collection

- ✅ All 40+ endpoints organized into 9 folders
- ✅ Request descriptions with auth, body fields, and expected responses
- ✅ **Automated test scripts** — every request asserts status code and response shape
- ✅ **Auto token capture** — login requests save role-specific tokens
- ✅ **Auto ID capture** — create/enroll requests save IDs for downstream requests
- ✅ Environment files for local + production

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 6+ (optional — gracefully degrades without it)
- Stripe account (test mode is fine)
- Cloudinary account (optional — for avatar uploads)
- Google Cloud OAuth client (optional — for Google login)

### Installation

```bash
# 1. Clone
git clone https://github.com/shantoopaul/assessly-backend.git
cd assessly-backend

# 2. Install dependencies
npm install

# 3. Copy env template
cp .env.example .env

# 4. Fill in .env (see Environment Variables section)

# 5. Generate Prisma client
npx prisma generate

# 6. Run migrations
npx prisma migrate deploy

# 7. Seed demo users
npm run seed

# 8. Start development server
npm run dev
```

Server runs at **`http://localhost:5000`**.

Verify:
```bash
curl http://localhost:5000/health
# {"success":true,"message":"API is healthy","data":{"uptime":1.23}}
```

---

## 🔑 Environment Variables

Create a `.env` file at the project root. Full reference:

```bash
# ─── Server ─────────────────────────────────────────────
NODE_ENV="development"
PORT=5000

# ─── Database ───────────────────────────────────────────
DATABASE_URL="postgres://user:password@host:5432/assessly"

# ─── JWT ────────────────────────────────────────────────
JWT_ACCESS_SECRET="at-least-32-characters-long-random-string"
JWT_REFRESH_SECRET="at-least-32-characters-long-different-string"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
BCRYPT_SALT_ROUNDS=12

# ─── CORS ───────────────────────────────────────────────
FRONTEND_URL="http://localhost:5000"
# Comma-separated for multiple origins, or "*" for all

# ─── Google OAuth (optional) ────────────────────────────
GOOGLE_CLIENT_ID="xxxxx.apps.googleusercontent.com"

# ─── Seed credentials ───────────────────────────────────
TESTER_ADMIN_NAME="Tester Admin 1"
TESTER_ADMIN_EMAIL="testeradmin@gmail.com"
TESTER_ADMIN_PASSWORD="Tester@admin12345"

TESTER_REVIEWER_NAME="Tester Reviewer 1"
TESTER_REVIEWER_EMAIL="testerreviewer@gmail.com"
TESTER_REVIEWER_PASSWORD="Tester@reviewer12345"

TESTER_CANDIDATE_NAME="Tester Candidate 1"
TESTER_CANDIDATE_EMAIL="testercandidate@gmail.com"
TESTER_CANDIDATE_PASSWORD="Tester@candidate12345"

# ─── Redis (optional) ───────────────────────────────────
REDIS_URL="redis://localhost:6379"

# ─── Cloudinary (optional — avatar uploads) ─────────────
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

# ─── SMTP / Nodemailer (optional) ───────────────────────
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-google-app-password"
EMAIL_SENDER="your-email@gmail.com"

# ─── Stripe (required for payments) ─────────────────────
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_RETURN_URL="http://localhost:3000/payment/return"
STRIPE_SUCCESS_URL="http://localhost:3000/api/v1/payments/checkout/success?session_id={CHECKOUT_SESSION_ID}"
STRIPE_CANCEL_URL="http://localhost:3000/api/v1/payments/checkout/cancel"
```

> ⚠️ **Never commit `.env`.** All values are validated with Zod on boot — the server will refuse to start if any required var is missing or malformed.

---

## 💳 Stripe Setup

### 1. Get your test keys

1. Go to [Stripe Dashboard → Developers → API Keys](https://dashboard.stripe.com/test/apikeys)
2. Copy **Secret key** → `STRIPE_SECRET_KEY`

### 2. Set up webhooks locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe   # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward events to your local server
stripe listen --forward-to localhost:5000/api/v1/payments/webhook
```

The CLI prints a `whsec_...` — paste it into `STRIPE_WEBHOOK_SECRET`.

### 3. Test cards

| Card Number | Scenario |
|---|---|
| `4242 4242 4242 4242` | ✅ Successful payment |
| `4000 0025 0000 3155` | 🔐 Requires 3D Secure |
| `4000 0000 0000 9995` | ❌ Insufficient funds |
| `4000 0000 0000 0002` | ❌ Generic decline |

Use any **future expiry**, any **CVC**, any **ZIP**.

### 4. Production webhook

In Stripe Dashboard → **Developers → Webhooks → Add endpoint**:
- **URL:** `https://your-app.onrender.com/api/v1/payments/webhook`
- **Events:** `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `payment_intent.processing`

Copy the signing secret into your production `STRIPE_WEBHOOK_SECRET`.

---

## 🔐 Demo Credentials

Seeded via `npm run seed`. Use these to evaluate the API immediately.

| Role | Email | Password |
|---|---|---|
| 🟥 **Admin** | `testeradmin@gmail.com` | `Tester@admin12345` |
| 🔵 **Reviewer** | `testerreviewer@gmail.com` | `Tester@reviewer12345` |
| 🟢 **Candidate** | `testercandidate@gmail.com` | `Tester@candidate12345` |

> ⚠️ These are **demo-only** credentials meant for evaluation. The seed script is idempotent — running it again updates existing users.

---

## 🧪 Testing the End-to-End Flow

Follow this sequence in the Postman collection to test the full lifecycle:

### 1. Authenticate all three roles

```
1.2a Login (Admin)      → saves adminAccessToken
1.2b Login (Reviewer)   → saves reviewerAccessToken
1.2c Login (Candidate)  → saves candidateAccessToken
```

### 2. Reviewer creates an assessment

```
4.1 Create Assessment        → saves assessmentId
5.1 Add Question (MCQ)       → saves questionId
5.2 Add Question (TEXT)
5.3 Add Question (CODE)
4.5 Publish Assessment
```

### 3. Candidate enrolls and pays

```
6.1 Enroll in Assessment     → saves attemptId, status = PENDING_PAYMENT
7.1 Create Checkout Session  → saves paymentId, prints checkoutUrl
   ↳ Open checkoutUrl in browser
   ↳ Pay with 4242 4242 4242 4242
   ↳ Stripe webhook fires → attempt status = READY
```

### 4. Candidate attempts

```
6.4 Start Attempt            → status = IN_PROGRESS, timer starts
6.5 Save Answer  (×N)        → repeat for each question
6.6 Submit Attempt           → status = SUBMITTED, autoScore computed
```

### 5. Reviewer evaluates

```
8.1 Get Review Queue         → saves attemptId
8.2 Claim Attempt            → status = UNDER_REVIEW
8.3 Get Review Attempt       → copy answerIds from console
8.5 Evaluate Attempt         → status = EVALUATED, PASS/FAIL set
```

### 6. Candidate views result

```
6.3 Get My Attempt           → includes finalScore, passed, review.feedback
```

### 7. Admin checks stats

```
9.5 Dashboard Stats          → user counts, payment gross, etc.
9.6 Audit Logs               → full action history
```

---

## 📁 Project Structure

```
assessly-backend/
├── biome.json                    # Linter + formatter config
├── package.json
├── prisma7.config.ts             # Prisma 7 multi-file schema config
├── tsconfig.json
├── tsup.config.ts                # Build config
├── .env.example
│
├── docs/
│   └── postman/
│       ├── Assessly-API.postman_collection.json
│       ├── Assessly-Local.postman_environment.json
│       └── Assessly-Production.postman_environment.json
│
├── prisma/
│   ├── seed.ts
│   ├── migrations/
│   │   ├── migration_lock.toml
│   │   └── 20260921142138_init/
│   │       └── migration.sql
│   └── schema/
│       ├── schema.prisma          # generator + datasource
│       ├── enums.prisma           # all enums
│       ├── user.prisma
│       ├── assessment.prisma
│       ├── question.prisma
│       ├── attempt.prisma         # Attempt + Answer + Review
│       ├── payment.prisma
│       └── audit-log.prisma
│
└── src/
    ├── app.ts                     # Express app + middleware + webhook route
    ├── server.ts                  # Boot: DB → Redis → listen → graceful shutdown
    │
    ├── config/
    │   └── index.ts               # Zod-validated env
    │
    ├── lib/                       # Third-party clients
    │   ├── prisma.ts              # Prisma + pg adapter
    │   ├── redis.ts
    │   ├── stripe.ts
    │   ├── cloudinary.ts
    │   ├── google.ts
    │   └── nodemailer.ts
    │
    ├── middleware/
    │   ├── auth.ts                # Bearer + RBAC
    │   ├── validateRequest.ts     # Zod body/params/query
    │   ├── globalErrorHandler.ts
    │   ├── notFound.ts
    │   ├── rateLimiter.ts
    │   └── upload.ts              # Multer for avatars
    │
    ├── modules/                   # Feature modules
    │   ├── auth/                  # controller / route / service / validation
    │   ├── users/
    │   ├── assessments/
    │   ├── attempts/
    │   ├── payments/
    │   ├── reviews/
    │   └── admin/
    │
    ├── routes/
    │   └── index.ts               # Mounts all module routers
    │
    ├── types/
    │   └── express/
    │       └── index.d.ts         # Express Request augmentation
    │
    └── utils/
        ├── AppError.ts            # Custom error class
        ├── catchAsync.ts          # Async wrapper
        ├── sendResponse.ts        # Standard response shape
        ├── pagination.ts
        ├── token.ts               # JWT sign/verify
        ├── audit.ts               # writeAuditLog
        ├── cache.ts               # Redis helpers
        ├── getAuthenticatedUser.ts
        ├── getRouteParam.ts
        └── seed.ts
```

---

## 🧠 Engineering Decisions

### Why dual JWTs (access + refresh)?

Single long-lived tokens are a security risk. Dual JWTs let us keep access tokens short-lived (15 min, stateless) while still allowing server-side revocation of refresh tokens via `tokenVersion`.

### Why `tokenVersion` for revocation?

JWTs are stateless — you can't "delete" one. Bumping `tokenVersion` on the user record invalidates every refresh token issued before the bump. On block/role-change/logout, we simply increment it.

### Why serializable transactions on enroll?

Two concurrent enroll requests from the same candidate could both pass the "no active attempt" check and create duplicate attempts. We use `Serializable` isolation + a retry-on-conflict path for `P2034` errors.

### Why a separate `Answer` table (not JSON on Attempt)?

Per-answer scoring, feedback, and reviewer grades need column-level access. JSON would work but lose indexes, constraints, and query ergonomics.

### Why soft deletes everywhere?

Real assessment platforms need audit history. Deleting an assessment that had attempts would break referential integrity and reporting. `deletedAt` preserves everything.

### Why split Prisma schema into files?

A single 300-line schema is painful to navigate. Prisma 7 supports multi-file schemas natively — one file per domain.

### Why is the Stripe webhook mounted before `express.json()`?

Stripe signature verification requires the **raw** request body. We mount `express.raw({ type: "application/json" })` for `/payments/webhook` before the global JSON parser.

### Why cache only published assessment listings?

Those are the hot path — candidates browse them constantly. Writes (create/update/publish) invalidate via `clearAssessmentCache()`. Caching everything else would be premature.

---

## 🔒 Security

- **Password hashing** — bcrypt with cost factor 12
- **JWT secrets** — minimum 32 chars, validated by Zod
- **Rate limiting** — 300 req/15min globally, 30 req/15min on auth routes
- **Helmet** — sensible security headers
- **CORS** — configured from `FRONTEND_URL` with `credentials: true`
- **Input validation** — Zod schemas on every mutating endpoint
- **RBAC** — `auth(...roles)` middleware on every protected route
- **Session revocation** — `tokenVersion` bump on block / logout / role change
- **Guarded admin actions** — cannot block/delete self, cannot delete users with active work
- **Stripe webhook verification** — signature checked with `STRIPE_WEBHOOK_SECRET`
- **Soft deletes** — no accidental data loss
- **Audit logs** — immutable trail of critical actions
- **No secrets in code** — all config from env, validated on boot

---

## ⚡ Performance

- **Database indexes** — on every column used in `WHERE` / `ORDER BY`
- **Prisma `select`** — only fields that the response needs
- **Pagination** — capped at `limit=100` on all list endpoints
- **Redis caching** — 60s TTL on published assessment listings, invalidated on write
- **Serializable transactions** — only where truly needed (enroll, evaluate)
- **`Promise.all` in transactions** — `prisma.$transaction([...])` batches reads
- **Connection pooling** — via `@prisma/adapter-pg`
- **Graceful degradation** — Redis absence doesn't crash the API

---

## ☁️ Deployment

### Deployed on Render

1. **Create a PostgreSQL database** on Render → copy the **Internal Database URL**
2. **Create a Redis instance** on Render → copy the connection string
3. **Create a Web Service** → connect your GitHub repo
4. **Configure:**
   - **Build Command:** `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. **Add environment variables** — same as `.env.example`, with production values
6. **Update Stripe webhook** URL to `https://your-service.onrender.com/api/v1/payments/webhook`
7. **Seed users once** — open a Render Shell and run `npm run seed`

### Post-deploy checks

```bash
curl https://your-service.onrender.com/health
curl https://your-service.onrender.com/api/v1/assessments
```

Log in as admin via Postman and hit `/admin/stats` to verify DB connectivity.

---

## 📜 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (tsx watch) |
| `npm run build` | Bundle with tsup → `dist/` |
| `npm start` | Run production build from `dist/server.js` |
| `npm run seed` | Seed demo users (idempotent) |
| `npm run lint` | Run Biome check on `src/` and `prisma/` |
| `npm run format` | Auto-format with Biome |

### Prisma commands

```bash
npx prisma generate           # Regenerate client after schema changes
npx prisma migrate dev        # Create + apply migration (dev)
npx prisma migrate deploy     # Apply migrations (prod)
npx prisma studio             # Open Prisma Studio GUI
```
