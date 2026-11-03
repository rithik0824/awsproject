# 🏥 CareOps - Hospital Maintenance Request & Fault Tracking Portal

> **Problem Statement:** Hospitals depend on working beds, air-conditioning (HVAC), surgical/ward lights, and life-critical equipment, but maintenance requests can be lost, delayed, or lack visibility.  
> **Proposed Solution:** A centralized, high-availability maintenance request portal allowing hospital staff to report faults in real-time, prioritize urgency, dispatch technicians, track repair lifecycles, and monitor equipment health via Prometheus & Grafana.

---

## 🌟 Architecture & Tech Stack

```mermaid
flowchart TD
    subgraph Hospital["🏥 Hospital Environment"]
        Staff["Hospital Staff / Nurses / Doctors"]
        Tech["Biomed & Facilities Technicians"]
    end

    subgraph AWS["☁️ AWS Cloud (VPC)"]
        subgraph Security["Security & Access"]
            SSM["AWS Systems Manager (SSM)"]
            ParamStore["SSM Parameter Store"]
        end

        subgraph EC2["EC2 Instance (Amazon Linux 2023)"]
            App["CareOps Web Portal (Node.js/Express :3000)"]
            Prom["Prometheus (:9090)"]
            Graf["Grafana Dashboard (:3001)"]
            DB[("SQLite Embedded Database")]
        end
    end

    subgraph CI_CD["🚀 DevOps Pipeline"]
        GH["GitHub Repository"]
        GHA["GitHub Actions (CI/CD)"]
        CFN["AWS CloudFormation"]
    end

    Staff -->|Report Bed/AC/Light Fault| App
    Tech -->|Update Status & Assign Tech| App
    App <--> DB
    App -->|Fetch Config| ParamStore
    Prom -->|Scrape /metrics| App
    Graf -->|Query Metrics| Prom
    SSM -.->|Secure Browser Terminal (No SSH)| EC2
    GH -->|Push Code| GHA
    GHA -->|Deploy Stack| CFN
    GHA -->|Run Command| SSM
    CFN -->|Provision Infrastructure| AWS
```

### Core Technologies
- **Application:** Node.js, Express, SQLite, HTML5, CSS3, JavaScript (CareOps Medical Portal).
- **AWS Infrastructure:** AWS CloudFormation (Infrastructure-as-Code for VPC, Subnet, IGW, Security Groups, IAM Roles, EC2).
- **AWS Systems Manager (SSM):**
  - **Parameter Store:** Centralized environment configuration (`/hospital-portal/*`).
  - **Session Manager:** 100% secure shell access without opening port 22 or managing `.pem` SSH keys.
  - **Run Command:** Remote zero-downtime updates and deployment automation.
- **Observability:**
  - **Prometheus:** Scrapes application metrics (`/metrics`), status transitions, active critical faults, and API latencies.
  - **Grafana:** Pre-provisioned operations dashboard with equipment category breakdowns (Beds, HVAC, Lighting, Medical Devices), active critical alerts, and department heatmaps.
- **CI/CD:** GitHub Actions workflows for automated linting, test suites, CloudFormation validation, and AWS deployments.

---

## 📋 Features

1. **Equipment Fault Reporting:**
   - Hospital Beds & Electric Lifts
   - Air Conditioning, Cleanroom Chiller & HVAC Units
   - Surgical Spotlights & Ward Lighting
   - Life-Support & Medical Equipment (Defibrillators, Monitors, Patient Pumps)
   - Medical Oxygen & Plumbing Systems
2. **Triage & Priority Management:**
   - **CRITICAL:** Immediate Patient / Life-Safety Risk (triggers alert status)
   - **HIGH:** Urgent clinical impact
   - **MEDIUM:** Degraded operation
   - **LOW:** Routine cosmetic maintenance
3. **Technician Workflow & Repair Status Tracking:**
   - Statuses: `OPEN` ➔ `ASSIGNED` ➔ `IN_PROGRESS` ➔ `RESOLVED` ➔ `CLOSED`
   - Assignable to specialized technicians (Biomedical, HVAC Specialist, Master Electrician, Facilities).
   - Maintenance resolution notes & parts replaced logging.
4. **Real-time Observability:**
   - Real-time KPI statistics cards.
   - Prometheus scrape endpoint at `/metrics`.
   - Pre-configured Grafana dashboard auto-loaded on port `3001`.
5. **Enterprise AWS Security:**
   - Zero SSH keys. Instance is managed purely via **AWS Systems Manager (SSM)**.

---

## 📁 Project Structure

```
.
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Automated test suite and CFN template validation
│       └── deploy.yml             # AWS CloudFormation deployment & SSM Run Command CD
├── app/
│   ├── public/                    # Frontend assets
│   │   ├── index.html             # Hospital Portal web interface
│   │   ├── css/style.css          # Medical UI styling & responsive layout
│   │   └── js/app.js              # Real-time ticket management logic
│   ├── src/
│   │   ├── server.js              # Express REST API, healthcheck & metrics server
│   │   ├── db.js                  # SQLite database layer with auto-seeding
│   │   ├── metrics.js             # Prometheus custom operational metrics
│   │   └── ssm.js                 # AWS Systems Manager Parameter Store client
│   ├── tests/
│   │   └── server.test.js         # Integration and unit tests
│   ├── Dockerfile                 # Container image for application
│   └── package.json
├── monitoring/
│   ├── prometheus/
│   │   └── prometheus.yml         # Prometheus scrape config
│   └── grafana/
│       ├── dashboards/
│       │   └── hospital-portal-dashboard.json # Pre-built operations dashboard
│       └── provisioning/
│           ├── dashboards/dashboard.yml
│           └── datasources/datasource.yml
├── infrastructure/
│   ├── cloudformation.yml         # AWS CloudFormation IaC template
│   └── ssm-run-command-deploy.json# SSM Run Command automation document
├── docker-compose.yml             # Unified local & server container runner
├── Makefile                       # Convenience commands
├── README.md                      # Project documentation
└── AWS_DEPLOYMENT_GUIDE.md        # Complete AWS step-by-step walkthrough
```

---

## ⚡ Quick Start (Local Run)

### Option A: Run with Docker Compose (Recommended)
Spins up the **App**, **Prometheus**, and **Grafana** together:
```bash
docker compose up -d
```
- 🌐 **Hospital Portal UI:** [http://localhost:3000](http://localhost:3000)
- 📊 **Prometheus Scraper:** [http://localhost:9090](http://localhost:9090)
- 📈 **Grafana Dashboard:** [http://localhost:3001](http://localhost:3001) (User: `admin` / Pass: `admin`)
- 🩺 **Health Check:** [http://localhost:3000/health](http://localhost:3000/health)
- 📋 **Prometheus Metrics:** [http://localhost:3000/metrics](http://localhost:3000/metrics)

To stop the containers:
```bash
docker compose down
```

---

### Option B: Run Application Directly on Node.js
```bash
cd app
npm install
npm test      # Run automated tests
npm start     # Runs on http://localhost:3000
```

---

## 🚀 AWS Deployment Guide

For full step-by-step instructions with AWS Console, AWS CLI, and GitHub Actions, please see:
👉 **[AWS_DEPLOYMENT_GUIDE.md](file:///Users/rithxk/awsproject/AWS_DEPLOYMENT_GUIDE.md)**
