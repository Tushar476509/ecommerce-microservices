#!/bin/sh
set -e

echo "Running Prisma db push..."
npx prisma db push --accept-data-loss

echo "Seeding product catalog..."
npx prisma db seed

echo "Starting product-service..."
npm start
