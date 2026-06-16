# mydoc.ai — Investor Brief
### AI-Powered Personal Health Records for India

---

## The Problem

India has a **fragmented, paper-first healthcare system** where the patient bears the full burden of record-keeping.

- The average urban Indian visits **4–6 different doctors per year** — each with their own paper records
- **77 million diabetics**, 220 million hypertension patients, and a growing chronic disease population require continuous monitoring but have no unified record
- Lab reports arrive as PDFs on WhatsApp. Prescriptions are scanned and forgotten. Discharge summaries are stuffed in folders
- When a patient sees a new doctor, they start from scratch — repeating tests, missing context, risking misdiagnosis
- **62% of India's healthcare spending is out-of-pocket** — patients pay twice when records are lost

The result: critical health information is siloed, inaccessible, and unanalysed — even as Indians become increasingly smartphone-native.

---

## Our Solution

**mydoc.ai** is a personal health intelligence app. Upload any health document — lab report, prescription, discharge summary, scan — and our AI reads it, summarises it in plain language, and makes it available for conversation.

> *"What does my HbA1c of 7.2 mean?" "Is my creatinine trending up over the last 3 reports?" "Which medicines am I on that interact with ibuprofen?"*

mydoc answers in the patient's language, drawing on their own records.

**Core features:**
- **Document AI** — Upload PDF/image; AI extracts type, date, lab name, key values, and generates a plain-language summary
- **Health Q&A** — Streaming AI chat grounded in the user's own documents (RAG)
- **Medication tracker** — Daily dose reminders with adherence logging
- **Family vault** — One subscription covers up to 6 family members; manage parents' records from a single app
- **11 Indian languages** — Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Bengali, Punjabi, Odia, English

---

## Market Opportunity

| | Size |
|---|---|
| India digital health market (2024) | **$3.0B** |
| Projected by 2030 | **$11.3B** (CAGR 25%) |
| Smartphone users in India | **700M+** |
| Target segment (urban, 25–55, chronic conditions or family caregivers) | **~180M people** |
| Willing-to-pay digital health subscribers today | **~30M** (Practo, PharmEasy, etc.) |

**Our addressable market:** Health records management + AI health assistant = an **untapped $800M+ SAM** by 2027. No incumbent owns this category in India.

---

## Business Model

Freemium with monthly subscriptions. No doctor fees, no pharmacy margin — pure SaaS.

| Plan | Price | Limits | Target user |
|------|-------|--------|-------------|
| **Free** | ₹0 | 25 documents, 20 AI chats/day | Acquisition |
| **Pro** | ₹199/month | Unlimited documents + chat | Individual with active health needs |
| **Family** | ₹349/month | Pro for 6 members | Primary caregiver (typically 30–45F) |

**Unit economics (steady state):**
- Blended ARPU: ₹220/month (~$2.60)
- Estimated CAC (digital): ₹300–₹500 (WhatsApp + referral-led)
- Payback period: < 3 months
- Gross margin: ~82% (AI inference + storage are the primary COGS)

**Revenue targets:**

| Year | Paid Users | ARR |
|------|-----------|-----|
| Year 1 | 25,000 | ₹6.6 Cr (~$800K) |
| Year 2 | 150,000 | ₹40 Cr (~$4.8M) |
| Year 3 | 600,000 | ₹158 Cr (~$19M) |

Path to 600K paid users via: B2C (₹), corporate health benefits (B2B2C), and insurance partnerships.

---

## Product — Current State

**Fully functional MVP, ready for beta users.**

| Component | Status |
|-----------|--------|
| iOS + Android app (React Native / Expo) | ✅ Built |
| Web app (Next.js) | ✅ Built |
| Backend API (FastAPI, Python) | ✅ Built + tested |
| AI document extraction (OCR + structured data) | ✅ Live |
| Streaming AI chat with RAG | ✅ Live |
| Medication reminders | ✅ Live |
| Family member management | ✅ Live |
| Multilingual (11 languages) | ✅ Live |
| Payments (Razorpay) | 🔜 Next sprint |
| Server-side push notifications (FCM) | 🔜 Next sprint |
| App Store / Play Store submission | 🔜 After beta |

**Tech stack:** Python/FastAPI backend · Google Gemini 2.0 Flash (AI) · React Native mobile · Next.js web · PostgreSQL · S3-compatible storage. Deployed on AWS Mumbai (low latency for Indian users).

---

## Why AI Works Here

Indian healthcare has characteristics that make AI unusually valuable:

1. **Lab report chaos** — Every lab uses different templates, reference ranges, and units. Our AI normalises across all of them
2. **Language gap** — Most Indians are more comfortable discussing health in their mother tongue, not English
3. **Doctor time scarcity** — Average Indian doctor consultation: 2 minutes. Patients leave confused. mydoc explains the visit
4. **Family decision-making** — Health decisions in India are family-led. The Family plan maps to this cultural reality
5. **WhatsApp as delivery channel** — 500M WhatsApp users in India. Integration roadmap includes WhatsApp bot for frictionless document ingestion

---

## Competitive Landscape

| | Health records | AI analysis | Medication reminders | Indian languages | Family plan |
|--|--|--|--|--|--|
| **mydoc.ai** | ✅ | ✅ | ✅ | ✅ 11 | ✅ |
| Practo | ❌ | ❌ | ❌ | ❌ | ❌ |
| 1mg | ❌ | ❌ | ✅ | ❌ | ❌ |
| mFine | ❌ | ❌ | ❌ | ❌ | ❌ |
| HealthifyMe | ❌ | Fitness only | ❌ | Limited | ❌ |
| Google Health | ❌ India | ❌ | ❌ | ❌ | ❌ |

**The gap is clear.** No existing app combines AI-powered document understanding, multilingual health Q&A, and family-level record management for the Indian market.

---

## Go-to-Market

**Phase 1 — Organic + referral (Months 1–6)**
- Launch on iOS + Android with free tier
- Target: patients with chronic conditions (diabetes, hypertension communities on Facebook/WhatsApp)
- Referral loop: "Share with a family member" → Family plan conversion
- Influencer seeding: doctor YouTubers, health bloggers in regional languages

**Phase 2 — B2B2C (Months 6–18)**
- Corporate health benefits: offer mydoc Pro to employees via HR platforms (Darwinbox, Keka)
- Insurance partnerships: offer Family plan as a value-add to health insurance policyholders
- Diagnostic chain partnerships (Dr Lal PathLabs, Thyrocare): auto-import reports

**Phase 3 — Platform expansion (Year 2+)**
- WhatsApp bot for document ingestion (no app install required)
- Wearable integration (health data from Apple Health / Google Fit)
- Anonymous, consent-based health data insights for pharma/insurance (high-margin B2B revenue stream)

---

## Regulatory & Privacy

- **Data residency:** All data stored on AWS Mumbai (India)
- **Encryption:** At-rest (AES-256) + in-transit (TLS 1.3)
- **No data sharing:** User data is never used to train AI models or sold
- **DPDP Act 2023 compliance:** Explicit consent flows, data export, and account deletion endpoints built in
- **ABDM alignment:** Architecture designed to plug into Ayushman Bharat Digital Mission (Health ID) — a future unlock for 500M+ verified health IDs

---

## The Ask

**Raising ₹X Cr (Seed Round)**

| Use of funds | Allocation |
|---|---|
| Product & engineering (team of 5) | 45% |
| User acquisition (Phase 1 GTM) | 30% |
| Infrastructure & AI costs | 15% |
| Operations & compliance | 10% |

**18-month milestones with this round:**
- 25,000 paid subscribers
- App Store + Play Store launch
- 2 corporate health benefit partnerships
- WhatsApp bot live
- Series A ready at ₹40 Cr ARR run-rate

---

## Why Now

1. **AI cost curve:** Gemini Flash makes per-document AI analysis cost ~₹0.02 — economically viable at ₹199/month subscriptions for the first time
2. **Post-COVID health awareness:** Record number of Indians now actively track their health metrics
3. **DPDP Act 2023:** Clear data privacy rules reduce regulatory risk vs. 2 years ago
4. **Smartphone + UPI saturation:** Distribution and payments infrastructure are mature; the product layer is the gap

---

## Team

| Name | Role | Background |
|------|------|------------|
| [Founder] | CEO & Product | [Background] |
| [Co-founder] | CTO | [Background] |
| [Advisor] | Clinical Advisor | [Background] |

*We are domain experts building for a problem we have personally experienced.*

---

## Contact

**mydoc.ai**
[founder@mydoc.ai]
[+91 — — — — — — — —]

*This document contains forward-looking statements and financial projections. Actual results may differ.*
