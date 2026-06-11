# Deploying mydoc.ai to Google Cloud Run

Total infra at launch: **Cloud Run + Cloud SQL (Postgres) + a GCS bucket.**
Expected cost: ~₹3-8K/month at low traffic, scaling linearly with use.
Cloud Run autoscales 0→N instances; lakhs of registered users is comfortably
within a few dozen instances at peak.

## One-time setup (~15 minutes)

```bash
# 0. Login + project
gcloud auth login
gcloud projects create mydoc-prod --name="mydoc.ai"
gcloud config set project mydoc-prod
gcloud config set run/region asia-south1        # Mumbai

# 1. Enable services
gcloud services enable run.googleapis.com sqladmin.googleapis.com \
  storage.googleapis.com secretmanager.googleapis.com \
  artifactregistry.googleapis.com cloudbuild.googleapis.com

# 2. Postgres (cheapest HA-ready tier; resize anytime)
gcloud sql instances create mydoc-pg \
  --database-version=POSTGRES_16 --tier=db-g1-small \
  --region=asia-south1 --storage-auto-increase
gcloud sql databases create mydoc --instance=mydoc-pg
gcloud sql users create mydoc --instance=mydoc-pg --password='<DB_PASSWORD>'

# 3. Storage bucket for documents
gcloud storage buckets create gs://mydoc-prod-documents \
  --location=asia-south1 --uniform-bucket-level-access

# 4. Secrets
python -c "import secrets; print(secrets.token_urlsafe(48))"   # SECRET_KEY
echo -n '<SECRET_KEY>'      | gcloud secrets create app-secret-key --data-file=-
echo -n '<GEMINI_API_KEY>'  | gcloud secrets create gemini-api-key --data-file=-
echo -n '<DB_PASSWORD>'     | gcloud secrets create db-password    --data-file=-
```

## Deploy (every release — or use the GitHub Action)

```bash
cd backend
gcloud run deploy mydoc-api \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --min-instances 0 --max-instances 50 \
  --memory 1Gi --cpu 1 --concurrency 40 \
  --add-cloudsql-instances mydoc-prod:asia-south1:mydoc-pg \
  --set-env-vars "ENVIRONMENT=production,DEBUG=false,STORAGE_BACKEND=gcs,GCS_BUCKET_NAME=mydoc-prod-documents,SMS_PROVIDER=msg91,LLM_PROVIDER=auto,DATABASE_URL=postgresql+asyncpg://mydoc:<DB_PASSWORD>@/mydoc?host=/cloudsql/mydoc-prod:asia-south1:mydoc-pg" \
  --set-secrets "SECRET_KEY=app-secret-key:latest,GEMINI_API_KEY=gemini-api-key:latest"
```

The service URL it prints is your API base; point the Flutter build at it:

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://mydoc-api-xxxx.run.app
```

## Notes

- **SMS**: create an MSG91 account (cheapest OTP SMS for India), add
  `MSG91_AUTH_KEY` + `MSG91_TEMPLATE_ID` env vars. Until then OTPs only
  appear in Cloud Run logs.
- **Custom domain**: `gcloud run domain-mappings create --service mydoc-api
  --domain api.mydoc.ai`, then add the DNS records it prints. Put Cloudflare
  in front for CDN/WAF if desired.
- **Scaling knobs**: raise `--max-instances` and the Cloud SQL tier; nothing
  else changes. At very high sustained load set `--min-instances 1` to remove
  cold starts.
- **Model swap**: change `CHAT_MODEL`/`VISION_MODEL` env vars (e.g. to
  `gemini-2.5-pro`) and redeploy — no code change.
- **Migrations**: schema is auto-created on boot today. Before the schema
  starts evolving under live traffic, introduce Alembic.
