# mydoc.ai — Platform Reference for Claude

## What this product is
mydoc.ai is a **personal health records + AI assistant app** targeting the Indian market.
Users upload lab reports, prescriptions, and scans; the AI extracts, summarises, and answers questions about them in natural language (including 11 Indian languages). Medication reminders round out the daily-use loop.

## Business model
- **Free tier**: 25 documents, 20 AI chats/day
- **Pro** (₹199/month): unlimited documents + chat, priority processing
- **Family** (₹349/month): Pro for up to 6 family members
- Payment via **Razorpay** (Indian-first UPI/card/netbanking)
- Target: urban Indian smartphone users aged 25-55 managing chronic conditions or family health

## Repository layout
```
backend/              FastAPI + SQLAlchemy + Gemini AI
frontend-web/         Next.js 14 + Tailwind (website + web dashboard)
frontend-mobile-expo/ React Native + Expo Router (iOS + Android app)
frontend-mobile/      Legacy Flutter app (superseded — do not modify)
deploy/               AWS, GCP, Render deployment docs
```

## Tech stack

### Backend
- **Runtime**: Python 3.11, FastAPI, Uvicorn
- **DB**: SQLite (dev) / Postgres (prod) via SQLAlchemy async
- **AI**: Gemini 2.0 Flash (chat + vision OCR) + gemini-embedding-001 (RAG)
- **Storage**: local `./uploads` (dev) / GCS or S3-compatible (prod)
- **Auth**: Phone OTP → JWT (30-day), rate-limited
- **SMS**: console (dev) / MSG91 / Twilio
- **Tests**: pytest, 26 passing

### Web (frontend-web/)
- **Framework**: Next.js 14 App Router
- **Styling**: Tailwind CSS, brand color #10B981 (emerald)
- **Icons**: lucide-react
- **State**: useState/useEffect (no lib), JWT in localStorage
- **Run**: `cd frontend-web && npm run dev` → localhost:3000

### Mobile (frontend-mobile-expo/)
- **Framework**: Expo SDK 56, Expo Router v4, React Native 0.85
- **State**: Zustand (auth) + TanStack Query (server state)
- **Storage**: expo-secure-store (JWT)
- **Notifications**: expo-notifications (local, daily medication reminders)
- **Run dev**: `cd frontend-mobile-expo && npx expo start`
- **Run web (VDI)**: `cd frontend-mobile-expo && npx expo start --web`

## API base
- Dev: `http://localhost:8000/api/v1`
- Prod: `https://api.mydoc.ai/api/v1`
- All requests: `Authorization: Bearer <jwt>`

## Key API endpoints
```
POST /auth/request-otp       { phone: "+91XXXXXXXXXX" }
POST /auth/verify-otp        { phone, otp, name? } → { access_token }
GET  /users/me               → User
PATCH /users/me              { name?, language_pref? }
GET  /users/me/profile       → HealthProfile
PUT  /users/me/profile       { blood_group?, height_cm?, weight_kg?, medical_conditions, allergies }
GET  /users/me/family        → FamilyMember[]
POST /users/me/family        { name, relation, phone? }
DELETE /users/me/family/:id
GET  /documents              → Document[]
POST /documents              FormData { file }
GET  /documents/:id          → Document
DELETE /documents/:id
POST /documents/:id/reprocess
GET  /medications            → Medication[]
POST /medications            { name, dosage, instructions, times: ["HH:MM"] }
PATCH /medications/:id       { name?, dosage?, times?, is_active? }
DELETE /medications/:id
GET  /medications/today      → TodayDose[]
POST /medications/:id/logs   { scheduled_for, status: "taken|skipped" }
POST /chat                   SSE: { message, conversation_id?, document_id? }
GET  /chat/conversations     → Conversation[]
GET  /chat/conversations/:id/messages → Message[]
GET  /subscriptions/me       → { plan, limits, usage }
POST /subscriptions/webhooks/razorpay
```

## Document model
```ts
{ id, user_id, filename, file_type, status: "uploaded|processing|ready|failed",
  doc_type, report_date, lab_name, summary, structured_data: {key: value},
  created_at }
```

## What is DONE ✅
- Backend: all endpoints implemented, tested (26 passing)
- Backend: AI pipeline (OCR, RAG, streaming chat)
- Mobile: all 5 tabs + auth + document detail
- Web: landing page, login, chat, records, medications

## What is TODO ❌
### Web (frontend-web/) — PRIORITY
- [ ] `/app/profile` page — health profile edit + family members + language
- [ ] `/app/subscriptions` page — plan info + upgrade CTA (Razorpay)
- [ ] Logout + account menu in nav
- [ ] Loading skeletons on all data pages
- [ ] Toast/error boundary system

### Mobile (frontend-mobile-expo/) — PRIORITY
- [ ] Verify app runs on Expo web (`--web`) for VDI development
- [ ] Fix any TypeScript/import errors blocking web build
- [ ] Subscription/upgrade screen
- [ ] Family member management (add/remove in Profile tab)
- [ ] Reprocess failed document button

### Backend — SECONDARY
- [ ] Razorpay webhook: verify signature + activate plan in DB
- [ ] FCM push notifications for server-side medication reminders
- [ ] Alembic migrations (replace auto-create)
- [ ] GDPR: data export + account deletion endpoints

### Infrastructure — POST-MVP
- [ ] Provision AWS RDS + S3 (or Supabase)
- [ ] Set GitHub Actions secrets for CI/CD
- [ ] MSG91 SMS account setup
- [ ] Sentry DSN wired in backend + frontend

## Coding conventions
- Web: functional components, no class components; Tailwind only (no CSS files)
- Mobile: StyleSheet.create (NativeWind not installed); TanStack Query for all API calls
- Backend: async/await throughout; Pydantic schemas; never bypass auth middleware
- Never add comments explaining what the code does; only add why if non-obvious
- No placeholder TODOs — implement or leave out entirely
