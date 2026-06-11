# mydoc.ai backend

FastAPI + SQLAlchemy (async). Runs with zero config in dev (SQLite, local
storage, offline LLM, console OTP); production is Postgres + GCS + Gemini.

```bash
python -m venv venv && venv\Scripts\activate    # source venv/bin/activate on mac/linux
pip install -r requirements-dev.txt
uvicorn app.main:app --reload     # http://localhost:8000/api/docs
python -m pytest                  # test suite
```

Configuration: copy `../.env.example` to `.env` and uncomment what you need.

```
app/
├── main.py          # app wiring, CORS, rate limit, routers
├── config.py        # all settings (env-overridable, dev defaults)
├── db.py            # async engine/session, table creation
├── models.py        # ORM schema
├── schemas.py       # pydantic request/response models
├── security.py      # JWT + current-user dependency
├── rate_limit.py    # sliding-window limiter
├── services/
│   ├── llm.py       # provider abstraction (Gemini / offline echo)
│   ├── storage.py   # local disk / GCS
│   ├── otp.py       # OTP + SMS providers (console / MSG91 / Twilio)
│   ├── ocr.py       # document processing pipeline (background task)
│   └── rag.py       # chunk, embed, per-user retrieval
└── routers/         # auth, users(+profile+family), documents, chat (SSE),
                     # medications, subscriptions
```
