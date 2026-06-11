# mydoc.ai — one-shot AWS provisioning (ap-south-1).
# Prereqs: AWS CLI with credentials that can create RDS/S3/ECR/IAM/CodeBuild/AppRunner.
# Idempotent-ish: safe to re-run; existing resources error harmlessly.
#
#   .\deploy\provision-aws.ps1 -GeminiApiKey "<key>"

param(
    [Parameter(Mandatory = $true)] [string]$GeminiApiKey,
    [string]$Region = "ap-south-1"
)

$ErrorActionPreference = "Continue"
$Acct = aws sts get-caller-identity --query Account --output text
$DocsBucket = "mydoc-documents-$Acct"
$BuildBucket = "mydoc-build-$Acct"

# Generated secrets (saved locally, never committed)
$DbPass = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
$AppSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
"DB_PASSWORD=$DbPass`nSECRET_KEY=$AppSecret" | Out-File "$env:USERPROFILE\.mydoc_aws_secrets.txt" -Encoding ascii
Write-Host "Secrets saved to ~\.mydoc_aws_secrets.txt"

Write-Host "== 1/6 ECR + S3 =="
aws ecr create-repository --repository-name mydoc-api --region $Region | Out-Null
aws s3api create-bucket --bucket $DocsBucket --region $Region --create-bucket-configuration LocationConstraint=$Region | Out-Null
aws s3api create-bucket --bucket $BuildBucket --region $Region --create-bucket-configuration LocationConstraint=$Region | Out-Null

Write-Host "== 2/6 RDS Postgres (takes ~8 min; continuing meanwhile) =="
aws rds create-db-instance --db-instance-identifier mydoc-pg `
    --db-instance-class db.t4g.micro --engine postgres --engine-version 16.3 `
    --master-username mydoc --master-user-password $DbPass `
    --allocated-storage 20 --storage-type gp3 --db-name mydoc `
    --publicly-accessible --no-multi-az --backup-retention-period 1 --region $Region | Out-Null

Write-Host "== 3/6 IAM roles =="
$cbTrust = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"codebuild.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam create-role --role-name mydoc-codebuild-role --assume-role-policy-document $cbTrust | Out-Null
$cbPolicy = @"
{"Version":"2012-10-17","Statement":[
 {"Effect":"Allow","Action":["ecr:GetAuthorizationToken"],"Resource":"*"},
 {"Effect":"Allow","Action":["ecr:BatchCheckLayerAvailability","ecr:PutImage","ecr:InitiateLayerUpload","ecr:UploadLayerPart","ecr:CompleteLayerUpload","ecr:BatchGetImage","ecr:GetDownloadUrlForLayer"],"Resource":"arn:aws:ecr:${Region}:${Acct}:repository/mydoc-api"},
 {"Effect":"Allow","Action":["s3:GetObject","s3:GetObjectVersion"],"Resource":"arn:aws:s3:::${BuildBucket}/*"},
 {"Effect":"Allow","Action":["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],"Resource":"*"}]}
"@
aws iam put-role-policy --role-name mydoc-codebuild-role --policy-name mydoc-codebuild --policy-document $cbPolicy | Out-Null

$arTrust = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"build.apprunner.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam create-role --role-name mydoc-apprunner-ecr-role --assume-role-policy-document $arTrust | Out-Null
aws iam attach-role-policy --role-name mydoc-apprunner-ecr-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess | Out-Null

$instTrust = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"tasks.apprunner.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam create-role --role-name mydoc-apprunner-instance-role --assume-role-policy-document $instTrust | Out-Null
$instPolicy = @"
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject"],"Resource":"arn:aws:s3:::${DocsBucket}/*"}]}
"@
aws iam put-role-policy --role-name mydoc-apprunner-instance-role --policy-name mydoc-s3 --policy-document $instPolicy | Out-Null

Write-Host "== 4/6 CodeBuild project + first build =="
Compress-Archive -Path backend -DestinationPath "$env:TEMP\mydoc-src.zip" -Force
aws s3 cp "$env:TEMP\mydoc-src.zip" "s3://$BuildBucket/src.zip" | Out-Null
Start-Sleep -Seconds 10   # IAM eventual consistency
aws codebuild create-project --name mydoc-api-build --region $Region `
    --source "type=S3,location=$BuildBucket/src.zip,buildspec=backend/buildspec.yml" `
    --artifacts type=NO_ARTIFACTS `
    --environment "type=LINUX_CONTAINER,image=aws/codebuild/standard:7.0,computeType=BUILD_GENERAL1_SMALL,privilegedMode=true" `
    --service-role "arn:aws:iam::${Acct}:role/mydoc-codebuild-role" | Out-Null
$buildId = (aws codebuild start-build --project-name mydoc-api-build --region $Region --query build.id --output text)
Write-Host "Build started: $buildId — waiting..."
do {
    Start-Sleep -Seconds 20
    $status = aws codebuild batch-get-builds --ids $buildId --region $Region --query "builds[0].buildStatus" --output text
    Write-Host "  build: $status"
} while ($status -eq "IN_PROGRESS")
if ($status -ne "SUCCEEDED") { Write-Error "CodeBuild failed: $status"; exit 1 }

Write-Host "== 5/6 Waiting for RDS endpoint =="
do {
    Start-Sleep -Seconds 30
    $dbStatus = aws rds describe-db-instances --db-instance-identifier mydoc-pg --region $Region --query "DBInstances[0].DBInstanceStatus" --output text
    Write-Host "  rds: $dbStatus"
} while ($dbStatus -ne "available")
$DbHost = aws rds describe-db-instances --db-instance-identifier mydoc-pg --region $Region --query "DBInstances[0].Endpoint.Address" --output text
# Open 5432 (MVP; tighten to App Runner VPC connector later)
$SgId = aws rds describe-db-instances --db-instance-identifier mydoc-pg --region $Region --query "DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId" --output text
aws ec2 authorize-security-group-ingress --group-id $SgId --protocol tcp --port 5432 --cidr 0.0.0.0/0 --region $Region | Out-Null

Write-Host "== 6/6 App Runner service =="
$svc = @"
{
  "ServiceName": "mydoc-api",
  "SourceConfiguration": {
    "AuthenticationConfiguration": {"AccessRoleArn": "arn:aws:iam::${Acct}:role/mydoc-apprunner-ecr-role"},
    "AutoDeploymentsEnabled": true,
    "ImageRepository": {
      "ImageIdentifier": "${Acct}.dkr.ecr.${Region}.amazonaws.com/mydoc-api:latest",
      "ImageRepositoryType": "ECR",
      "ImageConfiguration": {
        "Port": "8000",
        "RuntimeEnvironmentVariables": {
          "ENVIRONMENT": "production",
          "DEBUG": "false",
          "DATABASE_URL": "postgresql+asyncpg://mydoc:${DbPass}@${DbHost}:5432/mydoc",
          "DB_SSL": "true",
          "STORAGE_BACKEND": "s3",
          "S3_BUCKET_NAME": "${DocsBucket}",
          "AWS_REGION": "${Region}",
          "SECRET_KEY": "${AppSecret}",
          "GEMINI_API_KEY": "${GeminiApiKey}",
          "LLM_PROVIDER": "auto",
          "CHAT_MODEL": "gemini-3.1-flash-lite",
          "VISION_MODEL": "gemini-3.1-flash-lite",
          "EMBED_MODEL": "gemini-embedding-001",
          "SMS_PROVIDER": "console"
        }
      }
    }
  },
  "InstanceConfiguration": {
    "Cpu": "1024",
    "Memory": "2048",
    "InstanceRoleArn": "arn:aws:iam::${Acct}:role/mydoc-apprunner-instance-role"
  },
  "HealthCheckConfiguration": {"Protocol": "HTTP", "Path": "/health"}
}
"@
$svc | Out-File "$env:TEMP\mydoc-apprunner.json" -Encoding ascii
$url = aws apprunner create-service --region $Region --cli-input-json "file://$env:TEMP\mydoc-apprunner.json" --query "Service.ServiceUrl" --output text
Remove-Item "$env:TEMP\mydoc-apprunner.json" -Force

Write-Host ""
Write-Host "DONE. API will be live shortly at: https://$url"
Write-Host "Check:  curl https://$url/health"
Write-Host "Flutter: flutter build apk --release --dart-define=API_BASE_URL=https://$url"
