# mydoc.ai — Architecture (v2)

Goal: serve **lakhs of registered users** with a small team and a small bill,
without painting ourselves into a corner. Every component below was chosen so
it can be upgraded later behind an existing interface.

## System overview

```
┌─────────────────────────────────────────────┐
│ Flutter app (iOS + Android)                 │
│  phone-OTP auth · vault · SSE chat · meds   │
└──────────────────┬──────────────────────────┘
                   │ HTTPS (bearer JWT) + SSE
┌──────────────────▼──────────────────────────┐
│ FastAPI on Cloud Run (asia-south1)          │
│  auth/users/family · documents · chat · meds│
│  in-process: rate limit, RAG, OCR bg tasks  │
└───┬──────────────┬──────────────┬───────────┘
    │              │              │
┌───▼────────┐ ┌───▼─────────┐ ┌──▼───────────────────┐
│ Cloud SQL  │ │ GCS bucket  │ │ Gemini API           │
│ Postgres   │ │ (doc bytes) │ │ chat·vision·embed    │
│ (one DB)   │ │             │ │ (swappable provider) │
└────────────┘ └─────────────┘ └──────────────────────┘
```

## Key decisions and why

### 1. Cloud Run, not GKE
Stateless API + autoscaling 0→50 instances ≈ all the scale we need. A GKE
cluster costs ~$300+/mo idle and a DevOps hire; Cloud Run costs near-zero
idle and nothing to operate. The container is plain Docker — if we ever need
k8s, the same image deploys there.

### 2. One Postgres, no vector DB, no Timescale
The RAG workload here is unusual: **retrieval is always scoped to one user's
own documents** — tens to a few hundred chunks. Loading those rows and doing
cosine similarity in Python is faster than a network hop to a vector DB, and
removes an entire cluster from the bill. Embeddings live as JSON on
`document_chunks`. If cross-user search ever becomes a feature, swap
`services/rag.py` to pgvector — callers don't change.

### 3. Background tasks, not Celery
OCR/extraction runs as a FastAPI background task with a status field
(`uploaded → processing → ready|failed`) the client polls. The entrypoint
(`process_document(document_id)`) is queue-shaped: moving it behind Cloud
Tasks is a ~20-line change when volume demands it.

### 4. LLM provider abstraction (`services/llm.py`)
One interface: `chat_stream`, `complete`, `embed`, `extract_document`.
- Default: **Gemini 2.0 Flash** — cheapest capable multimodal model
  (~$0.10/M input tokens), handles chat, scanned-document OCR, and Indian
  languages; embeddings via text-embedding-004 (free tier is generous).
- Offline: **EchoProvider** keeps dev/tests/CI key-free.
- Upgrading models = changing `CHAT_MODEL`/`VISION_MODEL` env vars. Adding a
  provider (OpenAI, Anthropic, Mistral) = one class.

Cost model: a chat turn ≈ 3-6K input tokens (system + RAG + history) + ~500
output ≈ **₹0.05-0.10**. Document extraction ≈ ₹0.20-0.50. At the free-plan
limits, LLM cost stays well under $0.10/user/month — matching the original
target.

### 5. Self-managed phone OTP + JWT
OTP hashed (HMAC-SHA256) in Postgres, 10-min expiry, 5 attempts, single-use;
30-day JWTs (mobile-first). SMS provider is pluggable: console (dev) /
MSG91 (~₹0.15/SMS, India) / Twilio. No auth vendor lock-in.

### 6. SSE for chat streaming
SSE is plain HTTP — works through Cloud Run, CDNs, and corporate proxies
without WebSocket upgrade headaches, and the client implementation is a line
splitter. Events: `meta` (conversation id) → `token`* → `done` (sources).

### 7. Documents pipeline
1. Multipart upload → bytes to storage (local/GCS), metadata row.
2. Background: digital PDFs get pypdf text extraction (no LLM cost); scans
   and images go to Gemini vision. One prompt extracts type, date, lab,
   plain-language summary, key values, and full text.
3. Text is chunked (~1.5K chars, 200 overlap) and embedded for RAG.
4. Client polls status; the vault shows summary + key values when ready.

### 8. Data isolation
Every query filters by `user_id` from the JWT; documents/medications can also
be tagged to a `family_member`. Free-plan limits (25 docs, 20 chats/day) are
enforced server-side. Rate limiting is an in-memory sliding window per
instance (exact global limits → Redis later, deliberately deferred).

## Scaling path (when, not if)

| Trigger | Change |
|---|---|
| OCR volume hurts API latency | move `process_document` behind Cloud Tasks |
| chunks per user ≫ 1000 | pgvector index in the same Postgres |
| exact global rate limits needed | Memorystore Redis for the limiter |
| schema churn under live traffic | introduce Alembic migrations |
| cold starts annoy users | `--min-instances 1` (~₹1.5K/mo) |
| DB CPU saturated | bigger Cloud SQL tier + read replica |

## Security & compliance notes

- TLS everywhere (Cloud Run default); JWT HS256 with secret in Secret Manager.
- Document bytes never transit through logs; GCS signed URLs expire in 15 min.
- Production refuses to boot with the dev SECRET_KEY.
- Medical-disclaimer language is baked into the system prompt and the app UI.
- PII/PHI: no third-party analytics in the data path; Sentry DSN optional.
