.PHONY: help install test dev run docker-up docker-down docker-logs cfn-validate cfn-deploy ssm-connect

help:
	@echo "🏥 CareOps - Hospital Maintenance Portal Make Targets:"
	@echo "  make install        - Install Node dependencies"
	@echo "  make test           - Run automated tests"
	@echo "  make dev            - Run backend with hot reload (http://localhost:3000)"
	@echo "  make docker-up      - Run entire stack (App + Prometheus + Grafana) via Docker Compose"
	@echo "  make docker-down    - Stop and remove Docker containers"
	@echo "  make cfn-validate   - Validate AWS CloudFormation template"
	@echo "  make cfn-deploy     - Deploy CloudFormation stack to AWS"
	@echo "  make ssm-connect    - Connect to EC2 instance via AWS SSM Session Manager"

install:
	cd app && npm install

test:
	cd app && npm test

dev:
	cd app && npm run dev

run:
	cd app && npm start

docker-up:
	docker compose up --build -d
	@echo "🚀 Application: http://localhost:3000"
	@echo "📊 Prometheus:  http://localhost:9090"
	@echo "📈 Grafana:     http://localhost:3001 (User: admin / Pass: admin)"

docker-down:
	docker compose down -v

docker-logs:
	docker compose logs -f

cfn-validate:
	aws cloudformation validate-template --template-body file://infrastructure/cloudformation.yml

cfn-deploy:
	aws cloudformation deploy \
	  --template-file infrastructure/cloudformation.yml \
	  --stack-name hospital-portal-production \
	  --capabilities CAPABILITY_NAMED_IAM \
	  --parameter-overrides EnvironmentName=production

ssm-connect:
	@INSTANCE_ID=$$(aws cloudformation describe-stacks \
	  --stack-name hospital-portal-production \
	  --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" \
	  --output text) && \
	echo "Connecting to EC2 instance $$INSTANCE_ID via AWS Systems Manager..." && \
	aws ssm start-session --target $$INSTANCE_ID

