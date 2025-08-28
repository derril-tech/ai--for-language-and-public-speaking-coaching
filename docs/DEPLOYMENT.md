# AI Coaching Platform - Production Deployment Guide

## Overview

This document provides comprehensive instructions for deploying the AI Coaching Platform to production using Kubernetes, Docker, and modern DevOps practices.

## Architecture

The production deployment consists of:

- **Frontend**: Next.js application served via Nginx
- **API Gateway**: NestJS application handling REST and WebSocket connections
- **AI Workers**: Python FastAPI services for processing (ASR, Prosody, Fluency, etc.)
- **Infrastructure**: PostgreSQL, Redis, NATS, MinIO
- **Monitoring**: Prometheus, Grafana, OpenTelemetry
- **Backup**: Automated database and file backups

## Prerequisites

### Infrastructure Requirements

- **Kubernetes Cluster**: v1.24+ with at least 8 nodes
- **GPU Nodes**: 2+ nodes with NVIDIA GPUs for AI processing
- **Storage**: Fast SSD storage (100GB+ for database, 500GB+ for files)
- **Network**: Load balancer with SSL termination
- **DNS**: Domain names configured for services

### Software Requirements

- **kubectl**: v1.24+
- **kustomize**: v4.0+
- **docker**: v20.10+
- **helm**: v3.8+ (optional)

### Cloud Provider Setup

#### AWS EKS
```bash
# Create EKS cluster
eksctl create cluster \
  --name ai-coaching-prod \
  --region us-west-2 \
  --nodegroup-name standard-workers \
  --node-type m5.large \
  --nodes 3 \
  --nodes-min 1 \
  --nodes-max 10 \
  --managed

# Create GPU node group
eksctl create nodegroup \
  --cluster ai-coaching-prod \
  --region us-west-2 \
  --name gpu-workers \
  --node-type g4dn.xlarge \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 4 \
  --managed
```

#### GCP GKE
```bash
# Create GKE cluster
gcloud container clusters create ai-coaching-prod \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-4 \
  --enable-autoscaling \
  --min-nodes 1 \
  --max-nodes 10

# Add GPU node pool
gcloud container node-pools create gpu-pool \
  --cluster ai-coaching-prod \
  --zone us-central1-a \
  --machine-type n1-standard-4 \
  --accelerator type=nvidia-tesla-t4,count=1 \
  --num-nodes 2 \
  --enable-autoscaling \
  --min-nodes 1 \
  --max-nodes 4
```

## Deployment Steps

### 1. Infrastructure Setup

#### Install Required Operators

```bash
# Install cert-manager for SSL certificates
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml

# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.7.1/deploy/static/provider/cloud/deploy.yaml

# Install NVIDIA GPU Operator
helm repo add nvidia https://helm.ngc.nvidia.com/nvidia
helm repo update
helm install --generate-name nvidia/gpu-operator
```

#### Configure Storage

```bash
# Create storage classes
kubectl apply -f infra/kubernetes/production/storage-classes.yaml

# Create persistent volumes (if needed)
kubectl apply -f infra/kubernetes/production/persistent-volumes.yaml
```

### 2. Secrets Management

#### Create Kubernetes Secrets

```bash
# Create namespace
kubectl create namespace ai-coaching

# Apply secrets (update with your actual values)
kubectl apply -f infra/kubernetes/production/secrets.yaml

# Or use external secret management
kubectl apply -f infra/kubernetes/production/external-secrets.yaml
```

#### Configure External Secrets (Optional)

```bash
# Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets

# Configure AWS Secrets Manager
kubectl apply -f infra/kubernetes/production/external-secrets-config.yaml
```

### 3. Database Setup

#### Initialize PostgreSQL

```bash
# Deploy PostgreSQL with TimescaleDB
kubectl apply -f infra/kubernetes/production/deployment-infrastructure.yaml

# Wait for PostgreSQL to be ready
kubectl wait --for=condition=ready pod -l app=ai-coaching-postgres -n ai-coaching

# Run database migrations
kubectl exec -it deployment/ai-coaching-gateway -n ai-coaching -- npm run migration:run
```

#### Database Configuration

```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create hypertables for time-series data
SELECT create_hypertable('metrics', 'timestamp');
SELECT create_hypertable('audit_log', 'created_at');

-- Set up continuous aggregates
SELECT add_continuous_aggregate_policy('metrics_1min',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute');
```

### 4. Application Deployment

#### Deploy Infrastructure Services

```bash
# Deploy core infrastructure
kubectl apply -f infra/kubernetes/production/deployment-infrastructure.yaml

# Verify all services are running
kubectl get pods -n ai-coaching
```

#### Deploy Application Services

```bash
# Deploy using kustomize
cd infra/kubernetes/production
kustomize build . | kubectl apply -f -

# Or deploy individual components
kubectl apply -f deployment-gateway.yaml
kubectl apply -f deployment-frontend.yaml
kubectl apply -f deployment-workers.yaml
```

#### Verify Deployment

```bash
# Check all deployments
kubectl get deployments -n ai-coaching

# Check services
kubectl get services -n ai-coaching

# Check ingress
kubectl get ingress -n ai-coaching

# Check pods
kubectl get pods -n ai-coaching
```

### 5. Monitoring Setup

#### Deploy Monitoring Stack

```bash
# Deploy Prometheus and Grafana
kubectl apply -f infra/kubernetes/production/deployment-monitoring.yaml

# Access Grafana (default credentials: admin/admin)
kubectl port-forward svc/ai-coaching-grafana-service 3000:3000 -n ai-coaching
```

#### Configure Alerts

```bash
# Apply Prometheus alerting rules
kubectl apply -f infra/prometheus/rules/

# Configure alert manager
kubectl apply -f infra/kubernetes/production/alertmanager.yaml
```

### 6. Backup Configuration

#### Deploy Backup Jobs

```bash
# Deploy backup cronjobs
kubectl apply -f infra/kubernetes/production/backup-cronjob.yaml

# Verify backup jobs
kubectl get cronjobs -n ai-coaching
```

#### Test Backup

```bash
# Manually trigger a backup
kubectl create job --from=cronjob/ai-coaching-db-backup manual-backup -n ai-coaching

# Check backup status
kubectl get jobs -n ai-coaching
kubectl logs job/manual-backup -n ai-coaching
```

## Configuration

### Environment Variables

Key environment variables for production:

```bash
# Application
NODE_ENV=production
PORT=3001
FRONTEND_PORT=3000

# Database
POSTGRES_HOST=ai-coaching-postgres-service
POSTGRES_PORT=5432
POSTGRES_DB=ai_coaching
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<secure-password>

# Redis
REDIS_HOST=ai-coaching-redis-service
REDIS_PORT=6379
REDIS_PASSWORD=<secure-password>

# NATS
NATS_URL=nats://ai-coaching-nats-service:4222

# S3/MinIO
S3_ENDPOINT=ai-coaching-minio-service:9000
S3_ACCESS_KEY=minio
S3_SECRET_KEY=<secure-password>
S3_BUCKET=ai-coaching-media

# Security
JWT_SECRET=<secure-jwt-secret>
JWT_REFRESH_SECRET=<secure-refresh-secret>
API_KEY_SECRET=<secure-api-key>

# Monitoring
OTEL_ENABLED=true
OTEL_SERVICE_NAME=ai-coaching-gateway
OTEL_TRACE_ENDPOINT=http://otel-collector:4318/v1/traces
OTEL_METRIC_ENDPOINT=http://otel-collector:4318/v1/metrics
```

### SSL/TLS Configuration

#### Using cert-manager with Let's Encrypt

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@ai-coaching.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

#### Using Custom Certificates

```bash
# Create TLS secret
kubectl create secret tls ai-coaching-tls \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem \
  -n ai-coaching
```

## Scaling

### Horizontal Pod Autoscaling

```bash
# Create HPA for API Gateway
kubectl apply -f infra/kubernetes/production/hpa-gateway.yaml

# Create HPA for Frontend
kubectl apply -f infra/kubernetes/production/hpa-frontend.yaml

# Create HPA for Workers
kubectl apply -f infra/kubernetes/production/hpa-workers.yaml
```

### Vertical Pod Autoscaling

```bash
# Enable VPA
kubectl apply -f infra/kubernetes/production/vpa.yaml
```

## Security

### Network Policies

```bash
# Apply network policies
kubectl apply -f infra/kubernetes/production/network-policies.yaml
```

### Pod Security Standards

```bash
# Apply pod security standards
kubectl apply -f infra/kubernetes/production/pod-security.yaml
```

### RBAC Configuration

```bash
# Apply RBAC rules
kubectl apply -f infra/kubernetes/production/rbac.yaml
```

## Monitoring and Alerting

### Key Metrics to Monitor

- **Application Metrics**: Request rate, response time, error rate
- **Infrastructure Metrics**: CPU, memory, disk usage
- **Business Metrics**: Active users, sessions processed, revenue
- **AI Worker Metrics**: Processing time, queue length, GPU utilization

### Alert Rules

```yaml
# High error rate
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: High error rate detected

# Database connection issues
- alert: DatabaseDown
  expr: up{job="postgres"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: Database is down

# GPU worker failures
- alert: GPUWorkerDown
  expr: up{job=~"ai-coaching-.*-worker"} == 0
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: GPU worker is down
```

## Troubleshooting

### Common Issues

#### Pod Startup Issues

```bash
# Check pod events
kubectl describe pod <pod-name> -n ai-coaching

# Check pod logs
kubectl logs <pod-name> -n ai-coaching

# Check previous pod logs
kubectl logs <pod-name> -n ai-coaching --previous
```

#### Database Connection Issues

```bash
# Check PostgreSQL status
kubectl exec -it deployment/ai-coaching-postgres -n ai-coaching -- pg_isready

# Check database logs
kubectl logs deployment/ai-coaching-postgres -n ai-coaching

# Test connection from gateway
kubectl exec -it deployment/ai-coaching-gateway -n ai-coaching -- npm run db:test
```

#### GPU Issues

```bash
# Check GPU availability
kubectl get nodes -o json | jq '.items[] | {name: .metadata.name, gpu: .status.allocatable."nvidia.com/gpu"}'

# Check GPU operator status
kubectl get pods -n gpu-operator-resources

# Check GPU worker logs
kubectl logs deployment/ai-coaching-asr-worker -n ai-coaching
```

### Performance Tuning

#### Database Optimization

```sql
-- Analyze table statistics
ANALYZE;

-- Update table statistics
VACUUM ANALYZE;

-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

#### Redis Optimization

```bash
# Check Redis memory usage
kubectl exec -it deployment/ai-coaching-redis -n ai-coaching -- redis-cli info memory

# Check Redis slow queries
kubectl exec -it deployment/ai-coaching-redis -n ai-coaching -- redis-cli slowlog get 10
```

## Backup and Recovery

### Backup Verification

```bash
# List available backups
mc ls s3/ai-coaching-media/backups/database/

# Test backup restoration
kubectl create job --from=cronjob/ai-coaching-db-backup test-restore -n ai-coaching
```

### Disaster Recovery

#### Database Recovery

```bash
# Stop applications
kubectl scale deployment ai-coaching-gateway --replicas=0 -n ai-coaching

# Restore database
kubectl exec -it deployment/ai-coaching-postgres -n ai-coaching -- \
  pg_restore -d ai_coaching /backup/ai-coaching-db-20231201_020000.sql

# Restart applications
kubectl scale deployment ai-coaching-gateway --replicas=3 -n ai-coaching
```

#### File Recovery

```bash
# Restore files from backup
mc mirror s3/ai-coaching-media/backups/files/media-20231201_030000/ s3/ai-coaching-media/media/
```

## Maintenance

### Regular Maintenance Tasks

#### Database Maintenance

```bash
# Run daily maintenance
kubectl create job --from=cronjob/ai-coaching-cleanup daily-maintenance -n ai-coaching
```

#### Log Rotation

```bash
# Configure log rotation
kubectl apply -f infra/kubernetes/production/logging-config.yaml
```

#### Certificate Renewal

```bash
# Check certificate status
kubectl get certificates -n ai-coaching

# Force certificate renewal
kubectl delete certificate ai-coaching-tls -n ai-coaching
```

### Updates and Upgrades

#### Application Updates

```bash
# Update to new version
kubectl set image deployment/ai-coaching-gateway gateway=ai-coaching/gateway:v1.1.0 -n ai-coaching

# Rollback if needed
kubectl rollout undo deployment/ai-coaching-gateway -n ai-coaching
```

#### Infrastructure Updates

```bash
# Update PostgreSQL
kubectl set image statefulset/ai-coaching-postgres postgres=postgres:17-alpine -n ai-coaching

# Update Redis
kubectl set image statefulset/ai-coaching-redis redis=redis:8-alpine -n ai-coaching
```

## Support and Documentation

### Useful Commands

```bash
# Get cluster information
kubectl cluster-info

# Get node information
kubectl get nodes -o wide

# Get resource usage
kubectl top nodes
kubectl top pods -n ai-coaching

# Get service endpoints
kubectl get endpoints -n ai-coaching

# Port forward for debugging
kubectl port-forward svc/ai-coaching-gateway-service 3001:80 -n ai-coaching
```

### Monitoring URLs

- **Grafana**: https://monitoring.ai-coaching.com/grafana
- **Prometheus**: https://monitoring.ai-coaching.com/prometheus
- **MinIO Console**: http://ai-coaching-minio-service:9001

### Contact Information

- **DevOps Team**: devops@ai-coaching.com
- **Emergency Contact**: +1-555-0123
- **Documentation**: https://docs.ai-coaching.com
- **Status Page**: https://status.ai-coaching.com
