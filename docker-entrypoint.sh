#!/bin/sh
set -e

cd /app/apps/api
echo "Applying database migrations..."
npx prisma migrate deploy

echo "Starting API server..."
exec npx tsx src/server.ts
