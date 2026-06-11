# Deploying mydoc.ai for ₹0/month (beta stack)

Render (API) + Supabase (Postgres + file storage) + Gemini free tier.
Good for a beta with hundreds of users. **Limits:** the API sleeps after
15 min idle (~30-60s cold start), 500 MB database, 1 GB file storage.
When you outgrow it, run `deploy/provision-aws.ps1` (~$35/mo) — same code,
just different env vars.

## 1. Supabase (~5 min) — database + storage

1. https://supabase.com → New project (free), region **Mumbai (ap-south-1)**.
2. **Database URL**: Project Settings → Database → Connection string (URI).
   Convert it for the backend (asyncpg driver, session pooler port 5432):
   `postgresql+asyncpg://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`
3. **Storage**: Storage → Create bucket `documents` (private).
4. **S3 keys**: Project Settings → Storage → "S3 access keys" → New access key.
   Note the endpoint `https://<ref>.supabase.co/storage/v1/s3` and region.

## 2. Render (~5 min) — the API

1. https://render.com → sign in with GitHub.
2. New + → **Blueprint** → select `Kirtan-Rajesh/mydoc.ai` → Apply.
   (Render reads `render.yaml` and creates the `mydoc-api` free web service.)
3. In the service → Environment, fill the blanks:
   - `GEMINI_API_KEY` — your key
   - `DATABASE_URL` — from step 1.2
   - `S3_ENDPOINT_URL`, `S3_BUCKET_NAME` (= `documents`), `AWS_REGION`,
     `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — from step 1.4
4. Deploy. Your API is live at `https://mydoc-api-xxxx.onrender.com`
   (check `/health`). Every push to `main` auto-deploys.

## 3. Point the app at it

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://mydoc-api-xxxx.onrender.com
```

(Or trigger the `Flutter Android build` GitHub Action with that URL — the
APK comes out as a workflow artifact.)

## Notes

- OTPs: `SMS_PROVIDER=console` prints codes in the Render logs
  (Dashboard → Logs). Add MSG91/Twilio keys later for real SMS.
- Keep-awake (optional): a free cron ping (e.g. cron-job.org hitting
  `/health` every 10 min) avoids cold starts during beta hours.
- Upgrade path: Render Starter ($7/mo, no sleep) → AWS App Runner stack.
