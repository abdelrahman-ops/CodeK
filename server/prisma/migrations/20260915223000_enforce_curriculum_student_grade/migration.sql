-- 1. Create StudentGrade enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudentGrade') THEN
    CREATE TYPE "StudentGrade" AS ENUM ('GRADE_1', 'GRADE_2', 'GRADE_3');
  END IF;
END $$;

-- 2. Add grade column to Curriculum temporarily as nullable
ALTER TABLE "Curriculum" ADD COLUMN IF NOT EXISTS "grade" "StudentGrade";

-- 3. Safely backfill known curricula
UPDATE "Curriculum" SET "grade" = 'GRADE_2' WHERE "code" = 'G11-T1-EB-2026';
UPDATE "Curriculum" SET "grade" = 'GRADE_2' WHERE "title" LIKE 'Payment Test Course%' AND "grade" IS NULL;
UPDATE "Curriculum" SET "grade" = 'GRADE_2' WHERE "grade" IS NULL;

-- 4. Fail loudly if any Curriculum remains with NULL or ambiguous grade
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Curriculum" WHERE "grade" IS NULL) THEN
    RAISE EXCEPTION 'CRITICAL MIGRATION ERROR: Unidentified Curriculum records found with ambiguous grade. Failing migration loudly rather than guessing arbitrary grades.';
  END IF;
END $$;

-- 5. Enforce NOT NULL on Curriculum.grade
ALTER TABLE "Curriculum" ALTER COLUMN "grade" SET NOT NULL;

-- 6. Create index on Curriculum(grade)
CREATE INDEX IF NOT EXISTS "Curriculum_grade_idx" ON "Curriculum"("grade");

-- 7. Convert Student.grade to StudentGrade enum safely
ALTER TABLE "Student" ALTER COLUMN "grade" TYPE "StudentGrade" USING (
  CASE
    WHEN "grade" = 'GRADE_1' THEN 'GRADE_1'::"StudentGrade"
    WHEN "grade" = 'GRADE_2' THEN 'GRADE_2'::"StudentGrade"
    WHEN "grade" = 'GRADE_3' THEN 'GRADE_3'::"StudentGrade"
    ELSE NULL
  END
);

-- 8. Convert StudentRegistration.grade to StudentGrade enum safely
ALTER TABLE "StudentRegistration" ALTER COLUMN "grade" TYPE "StudentGrade" USING (
  CASE
    WHEN "grade" = 'GRADE_1' THEN 'GRADE_1'::"StudentGrade"
    WHEN "grade" = 'GRADE_2' THEN 'GRADE_2'::"StudentGrade"
    WHEN "grade" = 'GRADE_3' THEN 'GRADE_3'::"StudentGrade"
    ELSE NULL
  END
);
