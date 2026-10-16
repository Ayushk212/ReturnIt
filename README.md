# ReturnIt — MNNIT Lost & Found Platform

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)

**ReturnIt** is a secure, campus-restricted lost and found web platform designed specifically for students, faculty, and staff at **Motilal Nehru National Institute of Technology (MNNIT) Allahabad**.

Built with a modern TypeScript monorepo architecture, ReturnIt provides an organized campus board, scam-resistant item claiming, mutual verification, and strict institutional identity verification.

---

## Key Features

- **Strict Campus-Only Authentication**: Sign-in is powered by Firebase Authentication with strict server-side validation requiring `email_verified: true` and an exact `@mnnit.ac.in` domain. Subdomain spoofs and lookalike domains (e.g. `mnnit.ac.in.evil.com`) are automatically rejected.
- **Searchable Campus Board**: Real-time filtering by item type (*Lost* or *Found*), category (*Electronics*, *ID cards & documents*, *Wallets & bags*, *Keys*, *Jewellery*, *Clothing*, *Books*, *Other*), location on campus, and keyword queries.
- **Scam-Resistant Verification**: Finders can attach private verification questions. Expected answers are hashed with SHA-256 and never leaked via public API payloads.
- **Two-Party Claim Workflow**: Requesters submit claim notes. Listing owners can review, approve, reject, or resolve listings. Mutual contact info (name and verified campus email) is revealed only to the two parties upon claim approval.
- **Personal Dashboard & Bookmarks**: Users can save items to their personal board, track active claims, manage their listings, and edit public profile bios.
- **Zero-Dependency Mock Mode**: The frontend includes a comprehensive mock mode (`VITE_USE_MOCK=true`) with realistic campus seed data for instant testing without database or cloud service dependencies.

---

## Architecture & Monorepo Structure

The project is structured as an npm workspaces monorepo:

```text
Lost&Found/
├── apps/
│   ├── api/                     # Express + TypeScript REST API
│   │   ├── src/
│   │   │   ├── config/          # Environment validation, MongoDB connection, Firebase Admin SDK
│   │   │   ├── middleware/      # Firebase auth token verification, rate limiting, security headers, error handler
│   │   │   ├── models/          # Mongoose models (User, Item, Claim, Report)
│   │   │   ├── routes/          # API route definitions (/items, /claims, /users, /auth)
│   │   │   └── utils/           # Custom AppError, async handler
│   │   └── tests/               # Vitest integration tests for auth, security, and API contracts
│   └── web/                     # React 18 + Vite SPA
│       ├── src/
│       │   ├── components/      # UI components (Navbar, ItemCard, ItemImage, EmptyState, etc.)
│       │   ├── context/         # AuthContext (Firebase Client SDK + dev fallback)
│       │   ├── lib/             # API client, types, constants, session management, mock data
│       │   ├── pages/           # Landing, Dashboard, ItemDetail, PostItem, Profile, SignIn, Safety
│       │   └── styles/          # Tailwind CSS styling and theme tokens
│       └── tests/               # Web client smoke and validator tests
├── packages/
│   └── shared/                  # Shared Zod schemas, TypeScript types, and enums
├── scripts/
│   └── dev-mongo.mjs            # In-memory single-node MongoDB replica set runner
├── .env.example                 # Documented environment variable template
├── eslint.config.mjs            # Flat ESLint configuration
└── package.json                 # Monorepo root workspace configuration
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, React Router DOM 6 |
| **Backend** | Node.js 20+, Express, TypeScript, Mongoose 8, Firebase Admin SDK, Multer, Pino |
| **Database** | MongoDB (Replica Set enabled for ACID transaction support) |
| **Validation** | Zod schemas shared across client and server (`@returnit/shared`) |
| **Testing** | Vitest, Supertest, MongoDB Memory Server |

---

## Getting Started

### Prerequisites

- **Node.js** v20.x or higher
- **npm** v10.x or higher

### 1. Installation

Clone the repository and install all dependencies:

```bash
git clone https://github.com/Ayushk212/ReturnIt.git
cd ReturnIt
npm install
```

### 2. Environment Configuration

Copy the example environment files:

```bash
# Root API environment
cp .env.example .env

# Web client environment
cp apps/web/.env.example apps/web/.env.local   # or create apps/web/.env.local
```

For frontend testing with built-in mock campus data:
```env
# apps/web/.env.local
VITE_USE_MOCK=true
VITE_API_URL=http://localhost:5000/api
```

For live backend integration with Firebase Auth:
```env
# apps/web/.env.local
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

```env
# .env (Backend)
PORT=5000
MONGODB_URI=mongodb://localhost:27017/returnit?replicaSet=rs0&directConnection=true
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## Running Locally

### Development Mode

You can run both frontend and backend concurrently, or run them in separate terminals:

```bash
# Terminal 1: In-memory MongoDB replica set (if local mongod is not installed)
npm run mongo:dev

# Terminal 2: Express Backend (runs on http://localhost:5000 with hot reload)
npm run api:dev

# Terminal 3: Vite Frontend (runs on http://localhost:5173 with HMR)
npm run web:dev
```

Alternatively, start all workspace dev servers at once:
```bash
npm run dev
```

---

## Testing & Quality Assurance

The codebase enforces strict type safety and high test coverage:

```bash
# Run type checking across shared, api, and web packages
npm run typecheck

# Run linter across the entire monorepo
npm run lint

# Run all automated tests (auth, items, claims contracts, validators)
npm test

# Build production bundles
npm run build
```

---

## REST API Overview

All authenticated endpoints require an `Authorization: Bearer <Firebase_ID_Token>` header with an email verified under `@mnnit.ac.in`.

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `GET` | `/api/health` | Liveness health probe | No |
| `GET` | `/api/ready` | Readiness probe (verifies MongoDB state) | No |
| `GET` | `/api/auth/me` | Fetch authenticated session profile | Yes |
| `GET` | `/api/users/:id` | Fetch public user profile and listing count | No |
| `PATCH` | `/api/users/me` | Update bio, avatar, or contact details | Yes |
| `GET` | `/api/items` | List listings with filter params (`type`, `category`, `q`, `location`, `status`, `mine`, `saved`) | Optional |
| `GET` | `/api/items/:id` | Retrieve single item details | Optional |
| `POST` | `/api/items` | Create new listing (supports multipart image uploads & `Idempotency-Key`) | Yes |
| `POST` | `/api/items/:id/save` | Toggle bookmark on an item | Yes |
| `POST` | `/api/items/:id/resolve` | Mark item as resolved | Yes (Owner) |
| `POST` | `/api/items/:id/claims` | Submit claim request on a listing | Yes (Non-owner) |
| `GET` | `/api/claims` | List incoming and outgoing claims | Yes |
| `POST` | `/api/claims/:id/approve` | Approve claim and resolve listing | Yes (Owner) |
| `POST` | `/api/claims/:id/reject` | Reject claim | Yes (Owner) |
| `POST` | `/api/claims/:id/withdraw` | Withdraw submitted claim | Yes (Claimant) |

---

## License

This project is licensed under the MIT License.
