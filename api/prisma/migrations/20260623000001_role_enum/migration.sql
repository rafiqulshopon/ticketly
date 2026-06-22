-- In-place String -> enum conversion.
-- (Prisma's auto-generator wanted to DROP + recreate this column = data loss;
--  this ALTER TYPE preserves data. Safe because the only existing value is
--  'admin', which is a valid enum member.)

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'agent');

-- AlterTable: change role column type from text to Role, keep default 'agent'
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text)::"Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'agent';
