#!/bin/bash

echo "Starting AMS Agentic Company locally..."
echo "Make sure the Docker databases are running with: docker compose up -d postgres redis elasticsearch kafka zookeeper"
echo ""

# Set environment variables for local development
export NODE_ENV=development
export HOST=localhost
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=ams_agentic_company
export DB_USER=postgres
export DB_PASSWORD=postgres
export REDIS_HOST=localhost
export REDIS_PORT=6379
export ELASTICSEARCH_HOST=localhost
export ELASTICSEARCH_PORT=9200
export KAFKA_BROKERS=localhost:9092

# Build the TypeScript code
echo "Building TypeScript code..."
npm run build

# Start the application
echo "Starting application..."
node dist/index.js

