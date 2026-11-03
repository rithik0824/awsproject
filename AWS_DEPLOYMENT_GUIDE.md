# 🚀 Complete AWS Step-by-Step Deployment Guide
## Hospital Maintenance Request Portal (CareOps)

This guide takes you step-by-step through deploying and managing the **Hospital Maintenance Request Portal** on AWS using **AWS CloudFormation**, **AWS Systems Manager (SSM)**, **Prometheus & Grafana**, and **GitHub Actions**.

---

## 📑 Table of Contents
1. [Prerequisites & AWS Setup](#1-prerequisites--aws-setup)
2. [Method A: Deploy via AWS Management Console (Beginner Friendly)](#2-method-a-deploy-via-aws-management-console)
3. [Method B: Deploy via AWS CLI (Fast & Scripted)](#3-method-b-deploy-via-aws-cli)
4. [Using AWS Systems Manager (SSM)](#4-using-aws-systems-manager-ssm)
   - [A. Connecting via SSM Session Manager (No SSH Required)](#a-connecting-via-ssm-session-manager-no-ssh-keys-needed)
   - [B. Inspecting SSM Parameter Store](#b-inspecting-ssm-parameter-store)
   - [C. Running Remote Commands via SSM Run Command](#c-running-remote-commands-via-ssm-run-command)
5. [Monitoring with Prometheus & Grafana](#5-monitoring-with-prometheus--grafana)
6. [Method C: Automated CI/CD with GitHub Actions](#6-method-c-automated-cicd-with-github-actions)
7. [Tear Down & Cleanup (Avoid AWS Charges)](#7-tear-down--cleanup-avoid-aws-charges)

---

## 1. Prerequisites & AWS Setup

Before starting, ensure you have:
1. An active **AWS Account** ([aws.amazon.com](https://aws.amazon.com/)).
2. An IAM User or Role with permissions for:
   - CloudFormation (`AWSCloudFormationFullAccess`)
   - EC2 & VPC (`AmazonEC2FullAccess`)
   - IAM Role Creation (`IAMFullAccess`)
   - Systems Manager (`AmazonSSMFullAccess`)
3. Recommended AWS Region: **`us-east-1`** (N. Virginia) or **`us-west-2`** (Oregon).

---

## 2. Method A: Deploy via AWS Management Console

Follow these exact clicks in your web browser:

### Step 1: Open CloudFormation
1. Log into your [AWS Management Console](https://console.aws.amazon.com/).
2. In the top search bar, type **CloudFormation** and select it.
3. In the top right corner, ensure your desired region is selected (e.g., **US East (N. Virginia) us-east-1**).

### Step 2: Create Stack
1. Click the orange **Create stack** button (select **With new resources (standard)**).
2. Under **Prerequisite - Prepare template**, select **Template is ready**.
3. Under **Template source**, select **Upload a template file**.
4. Click **Choose file** and upload the file from your project:
   ```
   awsproject/infrastructure/cloudformation.yml
   ```
5. Click **Next**.

### Step 3: Specify Stack Details
1. **Stack name:** Enter `hospital-maintenance-portal`
2. **Parameters:**
   - **EnvironmentName:** `production`
   - **HospitalName:** `Metropolitan Health Hospital Center` (or your custom hospital name)
   - **InstanceType:** `t3.small` (recommended for running Node.js + Prometheus + Grafana together; `t3.micro` also works)
3. Click **Next**.

### Step 4: Configure Stack Options
1. Leave all default options as they are.
2. Click **Next**.

### Step 5: Review & Acknowledge IAM Capabilities
1. Scroll down to the bottom **Capabilities** banner.
2. Check the box:
   > 🔲 **"I acknowledge that AWS CloudFormation might create IAM resources with custom names."**  
   *(This allows CloudFormation to create the SSM instance profile and role for secure management without SSH).*
3. Click **Submit**.

### Step 6: Access Your Live Application!
1. The stack will show status `CREATE_IN_PROGRESS` (takes ~2-3 minutes).
2. When the status turns to `CREATE_COMPLETE`:
3. Click on the **Outputs** tab. You will see:
   - **PortalURL:** `http://<EC2-PUBLIC-IP>:3000` ➔ Open this in your browser to use the Hospital Portal!
   - **GrafanaURL:** `http://<EC2-PUBLIC-IP>:3001` ➔ Pre-loaded monitoring dashboard!
   - **PrometheusURL:** `http://<EC2-PUBLIC-IP>:9090` ➔ Prometheus metrics explorer!
   - **SSMConnectCommand:** The command to open an instant terminal into the server.
   - **SSMConsoleSessionURL:** Clickable direct link to launch a browser terminal via AWS SSM.

---

## 3. Method B: Deploy via AWS CLI

If you prefer using your terminal with the AWS CLI:

### Step 1: Configure AWS CLI Credentials
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: us-east-1
# Default output format: json
```

### Step 2: Validate the CloudFormation Template
```bash
make cfn-validate
# Or run directly:
aws cloudformation validate-template --template-body file://infrastructure/cloudformation.yml
```

### Step 3: Deploy the Stack
```bash
make cfn-deploy
# Or run directly:
aws cloudformation deploy \
  --template-file infrastructure/cloudformation.yml \
  --stack-name hospital-portal-production \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    EnvironmentName=production \
    HospitalName="Metropolitan General Hospital"
```

### Step 4: Retrieve Deployment Outputs
```bash
aws cloudformation describe-stacks \
  --stack-name hospital-portal-production \
  --query "Stacks[0].Outputs" \
  --output table
```

---

## 4. Using AWS Systems Manager (SSM)

### A. Connecting via SSM Session Manager (No SSH Keys Needed!)
You do **not** need SSH keys (`.pem`), and port `22` is **closed** in the security group.

#### Option 1: From the AWS Console (In Browser)
1. In the AWS Console, search for **Systems Manager**.
2. On the left sidebar under *Node Management*, click **Session Manager**.
3. Click **Start session**.
4. Select your instance (`production-hospital-server`).
5. Click **Start session**. A secure Linux bash terminal opens right in your browser!

#### Option 2: From Your Terminal (AWS CLI)
```bash
make ssm-connect
# Or run directly:
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name hospital-portal-production \
  --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" \
  --output text)

aws ssm start-session --target $INSTANCE_ID
```

Once inside the instance terminal, you can inspect running services:
```bash
sudo su -
cd /opt/hospital-portal
docker compose ps
docker compose logs -f hospital-app
```

---

### B. Inspecting SSM Parameter Store
The portal reads its environment configuration dynamically from AWS Systems Manager Parameter Store.

1. In the AWS Console, search for **Systems Manager**.
2. In the left navigation, click **Parameter Store**.
3. You will see:
   - `/hospital-portal/environment` ➔ `production`
   - `/hospital-portal/hospital-name` ➔ `Metropolitan Health Hospital Center`
   - `/hospital-portal/maintenance-contact` ➔ `facilities-biomed@hospital.org`
   - `/hospital-portal/version` ➔ `1.0.0`
4. If you edit `/hospital-portal/hospital-name` in Parameter Store, the application dynamically reloads it on next refresh!

---

### C. Running Remote Commands via SSM Run Command
To restart or update services on the EC2 instance remotely without logging in:
```bash
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name hospital-portal-production \
  --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" \
  --output text)

aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["docker restart hospital-maintenance-app"]'
```

---

## 5. Monitoring with Prometheus & Grafana

### Prometheus (`http://<EC2-PUBLIC-IP>:9090`)
- Prometheus scrapes `http://hospital-app:3000/metrics` every 5 seconds.
- Example PromQL queries you can try:
  - `hospital_maintenance_active_requests`: Shows active breakdown by priority.
  - `sum(hospital_maintenance_requests_created_total)`: Total requests reported.
  - `rate(http_requests_total[1m])`: Real-time HTTP request throughput.

### Grafana Dashboard (`http://<EC2-PUBLIC-IP>:3001`)
- **Default Login:** `admin` / `admin` (or anonymous viewing enabled).
- The dashboard is automatically loaded under **Dashboards ➔ Hospital Operations ➔ Hospital Maintenance Operations Dashboard**.
- Visualizations included:
  - 🚨 **Active Critical Faults (Immediate)** (Flashing red alerts)
  - 📋 **Total Active Faults** & ⚙️ **In Progress Repairs**
  - 🥧 **Faults by Equipment Category** (Hospital Beds, Air-Conditioning, Lighting, Medical Equipment)
  - 🍩 **Active Faults by Department** (ICU, Surgery, ER, Pediatrics, Radiology)
  - 📈 **Portal Request Rate & API Latency graphs**

---

## 6. Method C: Automated CI/CD with GitHub Actions

To connect your GitHub repository for continuous integration and automated deployment to AWS:

### Step 1: Push Code to Your GitHub Repository
```bash
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git
git branch -M main
git push -u origin main
```

### Step 2: Configure GitHub Repository Secrets
1. Go to your repository on GitHub.
2. Click **Settings** ➔ **Secrets and variables** ➔ **Actions**.
3. Click **New repository secret** and add:
   - `AWS_ACCESS_KEY_ID`: Your IAM user access key
   - `AWS_SECRET_ACCESS_KEY`: Your IAM user secret access key
   - `AWS_REGION`: `us-east-1` (or your chosen region)

### Step 3: Automated Pipeline Execution
- **On every Pull Request / Push:** `.github/workflows/ci.yml` triggers automatically:
  - Installs dependencies & runs unit tests.
  - Validates CloudFormation template syntax and Prometheus/Grafana YAML files.
- **On Push to `main`:** `.github/workflows/deploy.yml` triggers automatically:
  - Deploys or updates the CloudFormation stack.
  - Triggers AWS Systems Manager (SSM) Run Command to update the running container.

---

## 7. Tear Down & Cleanup (Avoid AWS Charges)

When you are done testing or demonstrating the project, delete all created resources to prevent recurring charges:

### Option 1: Via AWS Console
1. Go to **CloudFormation** in the AWS Console.
2. Select `hospital-maintenance-portal`.
3. Click the **Delete** button at the top right.
4. Confirm deletion. CloudFormation will automatically tear down the EC2 instance, VPC, Subnet, Route Table, Internet Gateway, Security Group, and SSM parameters.

### Option 2: Via AWS CLI
```bash
aws cloudformation delete-stack --stack-name hospital-portal-production
```

