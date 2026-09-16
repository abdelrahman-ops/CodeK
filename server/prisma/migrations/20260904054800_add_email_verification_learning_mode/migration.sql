-- Phase 7: Add email verification and learning mode onboarding
-- AlterEnum: Add EMAIL_VERIFICATION to AuthTokenType
ALTER TYPE "AuthTokenType" ADD VALUE 'EMAIL_VERIFICATION';

-- AlterTable: Add isEmailVerified to User (default false for new rows)
ALTER TABLE "User" ADD COLUMN "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add learningModeSelected to Student (default false for new rows)
ALTER TABLE "Student" ADD COLUMN "learningModeSelected" BOOLEAN NOT NULL DEFAULT false;

-- Data Migration: Grandfather all existing users as verified
UPDATE "User" SET "isEmailVerified" = true;

-- Data Migration: Grandfather all existing students as already onboarded
UPDATE "Student" SET "learningModeSelected" = true;
