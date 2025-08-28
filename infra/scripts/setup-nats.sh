#!/bin/bash

# Setup NATS JetStream streams and subjects for AI Coaching MVP
# Run this after NATS is started

set -e

# NATS configuration
NATS_URL="nats://localhost:4222"
NATS_HTTP_URL="http://localhost:8222"

# Install NATS CLI if not present
if ! command -v nats &> /dev/null; then
    echo "Installing NATS CLI..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        wget https://github.com/nats-io/natscli/releases/latest/download/nats-linux-amd64.zip
        unzip nats-linux-amd64.zip
        chmod +x nats
        sudo mv nats /usr/local/bin/
        rm nats-linux-amd64.zip
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install nats-io/nats-tools/nats
    else
        echo "Please install NATS CLI manually: https://github.com/nats-io/natscli"
        exit 1
    fi
fi

echo "Setting up NATS JetStream streams..."

# Create streams for different event types
nats stream add --server $NATS_URL \
  --name media-ingest \
  --subjects "media.ingest" \
  --storage file \
  --retention limits \
  --max-msgs 10000 \
  --max-age 24h \
  --max-bytes 1GB

nats stream add --server $NATS_URL \
  --name asr-events \
  --subjects "asr.*" \
  --storage file \
  --retention limits \
  --max-msgs 50000 \
  --max-age 7d \
  --max-bytes 5GB

nats stream add --server $NATS_URL \
  --name prosody-events \
  --subjects "prosody.*" \
  --storage file \
  --retention limits \
  --max-msgs 50000 \
  --max-age 7d \
  --max-bytes 5GB

nats stream add --server $NATS_URL \
  --name fluency-events \
  --subjects "fluency.*" \
  --storage file \
  --retention limits \
  --max-msgs 50000 \
  --max-age 7d \
  --max-bytes 5GB

nats stream add --server $NATS_URL \
  --name scoring-events \
  --subjects "score.*" \
  --storage file \
  --retention limits \
  --max-msgs 50000 \
  --max-age 7d \
  --max-bytes 5GB

nats stream add --server $NATS_URL \
  --name drill-events \
  --subjects "drill.*" \
  --storage file \
  --retention limits \
  --max-msgs 10000 \
  --max-age 30d \
  --max-bytes 1GB

nats stream add --server $NATS_URL \
  --name clip-events \
  --subjects "clip.*" \
  --storage file \
  --retention limits \
  --max-msgs 10000 \
  --max-age 30d \
  --max-bytes 2GB

nats stream add --server $NATS_URL \
  --name report-events \
  --subjects "report.*" \
  --storage file \
  --retention limits \
  --max-msgs 5000 \
  --max-age 90d \
  --max-bytes 1GB

nats stream add --server $NATS_URL \
  --name search-events \
  --subjects "search.*" \
  --storage file \
  --retention limits \
  --max-msgs 10000 \
  --max-age 7d \
  --max-bytes 1GB

# Create consumers for each stream
echo "Creating consumers..."

# Media ingest consumer
nats consumer add --server $NATS_URL \
  --stream media-ingest \
  --name asr-worker \
  --pull \
  --filter "media.ingest" \
  --ack-policy explicit \
  --max-deliver 3

# ASR events consumer
nats consumer add --server $NATS_URL \
  --stream asr-events \
  --name prosody-worker \
  --pull \
  --filter "asr.done" \
  --ack-policy explicit \
  --max-deliver 3

# Prosody events consumer
nats consumer add --server $NATS_URL \
  --stream prosody-events \
  --name fluency-worker \
  --pull \
  --filter "prosody.done" \
  --ack-policy explicit \
  --max-deliver 3

# Fluency events consumer
nats consumer add --server $NATS_URL \
  --stream fluency-events \
  --name scoring-worker \
  --pull \
  --filter "fluency.done" \
  --ack-policy explicit \
  --max-deliver 3

# Scoring events consumer
nats consumer add --server $NATS_URL \
  --stream scoring-events \
  --name drill-worker \
  --pull \
  --filter "score.done" \
  --ack-policy explicit \
  --max-deliver 3

echo "NATS JetStream setup complete!"
echo "Streams created:"
echo "  - media-ingest (media.ingest)"
echo "  - asr-events (asr.*)"
echo "  - prosody-events (prosody.*)"
echo "  - fluency-events (fluency.*)"
echo "  - scoring-events (score.*)"
echo "  - drill-events (drill.*)"
echo "  - clip-events (clip.*)"
echo "  - report-events (report.*)"
echo "  - search-events (search.*)"
