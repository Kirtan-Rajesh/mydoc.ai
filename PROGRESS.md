# BUILD PROGRESS — continuity checkpoint

> Maintained by Claude during the 2026-06-11 rebuild session. If resuming in a
> new session: read this file first, then SUPERPLAN.md for original intent.

## Mission
Rebuild mydoc.ai (healthcare doc management + AI chat, India, lakhs of users)
into a working, deployable, cost-effective platform. User granted full freedom
on idea/logic/architecture. Targets: real backend, Flutter app (iOS+Android),
deployment-ready, swappable LLM models.

## Architecture decisions (FINAL — do not re-litigate)
1. **Cloud Run** (not GKE) — scale-to-zero, cheap, no k8s ops.
2. **One Postgres** (asyncpg) prod / SQLite (aiosqlite) dev. **No Qdrant, no
   TimescaleDB** — RAG is per-user cosine similarity in Python over the user's
   own chunks (few hundred max), embeddings stored as JSON in `document_chunks`.
3. **No Celery/Redis** — FastAPI BackgroundTasks for OCR, status polling.
   Swap to Cloud Tasks later behind same interface.
4. **LLM abstraction** in `backend/app/services/llm.py`: GeminiProvider
   (REST via httpx, gemini-2.0-flash chat+vision, text-embedding-004) +
   EchoProvider (offline/dev/tests). Selected via `LLM_PROVIDER` env (auto).
5. **Auth**: self-managed phone OTP (console SMS in dev, MSG91/Twilio stubs) +
   PyJWT bearer tokens, 30-day expiry. No Supabase.
6. **Storage abstraction**: local dir (dev) / GCS (prod) in services/storage.py.
7. **Chat**: SSE streaming (not WebSocket). Flutter consumes SSE.
8. Family members = `family_members` table (owner + optional linked user),
   docs/meds reference `member_id` (replaces dual user_id/for_user_id).

## Task list (mirrors harness tasks #1–#7) — tick ONLY when truly done
- [x] #1 Backend core: config.py, db.py, models.py, security.py, services/otp.py
- [x] #2 Services: llm.py, storage.py, rag.py, ocr.py
- [x] #3 Routers: auth, users(+profile+family), documents, chat SSE, medications, subscriptions; schemas.py, rate_limit.py, main.py
- [x] #4 Tests: 26/26 passing (backend/venv, `python -m pytest`); live smoke test OK (health, OTP→JWT, /users/me, SSE chat)
- [x] #5 Flutter app complete (lib/: config, models, api (SSE), providers, theme, main + screens: auth/login+otp, home_shell, dashboard, documents+detail, chat, medications, profile). Platform folders NOT committed — `flutter create . --org ai.mydoc --project-name mydoc_mobile` regenerates them (documented in frontend-mobile/README.md and done automatically in CI).
- [x] #6 Deployment: backend/Dockerfile (Cloud Run $PORT), docker-compose (postgres+backend), deploy/cloud-run.md (full gcloud guide), CI: test.yaml / deploy-prod.yaml (gated on DEPLOY_ENABLED var + GCP secrets) / mobile-build.yaml (APK artifact). Old GKE/terraform + SQL migration stubs deleted.
- [x] #7 Docs: README, docs/ARCHITECTURE.md (decisions + scaling path), .env.example, backend/README.md rewritten; stale SETUP_SUMMARY.md, docs/API.md, docs/DEPLOYMENT.md removed.

## Environment notes
- Windows 11, Python 3.11 at C:\Users\kirtanr\...\Python311, Node present.
- NO docker, NO flutter SDK, NO gcloud on this machine → backend tested via
  local venv (backend/venv, created during session); Flutter compiles in CI / user machine; deploy
  scripts prepared but not executed (needs user's GCP account).
- Old stub dirs deleted: app/{middleware,database,integrations,models,services,utils,workers,routers}.

## STATUS: BUILD COMPLETE ✓ (2026-06-11)
All 7 tasks done. Final verification: 26/26 backend tests pass; live server
smoke-tested (health, OTP→JWT auth, /users/me, SSE chat streaming).

## Session 2 (2026-06-11, later): Gemini key + AWS pivot
- User supplied Gemini API key (in backend/.env, gitignored — do NOT commit).
  Key is new-format ("AQ."): zero quota on gemini-2.0-flash; WORKS with
  gemini-3.1-flash-lite / gemini-2.5-flash-lite and gemini-embedding-001
  (embedContent only, not batchEmbedContents; 768-dim via outputDimensionality).
  Defaults updated in config.py + llm.py accordingly.
- LIVE E2E VERIFIED with real Gemini: PDF upload → classified blood_report,
  summary + key values extracted, embedded; RAG chat answered grounded in the
  report with correct source citation. (script: backend/scripts/live_e2e.py)
- GCP is company-blocked → pivot to AWS. AWS CLI works on this machine
  (account 478840952047, user agentcore-dev, broad perms). No Docker locally
  → cloud builds via CodeBuild. Plan: App Runner (ap-south-1) + RDS
  db.t4g.micro + S3 + ECR. Code updated: S3Storage backend, DB_SSL for RDS,
  boto3 dep. Tests still 26/26.
- deploy/aws.md + deploy/provision-aws.ps1 (full one-shot script) +
  .github/workflows/deploy-aws.yaml written. GCP workflow deleted.
- PROVISIONING BLOCKED by permission classifier (billable infra needs explicit
  user approval). When user approves: run
  `.\deploy\provision-aws.ps1 -GeminiApiKey "<key>"` (~$30-45/mo baseline).
- GitHub repo: https://github.com/Kirtan-Rajesh/mydoc.ai.git (push requested).
- SMS: no MSG91 yet → SMS_PROVIDER=console in prod too; OTPs visible in App
  Runner logs (documented).

## Session 2 addendum: free-tier deployment chosen
- User wants $0 hosting → free stack: Render free web service (Docker from
  GitHub) + Supabase free Postgres + Supabase Storage (S3-compatible, via
  new S3_ENDPOINT_URL setting) + Gemini free tier. render.yaml blueprint +
  deploy/free-tier.md guide added. AWS script kept as the paid upgrade path.
- Code pushed to https://github.com/Kirtan-Rajesh/mydoc.ai (main, 688e7de+).
- WAITING ON USER: create free Render + Supabase accounts per
  deploy/free-tier.md (10 min), or provide API keys for me to wire up.

## Remaining (needs user)
- Deploy: needs GCP account/credentials (or any Docker host). See deploy/cloud-run.md.
- Real SMS: set SMS_PROVIDER=msg91 + keys (console mode works for dev).
- Gemini: set GEMINI_API_KEY to switch from echo to real LLM (auto-detects).
- Flutter: run `flutter pub get && flutter run` on machine with Flutter SDK,
  or use .github/workflows/mobile-build.yaml CI.
