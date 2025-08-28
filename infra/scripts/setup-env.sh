#!/bin/bash

# Setup environment files and secrets for AI Coaching MVP
# Run this to generate .env files for local development

set -e

echo "Setting up environment files..."

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 16)
REDIS_PASSWORD=$(openssl rand -base64 16)

# Create .env file for local development
cat > .env << EOF
# Database
DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@localhost:5432/speechcoach
POSTGRES_PASSWORD=${DB_PASSWORD}

# Redis
REDIS_URL=redis://:${REDIS_PASSWORD}@localhost:6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# S3/MinIO
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=speechcoach-media
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=us-east-1

# NATS
NATS_URL=nats://localhost:4222
NATS_HTTP_URL=http://localhost:8222

# JWT/Auth
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# App settings
NODE_ENV=development
PORT=4000
FRONTEND_PORT=3000
WORKERS_PORT=8000

# Feature flags
ENABLE_ANALYTICS=false
ENABLE_TELEMETRY=false

# External APIs (stubs for MVP)
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
WHISPER_MODEL=base
EMBEDDING_MODEL=text-embedding-3-small

# Monitoring
SENTRY_DSN=
OTEL_ENDPOINT=
EOF

# Create .env.example (without secrets)
cat > .env.example << EOF
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/speechcoach
POSTGRES_PASSWORD=password

# Redis
REDIS_URL=redis://:password@localhost:6379
REDIS_PASSWORD=password

# S3/MinIO
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=speechcoach-media
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=us-east-1

# NATS
NATS_URL=nats://localhost:4222
NATS_HTTP_URL=http://localhost:8222

# JWT/Auth
JWT_SECRET=CHANGE_ME_IN_PRODUCTION
JWT_EXPIRES_IN=7d

# App settings
NODE_ENV=development
PORT=4000
FRONTEND_PORT=3000
WORKERS_PORT=8000

# Feature flags
ENABLE_ANALYTICS=false
ENABLE_TELEMETRY=false

# External APIs
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
WHISPER_MODEL=base
EMBEDDING_MODEL=text-embedding-3-small

# Monitoring
SENTRY_DSN=
OTEL_ENDPOINT=
EOF

# Create environment-specific files
cat > .env.test << EOF
# Test environment
DATABASE_URL=postgresql://postgres:test@localhost:5433/speechcoach_test
REDIS_URL=redis://localhost:6380
NODE_ENV=test
JWT_SECRET=test_secret
EOF

cat > .env.production << EOF
# Production environment - update with real values
DATABASE_URL=postgresql://user:pass@host:5432/speechcoach
REDIS_URL=redis://:pass@host:6379
NODE_ENV=production
JWT_SECRET=CHANGE_ME_IN_PRODUCTION
S3_ENDPOINT=https://your-s3-endpoint
S3_ACCESS_KEY=YOUR_S3_ACCESS_KEY
S3_SECRET_KEY=YOUR_S3_SECRET_KEY
NATS_URL=nats://your-nats-host:4222
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
SENTRY_DSN=YOUR_SENTRY_DSN
OTEL_ENDPOINT=YOUR_OTEL_ENDPOINT
EOF

# Create secrets directory
mkdir -p secrets

# Generate SSL certificates for local HTTPS (optional)
if command -v openssl &> /dev/null; then
    echo "Generating SSL certificates for local development..."
    openssl req -x509 -newkey rsa:4096 -keyout secrets/localhost-key.pem -out secrets/localhost-cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
fi

# Create a script to start all services
cat > start-dev.sh << 'EOF'
#!/bin/bash

echo "Starting AI Coaching MVP development environment..."

# Start infrastructure services
echo "Starting infrastructure services..."
docker-compose -f infra/docker-compose.dev.yml up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Setup MinIO
echo "Setting up MinIO..."
./infra/scripts/setup-minio.sh

# Setup NATS
echo "Setting up NATS..."
./infra/scripts/setup-nats.sh

# Run database migrations
echo "Running database migrations..."
# TODO: Add migration runner

echo "Development environment ready!"
echo "Frontend: http://localhost:3000"
echo "Gateway: http://localhost:4000"
echo "Workers: http://localhost:8000"
echo "MinIO Console: http://localhost:9001"
echo "NATS Monitor: http://localhost:8222"
EOF

chmod +x start-dev.sh

echo "Environment setup complete!"
echo "Files created:"
echo "  - .env (local development with generated secrets)"
echo "  - .env.example (template without secrets)"
echo "  - .env.test (test environment)"
echo "  - .env.production (production template)"
echo "  - start-dev.sh (development startup script)"
echo ""
echo "Next steps:"
echo "1. Review and update .env with your API keys"
echo "2. Run: ./start-dev.sh"
echo "3. Install dependencies: npm install"
