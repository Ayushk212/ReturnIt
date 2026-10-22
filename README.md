# ReturnIt — MNNIT Lost & Found Platform

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.com/)

**ReturnIt** is a campus-restricted lost and found platform for students, faculty and staff at **Motilal Nehru National Institute of Technology (MNNIT) Allahabad**.

---

## Features

- **Campus-only accounts** — Sign-in with Neon Auth (email and password, or Google). The API verifies every request with a short-lived JWT, accepts only verified `@mnnit.ac.in` addresses, and rejects look-alike domains such as `mnnit.ac.in.evil.com`.
- **Email verification and password reset** — Six-digit codes sent by email; unverified accounts cannot use the API.
- **Profiles** — First-time onboarding records programme, year, branch and section and turns them into a readable bio. Members can upload a profile photo and view each other’s public profiles. Email addresses are never shown publicly.
- **Lost and found board** — Search, filter by type, category and location, bookmark listings, and browse a “Recently reported” feed.
- **Photo handling** — Photos are compressed in the browser before upload, then re-encoded on the server to WebP (resized, metadata including GPS removed) with a separate thumbnail. Images are stored in PostgreSQL and served with long-lived cache headers.
- **Requests and verification** — Finders set a private verification question (only a hash of the answer is stored). Owners approve or decline requests; contact details are shared only after approval.
- **Direct messages** — Members can message the person who posted a listing. Conversations are stored in the database, delivered in real time over Socket.IO, and show unread counts and read receipts.
- **Suggested matches** — Each listing shows likely counterparts (found items for a lost report, and vice versa) by category and keywords.
- **Trust and safety** — Report listings for review, rate limiting per session, listings that expire after 90 days with an option to renew.
- **Demo mode** — `VITE_USE_MOCK=true` runs the full interface on sample data stored in the browser, with no backend.

---

## Repository structure

```text
ReturnIt/
├── frontend/          React 18 + Vite single-page app
│   └── src/
│       ├── components/   UI components, 3D hero scene, page banners
│       ├── context/      AuthContext (Neon Auth), ChatContext (real-time messages)
│       ├── lib/          API client, demo-mode implementation, image compression
│       └── pages/        Landing, Board, Recent, Item, Post, Messages, Profile, Welcome, Sign in
├── backend/           Express + TypeScript API
│   ├── src/
│   │   ├── config/       Environment, PostgreSQL pool, migrations, Neon Auth JWKS
│   │   ├── middleware/   Authentication, rate limiting, security headers, errors
│   │   ├── models/       SQL data access (User, Item, Claim, Conversation, Report)
│   │   ├── routes/       /items, /claims, /conversations, /users, /auth
│   │   └── realtime.ts   Socket.IO channel for chat
│   └── tests/         Integration tests against an in-process PostgreSQL (PGlite)
└── shared/            Shared enums, Zod schemas and profile helpers
```

## Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide icons, React Router 6, Motion, three.js (lazy-loaded hero scene), Socket.IO client, Neon Auth SDK |
| **Backend** | Node.js 20+, Express, TypeScript, `pg`, `jose` (JWT verification), `sharp` (image processing), Socket.IO, Multer, Pino |
| **Database** | PostgreSQL on Neon |
| **Authentication** | Neon Auth (Managed Better Auth) |
| **Testing** | Vitest, Supertest, PGlite |

---

## Getting started

### Prerequisites

- Node.js 20 or newer, npm 10 or newer
- A Neon project with Neon Auth enabled (Google provider and email OTP verification)

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` (backend) and set the frontend variables in `frontend/.env`. Never commit these files; they contain your database credentials.

| Variable | Used by | Description |
|---|---|---|
| `DATABASE_URL` | API | Neon connection string |
| `NEON_AUTH_URL` | API | Neon Auth base URL, used to verify tokens |
| `CORS_ORIGIN` | API | Comma-separated list of allowed web origins |
| `PORT` | API | API port (default `5050`) |
| `VITE_API_URL` | Web | API base URL, e.g. `http://localhost:5050/api` |
| `VITE_SOCKET_URL` | Web | Real-time server origin, e.g. `http://localhost:5050` |
| `VITE_NEON_AUTH_URL` | Web | Neon Auth base URL |
| `VITE_USE_MOCK` | Web | `true` for demo mode, `false` for the real API |

In the Neon Console, add your production domain under **Auth → Configuration → Domains**, and enable **Require email verification**.

### 3. Create the database tables

```bash
npm run db:migrate
```

Migrations are idempotent and additive, so they are safe to run on every deployment.

### 4. Run

```bash
# API on http://localhost:5050
npm run api:dev

# Web app on http://localhost:5185
npm run web:dev
```

---

## Quality checks

```bash
npm run typecheck   # shared, API and web
npm run lint
npm test            # API integration tests run against an in-process PostgreSQL; no Neon data is touched
npm run build
```

---

## API overview

Authenticated endpoints require `Authorization: Bearer <Neon Auth JWT>` for a verified `@mnnit.ac.in` account.

| Method | Endpoint | Description | Auth |
|---|---|---|:---:|
| `GET` | `/api/health`, `/api/ready` | Liveness and database readiness | No |
| `GET` | `/api/items` | Board (`type`, `category`, `q`, `location`, `status`), or `mine=true` / `saved=true` | Optional |
| `GET` | `/api/items/:id` | Listing details | Optional |
| `GET` | `/api/items/:id/photos/:n` | Listing photo (`?size=thumb` for the thumbnail) | No |
| `GET` | `/api/items/:id/matches` | Suggested matches | Optional |
| `POST` | `/api/items` | Create a listing (multipart, up to 5 photos, `Idempotency-Key`) | Yes |
| `POST` | `/api/items/:id/save` · `/resolve` · `/renew` · `/report` | Bookmark, close, extend, report | Yes |
| `POST` | `/api/items/:id/claims` | Send a request on a listing | Yes |
| `GET` | `/api/claims` | Requests sent and received | Yes |
| `POST` | `/api/claims/:id/approve` · `/reject` · `/withdraw` | Decide or withdraw a request | Yes |
| `GET` | `/api/conversations` | Inbox | Yes |
| `POST` | `/api/conversations` | Start a conversation about a listing | Yes |
| `GET` / `POST` | `/api/conversations/:id/messages` | Read or send messages | Yes |
| `POST` | `/api/conversations/:id/read` | Mark a conversation as read | Yes |
| `GET` / `PATCH` / `DELETE` | `/api/users/me` | Own profile | Yes |
| `POST` | `/api/users/me/onboarding` | First-time profile details | Yes |
| `POST` / `DELETE` | `/api/users/me/avatar` | Upload or remove profile photo | Yes |
| `GET` | `/api/users/me/summary` | Unread messages and pending requests | Yes |
| `GET` | `/api/users/:id`, `/api/users/:id/listings`, `/api/users/:id/avatar` | Public profile | No |

---

## License

This project is licensed under the MIT License.
