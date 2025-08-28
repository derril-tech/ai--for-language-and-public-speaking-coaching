#!/bin/bash

# Setup MinIO buckets and policies for AI Coaching MVP
# Run this after MinIO is started

set -e

# MinIO configuration
MINIO_ENDPOINT="http://localhost:9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MC_BINARY="mc"

# Install MinIO client if not present
if ! command -v $MC_BINARY &> /dev/null; then
    echo "Installing MinIO client..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        wget https://dl.min.io/client/mc/release/linux-amd64/mc
        chmod +x mc
        MC_BINARY="./mc"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install minio/stable/mc
    else
        echo "Please install MinIO client manually: https://min.io/docs/minio/linux/reference/minio-mc.html"
        exit 1
    fi
fi

# Configure MinIO client
$MC_BINARY alias set local $MINIO_ENDPOINT $MINIO_ACCESS_KEY $MINIO_SECRET_KEY

# Create buckets
echo "Creating buckets..."
$MC_BINARY mb local/speechcoach-media --ignore-existing
$MC_BINARY mb local/speechcoach-clips --ignore-existing
$MC_BINARY mb local/speechcoach-reports --ignore-existing
$MC_BINARY mb local/speechcoach-exports --ignore-existing

# Set bucket policies for public read (for clips and reports)
echo "Setting bucket policies..."

# Media bucket - private
$MC_BINARY anonymous set download local/speechcoach-media

# Clips bucket - public read for sharing
$MC_BINARY anonymous set download local/speechcoach-clips

# Reports bucket - public read for sharing
$MC_BINARY anonymous set download local/speechcoach-reports

# Exports bucket - private
$MC_BINARY anonymous set download local/speechcoach-exports

# Create lifecycle policies for cleanup
echo "Setting lifecycle policies..."

# Media files - keep for 90 days
$MC_BINARY ilm add local/speechcoach-media --expiry-days 90

# Clips - keep for 30 days
$MC_BINARY ilm add local/speechcoach-clips --expiry-days 30

# Reports - keep for 1 year
$MC_BINARY ilm add local/speechcoach-reports --expiry-days 365

echo "MinIO setup complete!"
echo "Buckets created:"
echo "  - speechcoach-media (private, 90-day retention)"
echo "  - speechcoach-clips (public read, 30-day retention)"
echo "  - speechcoach-reports (public read, 1-year retention)"
echo "  - speechcoach-exports (private)"
