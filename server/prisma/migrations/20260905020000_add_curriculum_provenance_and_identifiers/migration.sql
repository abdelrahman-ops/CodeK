-- CreateEnum if not exists
DO $$ BEGIN
  CREATE TYPE "ContentAuthority" AS ENUM ('OFFICIAL', 'DERIVED', 'PROPOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable Curriculum
ALTER TABLE "Curriculum" ADD COLUMN IF NOT EXISTS "code" TEXT,
ADD COLUMN IF NOT EXISTS "academicYear" TEXT,
ADD COLUMN IF NOT EXISTS "term" TEXT,
ADD COLUMN IF NOT EXISTS "authority" "ContentAuthority" NOT NULL DEFAULT 'OFFICIAL';

-- AlterTable Section
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "code" TEXT,
ADD COLUMN IF NOT EXISTS "authority" "ContentAuthority" NOT NULL DEFAULT 'OFFICIAL';

-- AlterTable Lesson
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "code" TEXT,
ADD COLUMN IF NOT EXISTS "pageRange" TEXT,
ADD COLUMN IF NOT EXISTS "conceptCards" JSONB,
ADD COLUMN IF NOT EXISTS "authority" "ContentAuthority" NOT NULL DEFAULT 'OFFICIAL';

-- AlterTable Task
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "code" TEXT,
ADD COLUMN IF NOT EXISTS "authority" "ContentAuthority" NOT NULL DEFAULT 'PROPOSED';

-- AlterTable Exam
ALTER TABLE "Exam" ADD COLUMN IF NOT EXISTS "code" TEXT,
ADD COLUMN IF NOT EXISTS "lessonId" TEXT,
ADD COLUMN IF NOT EXISTS "isQuiz" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "authority" "ContentAuthority" NOT NULL DEFAULT 'PROPOSED';

DO $$ BEGIN
  ALTER TABLE "Exam" ADD CONSTRAINT "Exam_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create VideoAsset if not exists
DO $$ BEGIN
  CREATE TYPE "VideoAssetStatus" AS ENUM ('PENDING_UPLOAD', 'PROCESSING', 'READY', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "VideoAsset" (
  "id" TEXT NOT NULL,
  "code" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'MOCK',
  "providerVideoId" TEXT NOT NULL DEFAULT '',
  "title" TEXT,
  "durationSeconds" INTEGER,
  "thumbnailUrl" TEXT,
  "playbackUrl" TEXT,
  "isPrivate" BOOLEAN NOT NULL DEFAULT true,
  "status" "VideoAssetStatus" NOT NULL DEFAULT 'READY',
  "metadata" JSONB,
  "authority" "ContentAuthority" NOT NULL DEFAULT 'PROPOSED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VideoAsset_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "videoId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable VideoAsset
DO $$ BEGIN
  ALTER TABLE "VideoAsset" ADD COLUMN IF NOT EXISTS "code" TEXT;
  ALTER TABLE "VideoAsset" ADD COLUMN IF NOT EXISTS "authority" "ContentAuthority" NOT NULL DEFAULT 'PROPOSED';
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Curriculum_code_key" ON "Curriculum"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Section_curriculumId_code_key" ON "Section"("curriculumId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "Lesson_curriculumId_code_key" ON "Lesson"("curriculumId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "Task_lessonId_code_key" ON "Task"("lessonId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "Exam_lessonId_code_key" ON "Exam"("lessonId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "VideoAsset_code_key" ON "VideoAsset"("code");
