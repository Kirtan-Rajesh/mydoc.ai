# mydoc.ai — SUPERPLAN v1.0
## Complete Project Setup & Architecture

**Date Created:** 2026-06-06  
**Project:** mydoc.ai - AI-Powered Healthcare Document Management  
**Duration:** 12 weeks (Week 1-4: MVP, Week 5-12: Scale & Features)

---

## 📋 PROJECT OVERVIEW

A healthcare platform for document management, OCR processing, AI-powered chat, and medication tracking with family support and multi-language capabilities.

**Target Users:** Indian families managing health records  
**Primary Platform:** Mobile (Flutter) + Web (Next.js)  
**Key Markets:** India (11 languages supported)

---

## 🏗️ ARCHITECTURE LAYERS

```
┌─────────────────────────────────────────────────────┐
│          CLIENT LAYER (Flutter + Next.js)           │
├─────────────────────────────────────────────────────┤
│  API Gateway & Middleware (JWT, RLS, Rate Limit)    │
├─────────────────────────────────────────────────────┤
│  Backend Services (FastAPI Monolith)                │
│  ├─ Auth Service         ├─ Document Service        │
│  ├─ User Service         ├─ AI/Chat Service         │
│  ├─ Profile Service      ├─ Medication Service      │
│  ├─ Notification Service ├─ Payment Service         │
│  └─ Family Service       └─ Analytics Service       │
├─────────────────────────────────────────────────────┤
│  Data Layer                                         │
│  ├─ PostgreSQL (Supabase) ├─ TimescaleDB           │
│  ├─ Redis (Memorystore)   ├─ Qdrant (Vectors)      │
│  └─ GCS (File Storage)                             │
├─────────────────────────────────────────────────────┤
│  External Integrations                             │
│  ├─ LLMs (Gemini, Mistral, Groq, OpenAI)           │
│  ├─ Sarvam AI (TTS)  ├─ Razorpay (Payments)        │
│  ├─ Firebase FCM      ├─ Twilio (WhatsApp)         │
│  └─ Langfuse (Observability)                       │
├─────────────────────────────────────────────────────┤
│  Infrastructure (GCP)                              │
│  ├─ GKE Autopilot ├─ Cloud SQL ├─ Cloud Tasks      │
│  ├─ Pub/Sub       ├─ Secret Manager ├─ Artifact    │
│  └─ Cloudflare (CDN + WAF)                         │
└─────────────────────────────────────────────────────┘
```

---

## 📁 FOLDER STRUCTURE

```
mydoc/
├── backend/                          # FastAPI monolith
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # App entry point
│   │   ├── config.py                # Environment config
│   │   ├── middleware/              # Auth, RLS, error handling
│   │   ├── services/                # Business logic modules
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── profiles.py
│   │   │   ├── documents.py
│   │   │   ├── ai_chat.py
│   │   │   ├── medications.py
│   │   │   ├── notifications.py
│   │   │   ├── payments.py
│   │   │   ├── family.py
│   │   │   └── analytics.py
│   │   ├── routers/                 # API endpoints (router per service)
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── documents.py
│   │   │   ├── chat.py
│   │   │   ├── medications.py
│   │   │   └── subscriptions.py
│   │   ├── models/                  # Pydantic schemas
│   │   │   ├── user.py
│   │   │   ├── document.py
│   │   │   ├── medication.py
│   │   │   └── chat.py
│   │   ├── database/                # SQLAlchemy ORM models & connections
│   │   │   ├── __init__.py
│   │   │   ├── connection.py
│   │   │   ├── models.py
│   │   │   └── migrations/          # Alembic migrations
│   │   ├── integrations/            # External service clients
│   │   │   ├── supabase.py
│   │   │   ├── gcs.py
│   │   │   ├── redis.py
│   │   │   ├── qdrant.py
│   │   │   ├── llm_client.py
│   │   │   ├── firebase.py
│   │   │   ├── razorpay.py
│   │   │   └── sarvam_ai.py
│   │   ├── workers/                 # Celery tasks (async processing)
│   │   │   ├── ocr_pipeline.py
│   │   │   ├── embedding_pipeline.py
│   │   │   ├── notification_worker.py
│   │   │   └── reminder_scheduler.py
│   │   └── utils/                   # Helpers & constants
│   │       ├── constants.py
│   │       ├── validators.py
│   │       └── decorators.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   └── README.md
│
├── frontend-web/                    # Next.js web app
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── documents/
│   │   │   ├── chat/
│   │   │   ├── profile/
│   │   │   └── family/
│   │   ├── components/
│   │   │   ├── ui/                  # Reusable UI components
│   │   │   ├── auth/
│   │   │   ├── document/
│   │   │   └── chat/
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── auth.ts
│   │   │   └── utils.ts
│   │   ├── context/                 # React context for state
│   │   └── styles/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── Dockerfile
│   └── README.md
│
├── frontend-mobile/                 # Flutter mobile app
│   ├── android/
│   ├── ios/
│   ├── lib/
│   │   ├── main.dart
│   │   ├── config/
│   │   ├── models/
│   │   ├── screens/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── documents/
│   │   │   ├── chat/
│   │   │   ├── medications/
│   │   │   └── family/
│   │   ├── services/
│   │   │   ├── api_service.dart
│   │   │   ├── auth_service.dart
│   │   │   ├── storage_service.dart
│   │   │   └── notification_service.dart
│   │   ├── widgets/
│   │   ├── providers/               # Riverpod state management
│   │   └── utils/
│   ├── pubspec.yaml
│   ├── Dockerfile
│   └── README.md
│
├── database/                        # Database & migration scripts
│   ├── migrations/                  # SQL migration files
│   │   ├── 001_init_schema.sql
│   │   ├── 002_add_timescale.sql
│   │   ├── 003_rls_policies.sql
│   │   └── ...
│   ├── seeds/                       # Test data
│   │   └── development.sql
│   ├── queries/                     # Named queries for reference
│   │   └── analytics.sql
│   └── README.md
│
├── infrastructure/                  # IaC & deployment configs
│   ├── terraform/                   # GCP infrastructure
│   │   ├── main.tf
│   │   ├── gke.tf
│   │   ├── database.tf
│   │   ├── storage.tf
│   │   └── variables.tf
│   ├── kubernetes/                  # K8s manifests
│   │   ├── namespaces.yaml
│   │   ├── backend-deployment.yaml
│   │   ├── jobs/
│   │   │   ├── ocr-job.yaml
│   │   │   └── embedding-job.yaml
│   │   ├── services/
│   │   ├── ingress.yaml
│   │   └── configmaps/
│   ├── docker/                      # Docker build configs
│   │   ├── backend.Dockerfile
│   │   ├── worker.Dockerfile
│   │   └── web.Dockerfile
│   └── README.md
│
├── .github/
│   ├── workflows/
│   │   ├── test.yaml                # Run tests on PR
│   │   ├── deploy-dev.yaml          # Deploy to dev
│   │   ├── deploy-prod.yaml         # Deploy to production
│   │   └── mobile-build.yaml        # Flutter build
│   └── CODEOWNERS
│
├── docs/                            # Documentation
│   ├── ARCHITECTURE.md
│   ├── API.md                       # OpenAPI reference
│   ├── DATABASE.md
│   ├── DEPLOYMENT.md
│   ├── CONTRIBUTING.md
│   └── onboarding.md
│
├── .env.example                     # Environment template
├── docker-compose.yaml              # Local dev environment
├── SUPERPLAN.md                     # This file
├── README.md
└── .gitignore
```

---

## ⚙️ TECHNOLOGY STACK

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Database:** PostgreSQL 15+ (Supabase) + TimescaleDB
- **Vector DB:** Qdrant (for embeddings/RAG)
- **Cache:** Redis (Memorystore)
- **Task Queue:** Celery + Redis
- **ORM:** SQLAlchemy 2.0
- **Auth:** Supabase Auth + JWT
- **API Docs:** OpenAPI/Swagger
- **Monitoring:** Sentry + Langfuse
- **Testing:** pytest + pytest-asyncio

### Frontend (Web)
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **UI Framework:** Tailwind CSS + shadcn/ui
- **State:** TanStack Query + Zustand
- **Auth:** NextAuth.js + Supabase
- **Chat UI:** Streaming with Server-Sent Events
- **File Upload:** React Dropzone
- **Testing:** Vitest + React Testing Library

### Frontend (Mobile)
- **Framework:** Flutter 3.10+
- **Language:** Dart
- **State Management:** Riverpod
- **HTTP:** Dio
- **Local Storage:** Hive
- **Auth:** Flutter Secure Storage
- **Notifications:** Firebase Cloud Messaging
- **Testing:** Flutter test + Mockito

### Infrastructure
- **Cloud:** Google Cloud Platform (GCP)
- **Compute:** GKE (Google Kubernetes Engine) Autopilot
- **Database:** Cloud SQL (PostgreSQL managed)
- **Storage:** Google Cloud Storage (GCS)
- **Secrets:** GCP Secret Manager
- **CDN:** Cloudflare
- **CI/CD:** GitHub Actions → Artifact Registry → GKE
- **Monitoring:** Prometheus + Grafana
- **Logging:** Google Cloud Logging

### External Services
- **LLMs:** Google Gemini, Mistral, Groq, OpenAI
- **OCR:** pdfplumber (local), Mistral OCR, Gemini Vision
- **TTS:** Sarvam AI (11 Indian languages)
- **SMS/WhatsApp:** Twilio
- **Payments:** Razorpay (India)
- **In-App Purchase:** RevenueCat
- **Analytics:** PostHog
- **Email:** SendGrid or AWS SES
- **Observability:** Langfuse (self-hosted)

---

## 📅 12-WEEK BUILD ROADMAP

### Phase 1: Foundation (Weeks 1-2)
**Goal:** Stable infrastructure + auth framework
- [ ] GCP project setup (VPC, Secret Manager, Artifact Registry)
- [ ] GKE cluster + node pools
- [ ] Cloud SQL PostgreSQL + TimescaleDB setup
- [ ] Redis Memorystore
- [ ] GCS buckets (documents, artifacts)
- [ ] GitHub Actions CI/CD pipeline
- [ ] Supabase project + Row Level Security framework
- [ ] Cloudflare WAF + SSL
- [ ] Monitoring (Prometheus + Grafana)
- [ ] Base FastAPI app + structure

### Phase 2: Auth & Core Data (Weeks 2-3)
**Goal:** Users can sign up and have profiles
- [ ] Supabase Auth integration (phone OTP + Google SSO)
- [ ] JWT middleware in FastAPI
- [ ] PostgreSQL schema migration (Phase 1 tables)
- [ ] User Service: /users/me, /users/{id}, CRUD
- [ ] Profile Service: health profile CRUD
- [ ] Family Service: family groups setup
- [ ] RLS policies implementation
- [ ] Flutter auth screens (OTP flow)
- [ ] Next.js auth pages

### Phase 3: Document Pipeline (Weeks 3-5)
**Goal:** Users can upload and extract documents
- [ ] Document Service: presigned URL flow
- [ ] GCS direct upload from client
- [ ] Celery worker setup + Redis broker
- [ ] Pub/Sub document.uploaded events
- [ ] OCR pipeline (pdfplumber → Mistral → Gemini fallback)
- [ ] Extraction into document_extractions table
- [ ] Text chunking + OpenAI embeddings
- [ ] Qdrant integration + vector storage
- [ ] Flutter document vault UI
- [ ] Document list/view endpoints

### Phase 4: AI Layer (Weeks 5-7)
**Goal:** Conversational AI with context awareness
- [ ] Qdrant client + retrieval logic
- [ ] LangGraph agent setup
- [ ] Intent classifier + router
- [ ] RAG retrieval pipeline
- [ ] WebSocket streaming endpoint
- [ ] Blood report decoder (Gemini Flash)
- [ ] Daily brief generator (Groq)
- [ ] Response caching (Redis 24h TTL)
- [ ] Langfuse integration
- [ ] Flutter chat UI with streaming
- [ ] Medical disclaimer system

### Phase 5: Medications & Notifications (Weeks 7-9)
**Goal:** Reminder system + family support
- [ ] Medication CRUD + schedule builder
- [ ] Celery Beat scheduler
- [ ] Firebase FCM integration
- [ ] Sarvam AI TTS (11 languages)
- [ ] Twilio WhatsApp for elderly flow
- [ ] Family account linking
- [ ] Caregiver notifications
- [ ] Medication logs + adherence tracking
- [ ] Flutter medication screen
- [ ] Multi-timezone support

### Phase 6: Payments & Analytics (Weeks 9-12)
**Goal:** Monetization + insights
- [ ] Razorpay subscription setup
- [ ] Webhook handler for payment events
- [ ] RevenueCat for iOS/Android in-app purchase
- [ ] Entitlement middleware
- [ ] Plan limits enforcement
- [ ] Next.js billing page
- [ ] PostHog analytics integration
- [ ] Grafana dashboards (active users, chats, uploads)
- [ ] Sentry error tracking (app + API)
- [ ] Beta testing with 100 users
- [ ] Scale & production hardening

---

## 🔑 Critical Implementation Decisions

### Data Model Decisions
1. **User Relationships:** Dual `user_id` + `for_user_id` pattern for self/dependent management
2. **Document Storage:** Metadata in PostgreSQL, bytes in GCS (presigned URLs only)
3. **AI Conversations:** Session-based with RAG context (not full history)
4. **Multi-Language:** Store English internally, translate at API boundary

### Architecture Decisions
1. **Deployment:** Monolith FastAPI with service modules (not microservices day 1)
2. **Storage:** Direct GCS presigned URLs (never proxy file bytes)
3. **Caching:** Redis for subscription state (15min TTL) + response caching (24h)
4. **Observability:** Langfuse (self-hosted) + Sentry for errors

### Compliance & Security
1. **PHI Handling:** Strip before logging to Langfuse
2. **File Upload:** Max 20MB, scan for malware, virus check
3. **Encryption:** CMEK keys for data at rest, TLS in transit
4. **Access Control:** Row Level Security + JWT validation
5. **Rate Limiting:** 100 req/min per user, 10 req/sec for uploads

---

## 🚀 Deployment Checklist

### Week 12 Pre-Launch
- [ ] Load testing (1000 concurrent users)
- [ ] Database backup & recovery drill
- [ ] Disaster recovery plan
- [ ] Security audit (OWASP Top 10)
- [ ] GDPR compliance verification
- [ ] Medical disclaimer legal review
- [ ] Beta user feedback incorporation
- [ ] Production monitoring alerting
- [ ] On-call runbook
- [ ] Documentation complete

---

## 📊 Success Metrics (Post-Launch)

- **User Acquisition:** 1,000 users in month 1
- **Retention:** 40% D7 retention
- **Document Processing:** <30s end-to-end
- **API Latency:** p95 <500ms
- **Uptime:** 99.9%
- **LLM Cost per User:** <$0.10/month
- **Infrastructure Cost:** <$15K/month at 10K users

---

## 🛠️ Local Development Setup

```bash
# 1. Clone and setup
git clone https://github.com/mydoc/mydoc-ai.git
cd mydoc

# 2. Copy environment
cp .env.example .env

# 3. Start local services (Docker Compose)
docker-compose up -d

# 4. Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# 5. Frontend web
cd ../frontend-web
npm install
npm run dev

# 6. Frontend mobile
cd ../frontend-mobile
flutter pub get
flutter run
```

---

## 📚 Documentation Index

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Detailed system design
- [API.md](./docs/API.md) — OpenAPI reference
- [DATABASE.md](./docs/DATABASE.md) — Schema deep-dive
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) — GCP setup guide
- [CONTRIBUTING.md](./docs/CONTRIBUTING.md) — Contribution guidelines

---

## 👥 Team Structure (Recommended)

- **Backend (2):** FastAPI + Database + Integrations
- **Frontend Web (1):** Next.js + UI/UX
- **Mobile (1):** Flutter + Native features
- **DevOps (1):** GKE + Terraform + CI/CD
- **PM/Design (1):** Product roadmap + UI/UX

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| LLM API costs scale | High | Implement caching + fallback models |
| OCR accuracy | High | Use Mistral first, Gemini fallback |
| Database migrations | High | Test in staging, blue-green deploy |
| Multi-language bugs | Medium | Native speaker testing per language |
| Payment failures | High | Retry logic + manual resolution queue |

---

**Created:** 2026-06-06  
**Version:** 1.0  
**Status:** Ready for implementation
