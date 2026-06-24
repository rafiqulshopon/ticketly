/*
  Warnings:

  - Added the required column `senderType` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MessageSenderType" AS ENUM ('agent', 'customer');

-- AlterTable
-- Add the column nullable, backfill from `direction` (outbound → agent,
-- inbound → customer), then tighten to NOT NULL — so existing rows get a value.
ALTER TABLE "messages" ADD COLUMN "senderType" "MessageSenderType";
UPDATE "messages"
  SET "senderType" = CASE
    WHEN "direction" = 'outbound' THEN 'agent'::"MessageSenderType"
    ELSE 'customer'::"MessageSenderType"
  END;
ALTER TABLE "messages" ALTER COLUMN "senderType" SET NOT NULL;
