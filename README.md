# mydoc.ai

AI-powered healthcare document management and medical chat for Indian
families. Upload lab reports and prescriptions, get plain-language AI
explanations grounded in your own records, track medications — in 11 Indian
languages.

## Architecture (v2 — built for cost-efficiency at scale)

```
Flutter app (iOS + Android)
        │  HTTPS + SSE
        ▼
FastAPI on AWS App Runner  ──  Gemini Flash Lite (chat / OCR-vision /
        │   (Mumbai)           embeddings, swappable via env vars)
        ▼
PostgreSQL (RDS)  +  S3 (document bytes)
```

Deliberate simplifications over v1 (see `docs/ARCHITECTURE.md` for rationale):

| v1 plan | v2 (this repo) | Why |
|---|---|---|
| GKE Autopilot | **App Runner / Cloud Run** | autoscaling containers, no k8s ops, ~10x cheaper at start |
| Qdrant vector DB | **per-user RAG in Postgres** | retrieval is always per-user (≤ a few hundred chunks) — cosine in-process beats a vector cluster |
| Celery + Redis | **background tasks** | one moving part fewer; swap to Cloud Tasks behind the same interface when needed |
| Supabase Auth | **self-managed phone OTP + JWT** | no vendor coupling, OTP via MSG91 (cheapest for India) |
| 4 LLM vendors | **one provider abstraction, Gemini Flash default** | chat + vision-OCR + embeddings from one cheap API; models swap via env var |

## Run it locally (zero configuration)

The backend runs with **no database server, no Docker, no API keys**:
SQLite + local file storage + an offline echo LLM, and OTPs are returned in
the API response.

```bash
cd backend
python -m venv venv && venv\Scripts\activate     # Windows (use source venv/bin/activate on mac/linux)
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
# API docs: http://localhost:8000/api/docs
python -m pytest                                  # 26 tests
```

Add a free Gemini key (https://aistudio.google.com/apikey) to `backend/.env`
as `GEMINI_API_KEY=...` to enable real AI chat + document OCR.

Mobile app: see [frontend-mobile/README.md](./frontend-mobile/README.md).

Postgres-backed stack: `docker-compose up -d`.

## Deploy to production

One service + one database + one bucket. Primary target is **AWS Mumbai**
(App Runner + RDS + S3 — see [deploy/aws.md](./deploy/aws.md), scripted in
[deploy/provision-aws.ps1](./deploy/provision-aws.ps1)); a GCP Cloud Run
guide is kept as an alternative ([deploy/cloud-run.md](./deploy/cloud-run.md)).
CI rebuilds + redeploys on push to `main` once `DEPLOY_ENABLED=true` and AWS
secrets are set (`.github/workflows/deploy-aws.yaml`).

## Project structure

```
mydoc/
├── backend/              # FastAPI app (app/) + tests/ — the whole API
├── frontend-mobile/      # Flutter app (iOS + Android)
├── frontend-web/         # Next.js shell (future work)
├── deploy/               # Cloud Run deployment guide
├── .github/workflows/    # tests, Cloud Run deploy, Flutter APK build
└── docs/                 # architecture & contribution docs
```

## Features

- 📄 Document upload (camera scan / PDF) with AI OCR + structured extraction
- 🤖 Streaming AI chat grounded in the user's own records (per-user RAG)
- 💊 Medication tracking with dose logging
- 👨‍👩‍👧 Family member records under one account
- 🌍 11 Indian languages
- 🔐 Phone-OTP auth, JWT, per-user data isolation, rate limiting
- 💳 Subscription plans with free-tier limits (Razorpay integration stubbed)

## Status

Backend implemented and tested (26 passing tests). Flutter app implemented.
Remaining for launch: GCP account + deploy, MSG91 SMS account, Razorpay
integration, app-store submission. See `PROGRESS.md` for the live checklist.
