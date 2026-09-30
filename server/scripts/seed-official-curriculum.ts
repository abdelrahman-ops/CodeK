import { prisma, pool } from '../src/db/prisma.js';
import { parseContentSpec } from '../prisma/seeds/curriculum/content-spec-parser.js';
import { validateCurriculumPackage } from '../prisma/seeds/curriculum/curriculum-validator.js';
import { executeSeed } from '../prisma/seeds/curriculum/curriculum-pipeline.js';

async function seedOfficialCurriculum() {
  console.log('Official curriculum seed started...');

  // 1. Parse official specification
  const pkg = parseContentSpec();

  // 2. Validate structural integrity of curriculum specification
  const validation = validateCurriculumPackage(pkg);
  if (!validation.valid) {
    throw new Error(`Curriculum validation failed: ${validation.errors.join('; ')}`);
  }

  // 3. Execute idempotent transactional seed
  await executeSeed(prisma, pkg);

  // 4. Verify canonical counts from database
  const curriculum = await prisma.curriculum.findUnique({
    where: { code: 'G11-T1-EB-2026' },
    include: {
      sections: true,
      lessons: {
        include: {
          tasks: true,
          exams: {
            include: {
              questions: true
            }
          }
        }
      }
    }
  });

  if (!curriculum) {
    throw new Error('Verification failed: Curriculum G11-T1-EB-2026 was not found after seed.');
  }

  const sectionsCount = curriculum.sections.length;
  const lessonsCount = curriculum.lessons.length;

  const videoCount = await prisma.videoAsset.count({
    where: {
      lessons: {
        some: {
          curriculumId: curriculum.id
        }
      }
    }
  });

  let taskCount = 0;
  let challengeCount = 0;
  let quizCount = 0;
  let questionCount = 0;

  for (const l of curriculum.lessons) {
    for (const t of l.tasks) {
      if (t.taskType === 'CHALLENGE') {
        challengeCount++;
      } else {
        taskCount++;
      }
    }
    for (const e of l.exams) {
      if (e.isQuiz) {
        quizCount++;
      }
      questionCount += e.questions.length;
    }
  }

  // 5. Output exact required summary
  console.log(`Curriculum: ${curriculum.code}`);
  console.log(`Grade: ${curriculum.grade}`);
  console.log(`Sections: ${sectionsCount}`);
  console.log(`Lessons: ${lessonsCount}`);
  console.log(`Videos: ${videoCount}`);
  console.log(`Tasks: ${taskCount}`);
  console.log(`Challenges: ${challengeCount}`);
  console.log(`Quizzes: ${quizCount}`);
  console.log(`Questions: ${questionCount}`);
  console.log('Official curriculum seed completed.');
}

seedOfficialCurriculum()
  .catch((err) => {
    console.error('Official curriculum seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
