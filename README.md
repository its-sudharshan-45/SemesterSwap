<div align="center">

# SemesterSwap

**AI-powered, college-exclusive marketplace for verified students**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20DB-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-semester--swap.vercel.app-6366f1?style=flat-square&logo=vercel&logoColor=white)](https://semester-swap-seven.vercel.app)

SemesterSwap is a trust-first peer-to-peer marketplace where verified college students can safely buy, sell, and exchange textbooks, lab equipment, notes, and semester essentials — powered by a multi-provider AI engine and a robust transaction safety framework.

[🚀 Live Demo](https://semester-swap-seven.vercel.app) · [Features](#-features) · [Architecture](#-architecture) · [Setup](#-setup) · [API Docs](#-api-reference) · [Testing](#-testing)

</div>

---

## ✨ Features

### 🔐 Identity & Trust
- **College-restricted access** — Only verified `@kpriet.ac.in` email addresses can register
- **Supabase Auth** — Google OAuth and college email/password login with automatic JWT validation (HS256 + ES256/RS256 JWKS)
- **Trust Score engine** — Composite reputation score calculated from transaction history, rating, cancellation rate, and no-show penalties
- **Reliability badge system** — `New User → Normal → Reliable → Trusted` tier progression

### 🛍️ Marketplace
- **Rich listings** — Multi-image uploads via Supabase Storage with condition grading, category taxonomy, and pricing
- **Smart search & filtering** — Filter by category, price range, condition, and full-text title/description query
- **Wishlist** — Save and track listings of interest
- **My Listings** — Full CRUD management of a student's own listings

### 💬 Communication
- **Real-time inbox** — Conversation threads between buyer and seller, keyed per listing
- **Notification center** — In-app alerts for messages, listing updates, meeting confirmations, and transaction events
- **Email notifications** — Transactional emails (meeting scheduled, rescheduled, reminders, no-show) via SMTP or Resend

### 🤝 Transaction Safety
- **Purchase request flow** — Structured PENDING → ACCEPTED → MEETING_SCHEDULED → COMPLETED lifecycle
- **Meeting coordination** — Campus safe-spot meeting locations with scheduled time slots
- **Dual confirmation** — Both buyer and seller must confirm delivery; auto-completes on mutual confirmation
- **No-show processing** — Automated background job detects and penalises missed meetings
- **Cancellation tracking** — Rate-limited cancellations affect trust score

### 🤖 AI Engine (3-Tier Fallback: Anthropic → Groq → Google)
| Service | Description |
|---|---|
| **Pricing Intelligence** | Suggests fair market price ranges based on item condition and category |
| **Listing Description** | Generates rich, SEO-friendly descriptions from a basic title and condition |
| **Image Analysis** | Analyses listing photos to verify condition and flag mismatches |
| **Fraud Detection** | Scores listings for suspicious pricing or description patterns |
| **Semantic Search** | Natural-language search beyond keyword matching |
| **Recommendation** | Personalised listing suggestions based on browsing and purchase history |
| **Seller Insights** | Performance analytics and listing improvement suggestions |

### 🛡️ Security & Reliability
- **Rate limiting** — AI endpoints enforce per-user request budgets
- **Audit logging** — Security events and API usage logged with timestamps
- **Production guards** — Mock admin endpoints disabled when `ENV=production`
- **Background scheduler** — Async job runner (60s interval) for expiry, no-shows, and reminders

---

## 🏗️ Architecture

```
SemesterSwap/
├── backend/                        # FastAPI Application (Python)
│   ├── app/
│   │   ├── main.py                 # App entrypoint, CORS, router registration, lifespan scheduler
│   │   ├── config.py               # Pydantic Settings — loaded from root .env
│   │   ├── auth.py                 # JWT decode (HS256 + ES256/RS256 JWKS), user auto-provisioning
│   │   ├── database.py             # SQLAlchemy engine — PostgreSQL (prod) / SQLite (dev)
│   │   ├── models.py               # ORM models: User, Listing, Order, Meeting, Notification, …
│   │   ├── schemas.py              # Pydantic request/response schemas
│   │   ├── listings.py             # Listing CRUD endpoints
│   │   ├── conversations.py        # Chat messaging endpoints
│   │   ├── orders.py               # Purchase request lifecycle
│   │   ├── notifications.py        # Notification feed endpoints
│   │   ├── wishlist.py             # Wishlist endpoints
│   │   ├── reviews.py              # Post-transaction review endpoints
│   │   ├── safety.py               # Block / report endpoints
│   │   ├── uploads.py              # Supabase Storage image upload/delete
│   │   ├── storage.py              # Supabase Storage HTTP client
│   │   ├── analytics_router.py     # Usage analytics endpoints
│   │   ├── ai_router.py            # AI feature endpoints with rate limiting
│   │   ├── ai.py                   # Low-level AI provider clients (Anthropic, Groq, Gemini)
│   │   ├── parser.py               # College email parser (year, dept, roll)
│   │   ├── jobs/
│   │   │   └── scheduler.py        # Background: expire requests, no-shows, reminders
│   │   └── services/
│   │       ├── email_service.py    # SMTP / Resend transactional email dispatcher
│   │       ├── notification_service.py
│   │       ├── transaction_service.py
│   │       ├── meeting_service.py
│   │       ├── purchase_request_service.py
│   │       ├── trust.py            # Trust score algorithm
│   │       ├── audit_logger.py
│   │       ├── payment.py
│   │       └── ai/
│   │           ├── pricing_service.py
│   │           ├── description_service.py
│   │           ├── image_analysis_service.py
│   │           ├── fraud_service.py
│   │           ├── search_service.py
│   │           ├── recommendation_service.py
│   │           └── seller_insights_service.py
│   ├── tests/                      # 15 pytest test modules
│   └── requirements.txt
│
├── frontend/                       # Vite + React 19 (TypeScript)
│   ├── src/
│   │   ├── components/             # Reusable UI components
│   │   │   ├── layout/             # Navbar, Layout wrapper
│   │   │   ├── sell/               # Listing creation wizard
│   │   │   └── ui/                 # Toast, Card, Button primitives
│   │   ├── context/
│   │   │   └── AuthContext.tsx     # Session management, profile fetch, auth state
│   │   ├── hooks/                  # React Query data hooks
│   │   ├── lib/
│   │   │   └── supabase.ts         # Supabase client initialisation
│   │   └── pages/
│   │       ├── LandingPage.tsx
│   │       ├── LoginPage.tsx
│   │       ├── MarketplacePage.tsx
│   │       ├── ListingDetailsPage.tsx
│   │       ├── CreateListingPage.tsx
│   │       ├── MyListingsPage.tsx
│   │       ├── DashboardPage.tsx
│   │       ├── InboxPage.tsx
│   │       ├── OrdersPage.tsx
│   │       ├── OrderTrackingPage.tsx
│   │       ├── WishlistPage.tsx
│   │       ├── NotificationsPage.tsx
│   │       └── ProfilePage.tsx
│   └── package.json
│
├── database/                       # SQL migration scripts (phase1–phase8)
├── .env                            # Local secrets (never committed)
├── .env.example                    # Public-safe configuration template
├── .gitignore                      # Production-grade ignore rules
└── pyrightconfig.json              # Pyright / VS Code type resolution
```

---

## 🧰 Technology Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Runtime |
| FastAPI | ≥ 0.110 | REST API framework |
| SQLAlchemy | ≥ 2.0 | ORM + connection pooling |
| Pydantic v2 | ≥ 2.6 | Request/response validation |
| pydantic-settings | ≥ 2.2 | `.env`-driven configuration |
| python-jose | ≥ 3.3 | JWT decoding (HS256 / ES256 / RS256) |
| httpx | ≥ 0.27 | Async HTTP client (AI APIs, Storage) |
| Pillow | ≥ 10.0 | Image processing |
| psycopg2-binary | ≥ 2.9 | PostgreSQL driver |
| uvicorn | ≥ 0.28 | ASGI server |
| pytest + pytest-cov | ≥ 8.0 | Test suite |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | ~6.0 | Type safety |
| Vite | 8 | Build tool & dev server |
| Tailwind CSS | 3.4 | Utility-first styling |
| React Router | 7 | Client-side routing |
| TanStack Query | 5 | Server-state caching |
| React Hook Form + Zod | 7 / 4 | Form management & validation |
| Supabase JS | 2 | Auth client & realtime |
| Lucide React | latest | Icon library |

### Infrastructure
| Service | Role |
|---|---|
| Supabase | PostgreSQL database, Auth (JWT), Storage (images) |
| Anthropic Claude | Primary AI provider |
| Groq | Secondary AI fallback (fast inference) |
| Google Gemini | Tertiary AI fallback |
| Resend / Gmail SMTP | Transactional email |

---

## ⚙️ Setup

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm
- A [Supabase](https://supabase.com) project (free tier works)
- At least one AI provider key (Anthropic, Groq, or Google)

### 1. Clone & Configure Environment

```bash
git clone https://github.com/your-username/SemesterSwap.git
cd SemesterSwap
```

Copy the environment template and fill in your credentials:

```bash
cp .env.example .env
```

Key variables to set before starting:

```env
DATABASE_URL=postgresql://...          # Supabase connection string
SUPABASE_JWT_SECRET=...                # Project Settings → API → JWT Settings
SUPABASE_URL=https://xxx.supabase.co   # Project Settings → API → Project URL
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=...             # Project Settings → API → anon key
ANTHROPIC_API_KEY=...                  # At least one AI key required
```

See [`.env.example`](.env.example) for the full reference with all variables documented.

---

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Start the FastAPI development server from the **repository root**:

```bash
# Windows — PowerShell
$env:PYTHONPATH="."
uvicorn backend.app.main:app --reload --port 8000

# Windows — Command Prompt
set PYTHONPATH=.
uvicorn backend.app.main:app --reload --port 8000

# macOS / Linux
PYTHONPATH=. uvicorn backend.app.main:app --reload --port 8000
```

> **API docs** available at [`http://localhost:8000/docs`](http://localhost:8000/docs) (Swagger UI) and [`http://localhost:8000/redoc`](http://localhost:8000/redoc).

---

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

> **App** runs at [`http://localhost:5173`](http://localhost:5173).

---

## 📡 API Reference

All endpoints are prefixed with `/api/v1/`. Authentication is via `Authorization: Bearer <supabase_jwt>` header.

### Core Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/users/me` | Authenticated user profile |
| `PUT` | `/api/v1/users/me` | Update profile (name, avatar) |
| `GET` | `/api/v1/users/{id}/trust-profile` | Public trust & reputation profile |
| `GET` | `/api/v1/locations` | Campus safe-spot meeting locations |

### Listings
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/listings` | Browse marketplace (search, filter, paginate) |
| `POST` | `/api/v1/listings` | Create a new listing |
| `GET` | `/api/v1/listings/{id}` | Listing details |
| `PUT` | `/api/v1/listings/{id}` | Update listing |
| `DELETE` | `/api/v1/listings/{id}` | Delete listing |
| `GET` | `/api/v1/listings/my` | Authenticated user's own listings |

### Orders & Transactions
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/orders` | Submit a purchase request |
| `GET` | `/api/v1/orders` | List orders (buyer + seller views) |
| `PATCH` | `/api/v1/orders/{id}/accept` | Accept a purchase request |
| `PATCH` | `/api/v1/orders/{id}/schedule-meeting` | Schedule a campus meeting |
| `POST` | `/api/v1/orders/{id}/confirm` | Confirm delivery (buyer or seller) |
| `PATCH` | `/api/v1/orders/{id}/cancel` | Cancel a purchase request |

### AI Features
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/ai/pricing` | AI-suggested price range |
| `POST` | `/api/v1/ai/description` | Generate listing description |
| `POST` | `/api/v1/ai/image-analysis` | Analyse listing images |
| `POST` | `/api/v1/ai/fraud-check` | Fraud risk scoring |
| `POST` | `/api/v1/ai/search` | Semantic natural-language search |
| `POST` | `/api/v1/ai/recommendations` | Personalised listing recommendations |
| `POST` | `/api/v1/ai/seller-insights` | Seller performance analytics |

---

## 🧪 Testing

The test suite lives in `backend/tests/` and covers 15 modules.

Run from the **repository root**:

```bash
# Windows — PowerShell
$env:PYTHONPATH="."
backend\.venv\Scripts\python -m pytest

# macOS / Linux
PYTHONPATH=. backend/.venv/bin/python -m pytest
```

### Individual test modules

```bash
# Auth & JWT validation
pytest backend/tests/test_auth.py

# Listing CRUD
pytest backend/tests/test_listings.py

# AI services (pricing, description, fraud)
pytest backend/tests/test_ai.py
pytest backend/tests/test_ai_intelligence.py

# Transaction & order lifecycle
pytest backend/tests/test_orders.py
pytest backend/tests/test_transaction_reliability.py

# Email notifications
pytest backend/tests/test_email_service.py

# Production hardening checks
pytest backend/tests/test_production_enhancements.py
```

### Coverage report

```bash
pytest --cov=backend/app --cov-report=term-missing
```

---

## 🔐 Security Notes

- **`.env` is never committed** — all secrets are loaded at runtime via `pydantic-settings`
- **JWT verification** supports both symmetric (HS256) and asymmetric (ES256/RS256 via JWKS) tokens
- **SUPABASE_SERVICE_ROLE_KEY** is backend-only; never exposed to the browser
- **`VITE_*` keys** are baked into the JS bundle — only public/anon keys should carry this prefix
- **Rate limiting** on all AI endpoints prevents API key abuse
- **`ENV=production`** disables mock admin endpoints; always set this before deploying

---

## 🗃️ Database Migrations

Schema migrations are in `database/` as ordered SQL scripts. Apply them in sequence against your Supabase project using the SQL editor or `psql`:

```
database/
├── phase1a.sql   — Core schema: users, colleges, departments, listings
├── phase1b.sql   — Storage policies & triggers
├── phase2.sql    — Conversations, notifications, wishlist, safety
├── phase4.sql    — Orders, purchase requests, meetings
├── phase5.sql    — Reviews, trust scores, transaction confirmations
├── phase6.sql    — Analytics & AI usage logging
├── phase7_1_reliability_audit.sql  — Reliability metrics
├── phase7_payment_flow_redesign.sql
└── phase8_remove_admin.sql — Admin role cleanup
```

---

## 📦 Deployment

### Backend (Railway / Render / Fly.io)

Set the following environment variables in your hosting platform's secret store (do **not** deploy a `.env` file):

```
ENV=production
DATABASE_URL=postgresql://...
SUPABASE_JWT_SECRET=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
FRONTEND_URL=https://yourdomain.com
ANTHROPIC_API_KEY=...
EMAIL_PROVIDER=RESEND
RESEND_API_KEY=...
EMAIL_FROM=SemesterSwap <noreply@yourdomain.com>
```

Start command:
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
```

### Frontend (Vercel / Netlify)

Set these build-time environment variables in your platform dashboard:

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=https://api.yourdomain.com
```

Build command: `npm run build`  
Output directory: `dist/`

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes and add tests
4. Run the test suite: `pytest backend/tests/`
5. Open a Pull Request with a clear description

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
Built with ❤️ for KPRIET students
</div>
