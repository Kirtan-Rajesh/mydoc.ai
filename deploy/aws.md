# Deploying mydoc.ai to AWS (Mumbai / ap-south-1)

Stack: **App Runner** (autoscaling containers, no load-balancer fee) +
**RDS Postgres** (db.t4g.micro) + **S3** (documents) + **CodeBuild → ECR**
(cloud image builds, so no local Docker is needed).

**Baseline cost: ~$30–45/month** (≈₹2.5–4K): App Runner ~$10–25 (idle
provisioned memory + active vCPU), RDS t4g.micro ~$13 + 20GB gp3, S3/ECR
pennies. Scales to lakhs of users by raising App Runner max instances and
the RDS tier — no architecture change.

The whole setup is scripted in [`provision-aws.ps1`](./provision-aws.ps1)
(PowerShell; run it step by step or end to end). What it does:

## 1. One-time infrastructure

```powershell
$REGION = "ap-south-1"; $ACCT = (aws sts get-caller-identity --query Account --output text)

# Container registry + buckets
aws ecr create-repository --repository-name mydoc-api --region $REGION
aws s3api create-bucket --bucket "mydoc-documents-$ACCT" --region $REGION `
  --create-bucket-configuration LocationConstraint=$REGION
aws s3api create-bucket --bucket "mydoc-build-$ACCT" --region $REGION `
  --create-bucket-configuration LocationConstraint=$REGION

# Postgres (public endpoint for MVP simplicity; restrict SG to App Runner later)
aws rds create-db-instance --db-instance-identifier mydoc-pg `
  --db-instance-class db.t4g.micro --engine postgres --engine-version 16.3 `
  --master-username mydoc --master-user-password "<DB_PASSWORD>" `
  --allocated-storage 20 --storage-type gp3 --db-name mydoc `
  --publicly-accessible --no-multi-az --backup-retention-period 1 --region $REGION
```

## 2. IAM roles

- `mydoc-codebuild-role` — trust `codebuild.amazonaws.com`; permissions: ECR
  push, S3 read on the build bucket, CloudWatch logs.
- `mydoc-apprunner-ecr-role` — trust `build.apprunner.amazonaws.com`;
  managed policy `AWSAppRunnerServicePolicyForECRAccess`.
- `mydoc-apprunner-instance-role` — trust `tasks.apprunner.amazonaws.com`;
  S3 read/write on the documents bucket.

## 3. Build the image in the cloud

```powershell
# zip the repo source -> S3, then CodeBuild builds backend/Dockerfile -> ECR
Compress-Archive -Path backend, deploy -DestinationPath src.zip -Force
aws s3 cp src.zip "s3://mydoc-build-$ACCT/src.zip"
aws codebuild create-project --name mydoc-api-build --region $REGION `
  --source "type=S3,location=mydoc-build-$ACCT/src.zip,buildspec=backend/buildspec.yml" `
  --artifacts type=NO_ARTIFACTS `
  --environment "type=LINUX_CONTAINER,image=aws/codebuild/standard:7.0,computeType=BUILD_GENERAL1_SMALL,privilegedMode=true" `
  --service-role mydoc-codebuild-role
aws codebuild start-build --project-name mydoc-api-build --region $REGION
```

## 4. App Runner service

```powershell
aws apprunner create-service --service-name mydoc-api --region $REGION --cli-input-json file://deploy/apprunner-service.json
```

Key env vars on the service (see `apprunner-service.json` template):

```
ENVIRONMENT=production  DEBUG=false
DATABASE_URL=postgresql+asyncpg://mydoc:<DB_PASSWORD>@<RDS_ENDPOINT>:5432/mydoc
DB_SSL=true
STORAGE_BACKEND=s3  S3_BUCKET_NAME=mydoc-documents-<ACCT>  AWS_REGION=ap-south-1
SECRET_KEY=<openssl rand>  GEMINI_API_KEY=<key>  LLM_PROVIDER=auto
CHAT_MODEL=gemini-3.1-flash-lite  VISION_MODEL=gemini-3.1-flash-lite
EMBED_MODEL=gemini-embedding-001
SMS_PROVIDER=console            # OTPs appear in App Runner logs until an SMS provider is added
```

## 5. Point the app at it

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://<apprunner-url>
```

## Releases

Re-zip → `aws s3 cp` → `aws codebuild start-build` → App Runner auto-deploys
when `AutoDeploymentsEnabled=true` on image push. The GitHub Action
(`.github/workflows/deploy-aws.yaml`) does exactly this on push to `main`.

## Hardening backlog (post-MVP)

- Restrict the RDS security group to App Runner's VPC connector instead of public.
- Move secrets to SSM Parameter Store / Secrets Manager references.
- RDS CA bundle + full TLS verification (currently encrypt-only).
- CloudWatch alarm on App Runner 5xx + RDS CPU.
- Real SMS provider (MSG91/Twilio/SNS-DLT) when available.
