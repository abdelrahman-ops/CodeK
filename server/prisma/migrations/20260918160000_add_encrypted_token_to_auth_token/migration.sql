-- AlterTable
ALTER TABLE "AuthToken" ADD COLUMN IF NOT EXISTS "encryptedToken" TEXT;
