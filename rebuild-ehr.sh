#!/bin/bash

# Script to rebuild EHR service and fix Docker cache issues

echo "🔧 Rebuilding EHR Service..."

# Navigate to project directory
cd /Users/devoop/Dev/personal/medicore

# Stop and remove the container
echo "📦 Stopping and removing old container..."
docker stop medicore-ehr-service 2>/dev/null || true
docker rm medicore-ehr-service 2>/dev/null || true

# Remove the old image
echo "🗑️  Removing old image..."
docker rmi medicore-ehr-service 2>/dev/null || true

# Clean the dist folder in the source
echo "🧹 Cleaning compiled files..."
rm -rf ./services/ehr-service/dist
rm -rf ./services/ehr-service/node_modules/.cache

# Rebuild without cache
echo "🔨 Building new image (no cache)..."
docker compose build --no-cache ehr-service

# Start the service
echo "🚀 Starting EHR service..."
docker compose up -d ehr-service

# Wait a few seconds
echo "⏳ Waiting for service to start..."
sleep 5

# Check the logs
echo "📋 Checking logs..."
docker logs medicore-ehr-service --tail 20

echo ""
echo "✅ Done! Check if you see: '🏥 MediCore EHR Service running on port 3013'"
echo "🌐 API Docs: http://localhost:3013/api/docs"

