-- Add migration script here
-- Generated offline via `prisma migrate diff` (verified byte-identical to what
-- `prisma migrate dev` produces). Adds a nullable column set when a ticket first
-- reaches RESOLVED/CLOSED; powers the dashboard's average-resolution-time metric.

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "resolvedAt" TIMESTAMP(3);
