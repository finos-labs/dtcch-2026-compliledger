#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REGION=us-east-2
ACCOUNT=154673467918
ECR_REPO="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/settlementguard-backend"
IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo latest)"
CLUSTER=settlementguard-cluster
SERVICE=settlementguard-service
TASK_FAMILY=settlementguard-task
EXEC_ROLE="arn:aws:iam::${ACCOUNT}:role/settlementguardTaskExecutionRole"
TASK_ROLE="arn:aws:iam::${ACCOUNT}:role/settlementguardTaskRole"
ALB_DNS="settlementguard-alb-1419322607.us-east-2.elb.amazonaws.com"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  SettlementGuard — AWS ECS Fargate Deploy"
echo "  Commit: ${IMAGE_TAG}  |  Region: ${REGION}"
echo "═══════════════════════════════════════════════════════"

# ── 1. ECR Login ──────────────────────────────────────────────────────────────
echo ""
echo "▶  1/5  ECR login..."
aws ecr get-login-password --region "${REGION}" | \
  docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

# ── 2. Docker build ───────────────────────────────────────────────────────────
echo ""
echo "▶  2/5  Building Docker image (platform linux/amd64)..."
docker build \
  --platform linux/amd64 \
  -t "settlementguard-backend:${IMAGE_TAG}" \
  -f backend/Dockerfile \
  .

docker tag "settlementguard-backend:${IMAGE_TAG}" "${ECR_REPO}:${IMAGE_TAG}"
docker tag "settlementguard-backend:${IMAGE_TAG}" "${ECR_REPO}:latest"
echo "  Built: ${ECR_REPO}:${IMAGE_TAG}"

# ── 3. Push to ECR ────────────────────────────────────────────────────────────
echo ""
echo "▶  3/5  Pushing to ECR..."
docker push "${ECR_REPO}:${IMAGE_TAG}"
docker push "${ECR_REPO}:latest"
echo "  Pushed: ${ECR_REPO}:latest"

# ── 4. Register new task definition revision ──────────────────────────────────
echo ""
echo "▶  4/5  Registering new task definition revision..."

TASK_DEF_JSON=$(cat <<EOF
{
  "family": "${TASK_FAMILY}",
  "taskRoleArn": "${TASK_ROLE}",
  "executionRoleArn": "${EXEC_ROLE}",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "settlementguard-backend",
      "image": "${ECR_REPO}:${IMAGE_TAG}",
      "essential": true,
      "portMappings": [
        { "containerPort": 3001, "hostPort": 3001, "protocol": "tcp" }
      ],
      "environment": [
        { "name": "NODE_ENV",              "value": "production" },
        { "name": "PORT",                  "value": "3001" },
        { "name": "AWS_REGION",            "value": "${REGION}" },
        { "name": "DYNAMO_TABLE",          "value": "sg-commitment-registry" },
        { "name": "BEDROCK_MODEL_ID",      "value": "us.amazon.nova-micro-v1:0" },
        { "name": "API_BEARER_TOKEN",      "value": "sg-prod-542a6aae6961accc84e43d00f47918c6" },
        { "name": "SG_SIGNING_SEED_B64",   "value": "UPOessT/Z6JPqMrNek9IzM9bVjHKM/y/d12hddEnOwM=" },
        { "name": "SG_KEY_ID",             "value": "sg-prod-key-01" },
        { "name": "SG_KEY_VERSION",        "value": "v1" },
        { "name": "SG_ORACLE_ENABLED",     "value": "false" },
        { "name": "SG_USE_KMS",            "value": "false" },
        { "name": "JSON_BODY_LIMIT",       "value": "32kb" },
        { "name": "POST_RATE_LIMIT_MAX",   "value": "1000" },
        { "name": "CANTON_PARTICIPANT",    "value": "sg-participant-01" },
        { "name": "CANTON_DOMAIN",         "value": "global-synchronizer.canton.network" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/settlementguard-backend",
          "awslogs-region": "${REGION}",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF
)

NEW_TASK_DEF=$(aws ecs register-task-definition \
  --region "${REGION}" \
  --cli-input-json "${TASK_DEF_JSON}" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)

echo "  Registered: ${NEW_TASK_DEF}"

# ── 5. Update ECS service ─────────────────────────────────────────────────────
echo ""
echo "▶  5/5  Updating ECS service..."
aws ecs update-service \
  --region "${REGION}" \
  --cluster "${CLUSTER}" \
  --service "${SERVICE}" \
  --task-definition "${NEW_TASK_DEF}" \
  --force-new-deployment \
  --query 'service.{status:status,desired:desiredCount,taskDef:taskDefinition}' \
  --output table

echo ""
echo "  Waiting for service to stabilise (up to 5 min)..."
aws ecs wait services-stable \
  --region "${REGION}" \
  --cluster "${CLUSTER}" \
  --services "${SERVICE}"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅  Deploy complete!"
echo "  Backend URL : http://${ALB_DNS}"
echo "  Health      : http://${ALB_DNS}/health"
echo "  Public key  : http://${ALB_DNS}/v1/public-key"
echo "═══════════════════════════════════════════════════════"
