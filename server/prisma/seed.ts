import { Role, Difficulty, TaskType, QuestionType, RelationshipType, AttendanceStatus, SubmissionStatus, PaymentStatus, CurriculumType, SessionStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/db/prisma.js';
import { env } from '../src/config/env.js';

async function main() {
  console.log('[Seed] Seeding CodeK database...');

  // Clean existing tables in reverse dependency order
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.monthlyLeaderboardEntry.deleteMany();
  await prisma.monthlyLeaderboard.deleteMany();
  await prisma.studentAchievement.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.xPTransaction.deleteMany();
  await prisma.examAttempt.deleteMany();
  await prisma.examQuestion.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.sessionLesson.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.curriculum.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.session.deleteMany();
  await prisma.groupEnrollment.deleteMany();
  await prisma.group.deleteMany();
  await prisma.parentStudent.deleteMany();
  await prisma.parent.deleteMany();
  await prisma.student.deleteMany();
  await prisma.authToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const defaultPasswordHash = await bcrypt.hash('Student@123', 10);
  const adminPasswordHash = await bcrypt.hash(env.ADMIN_PASSWORD || 'Admin@123456', 10);
  const parentPasswordHash = await bcrypt.hash('Parent@123', 10);

  // 1. Create Admin
  const adminFullName = env.ADMIN_NAME || 'Abdelrahman Ataa';
  const nameParts = adminFullName.split(' ');
  const adminUser = await prisma.user.create({
    data: {
      loginId: env.ADMIN_LOGIN_ID || 'ADM-001',
      passwordHash: adminPasswordHash,
      mustChangePassword: false,
      role: Role.ADMIN,
      firstName: nameParts[0] || 'Admin',
      lastName: nameParts.slice(1).join(' ') || 'User',
      email: env.ADMIN_EMAIL || 'abdelrahmanataa17@gmail.com',
      phone: '+201000000000'
    }
  });

  // 2. Create Groups
  const groupA = await prisma.group.create({
    data: {
      name: 'Group A',
      description: 'Saturday Group (Egyptian Baccalaureate Grade 10/11)',
      scheduleInfo: 'Saturday 5:00 PM - 7:00 PM',
      whatsappGroupUrl: 'https://chat.whatsapp.com/CodeKGroupAInvite',
      maxCapacity: 20
    }
  });

  const groupB = await prisma.group.create({
    data: {
      name: 'Group B',
      description: 'Sunday Group (Egyptian Baccalaureate Grade 10/11)',
      scheduleInfo: 'Sunday 6:00 PM - 8:00 PM',
      maxCapacity: 20
    }
  });

  const groupC = await prisma.group.create({
    data: {
      name: 'Group C',
      description: 'Monday Group (Advanced Algorithms Track)',
      scheduleInfo: 'Monday 5:00 PM - 7:00 PM',
      maxCapacity: 20
    }
  });

  // 3. Create Students
  const studentsData = [
    { loginId: 'STU-1001', firstName: 'Omar', lastName: 'Hassan', anon: 'CODE-7K4P', group: groupA, xp: 320, streak: 5 },
    { loginId: 'STU-1002', firstName: 'Youssef', lastName: 'Ali', anon: 'CODE-9A2M', group: groupA, xp: 280, streak: 3 },
    { loginId: 'STU-1003', firstName: 'Nour', lastName: 'Ibrahim', anon: 'CODE-3F81', group: groupA, xp: 190, streak: 2 },
    { loginId: 'STU-1004', firstName: 'Mariam', lastName: 'Mostafa', anon: 'CODE-5B9Q', group: groupB, xp: 240, streak: 4 },
    { loginId: 'STU-1005', firstName: 'Ziad', lastName: 'Khaled', anon: 'CODE-2W4L', group: groupB, xp: 150, streak: 1 },
    { loginId: 'STU-1006', firstName: 'Salma', lastName: 'Tarek', anon: 'CODE-8R1X', group: groupC, xp: 110, streak: 1 }
  ];

  const createdStudents = [];
  for (const s of studentsData) {
    const user = await prisma.user.create({
      data: {
        loginId: s.loginId,
        passwordHash: defaultPasswordHash,
        mustChangePassword: false,
        role: Role.STUDENT,
        firstName: s.firstName,
        lastName: s.lastName,
        email: `${s.firstName.toLowerCase()}@example.com`
      }
    });

    const student = await prisma.student.create({
      data: {
        userId: user.id,
        studentCode: s.loginId,
        anonymousLeaderboardCode: s.anon,
        programmingLevel: Difficulty.BEGINNER,
        totalXp: s.xp,
        currentStreak: s.streak,
        lastActiveDate: new Date()
      }
    });

    await prisma.groupEnrollment.create({
      data: {
        studentId: student.id,
        groupId: s.group.id,
        isActive: true
      }
    });

    createdStudents.push(student);
  }

  // 4. Create Parents & Link Children
  const parent1User = await prisma.user.create({
    data: {
      loginId: 'PAR-2001',
      passwordHash: parentPasswordHash,
      mustChangePassword: false,
      role: Role.PARENT,
      firstName: 'Hassan',
      lastName: 'Ali',
      phone: '+201111222333'
    }
  });

  const parent1 = await prisma.parent.create({
    data: {
      userId: parent1User.id,
      parentCode: 'PAR-2001'
    }
  });

  // Link Parent 1 to Omar (STU-1001) and Youssef (STU-1002)
  await prisma.parentStudent.createMany({
    data: [
      { parentId: parent1.id, studentId: createdStudents[0].id, relationship: RelationshipType.FATHER, isPrimary: true },
      { parentId: parent1.id, studentId: createdStudents[1].id, relationship: RelationshipType.FATHER, isPrimary: true }
    ]
  });

  const parent2User = await prisma.user.create({
    data: {
      loginId: 'PAR-2002',
      passwordHash: parentPasswordHash,
      mustChangePassword: false,
      role: Role.PARENT,
      firstName: 'Mona',
      lastName: 'Adel',
      phone: '+201222333444'
    }
  });

  const parent2 = await prisma.parent.create({
    data: {
      userId: parent2User.id,
      parentCode: 'PAR-2002'
    }
  });

  // Link Parent 2 to Mariam (STU-1004)
  await prisma.parentStudent.create({
    data: {
      parentId: parent2.id,
      studentId: createdStudents[3].id,
      relationship: RelationshipType.MOTHER,
      isPrimary: true
    }
  });

  // 5. Create Curriculum & Lessons
  const curriculumEB = await prisma.curriculum.create({
    data: {
      title: 'Egyptian Baccalaureate Programming & AI',
      description: 'Official curriculum for Egyptian Baccalaureate secondary students.',
      type: CurriculumType.OFFICIAL_EB,
      track: 'Fundamentals & AI'
    }
  });

  const lesson1 = await prisma.lesson.create({
    data: {
      curriculumId: curriculumEB.id,
      title: 'Lesson 1: Variables, Data Types, and Expressions',
      description: 'Understanding primitive data types, memory allocation, and expressions in Python and C++.',
      content: `# Lesson 1: Variables and Expressions\n\n## Learning Objectives\n- Understand how variables store data in memory\n- Learn integer, float, string, and boolean data types\n- Practice expressions and arithmetic operators\n\n\`\`\`python\nx = 10\ny = 20\nprint(f"Sum: {x + y}")\n\`\`\``,
      difficulty: Difficulty.BEGINNER,
      estimatedDurationMinutes: 45,
      order: 1
    }
  });

  const lesson2 = await prisma.lesson.create({
    data: {
      curriculumId: curriculumEB.id,
      title: 'Lesson 2: Control Flow & Conditionals',
      description: 'Branching logic using if, else if, and else statements.',
      content: `# Lesson 2: Control Flow & Decision Making\n\n## Conditional Statements\nLearn how programs make decisions based on logical conditions.\n\n\`\`\`python\nage = 16\nif age >= 16:\n    print("Eligible for programming academy!")\n\`\`\``,
      difficulty: Difficulty.BEGINNER,
      estimatedDurationMinutes: 45,
      order: 2
    }
  });

  const lesson3 = await prisma.lesson.create({
    data: {
      curriculumId: curriculumEB.id,
      title: 'Lesson 3: Loops & Iterations (Today\'s Mission)',
      description: 'Mastering while loops, for loops, nested iterations, and break/continue statements.',
      content: `# Lesson 3: Loops & Repetition\n\n**Today's Mission: Master Loops**\n\nLearn how computers automate repetitive tasks.\n\n\`\`\`python\nfor i in range(1, 101):\n    if i % 3 == 0 and i % 5 == 0:\n        print("FizzBuzz")\n\`\`\``,
      difficulty: Difficulty.BEGINNER,
      estimatedDurationMinutes: 60,
      order: 3
    }
  });

  // 6. Create Sessions & Link SessionLesson
  const session1 = await prisma.session.create({
    data: {
      groupId: groupA.id,
      sessionNumber: 1,
      date: new Date('2026-08-23T15:00:00Z'),
      startTime: '17:00',
      endTime: '18:30',
      status: SessionStatus.COMPLETED
    }
  });

  await prisma.sessionLesson.create({
    data: { sessionId: session1.id, lessonId: lesson1.id, order: 1 }
  });

  // Session 2 for Group A (Active today)
  const session2 = await prisma.session.create({
    data: {
      groupId: groupA.id,
      sessionNumber: 2,
      date: new Date(),
      startTime: '17:00',
      endTime: '18:30',
      status: SessionStatus.ACTIVE
    }
  });

  await prisma.sessionLesson.createMany({
    data: [
      { sessionId: session2.id, lessonId: lesson2.id, order: 1 },
      { sessionId: session2.id, lessonId: lesson3.id, order: 2 }
    ]
  });

  // 7. Seed Attendance (Omar is PRESENT, Youssef is PRESENT)
  await prisma.attendance.createMany({
    data: [
      { sessionId: session1.id, studentId: createdStudents[0].id, status: AttendanceStatus.PRESENT, studentConfirmedAt: new Date('2026-08-23T15:05:00Z') },
      { sessionId: session1.id, studentId: createdStudents[1].id, status: AttendanceStatus.PRESENT, studentConfirmedAt: new Date('2026-08-23T15:08:00Z') },
      { sessionId: session1.id, studentId: createdStudents[2].id, status: AttendanceStatus.PRESENT, studentConfirmedAt: new Date('2026-08-23T15:10:00Z') },
      { sessionId: session2.id, studentId: createdStudents[0].id, status: AttendanceStatus.PRESENT, studentConfirmedAt: new Date() },
      { sessionId: session2.id, studentId: createdStudents[1].id, status: AttendanceStatus.PRESENT, studentConfirmedAt: new Date() }
    ]
  });

  // 8. Create Tasks & Assignments
  const task1 = await prisma.task.create({
    data: {
      lessonId: lesson3.id,
      title: 'Task 1: Print Numbers 1 to 100 with Conditions',
      description: 'Write a loop that prints 1 to 100, substituting multiples of 3 with "Fizz" and 5 with "Buzz".',
      instructions: 'Submit either your source code text or a GitHub repository link.',
      taskType: TaskType.DAILY_TASK,
      difficulty: Difficulty.BEGINNER,
      estimatedDurationMinutes: 30,
      xpReward: 30,
      isPublished: true
    }
  });

  const task2 = await prisma.task.create({
    data: {
      lessonId: lesson3.id,
      title: 'Challenge: Number Guessing Game',
      description: 'Build a CLI game where the computer generates a random number between 1 and 50 and gives clues.',
      instructions: 'Submit your solution script and write instructions for playing.',
      taskType: TaskType.CHALLENGE,
      difficulty: Difficulty.INTERMEDIATE,
      estimatedDurationMinutes: 45,
      xpReward: 50,
      isPublished: true
    }
  });

  await prisma.taskAssignment.createMany({
    data: [
      { taskId: task1.id, groupId: groupA.id, availableAt: new Date() },
      { taskId: task1.id, groupId: groupB.id, availableAt: new Date() },
      { taskId: task2.id, groupId: groupA.id, availableAt: new Date() }
    ]
  });

  // 9. Submissions
  await prisma.submission.create({
    data: {
      taskId: task1.id,
      studentId: createdStudents[0].id,
      content: `for i in range(1, 101):\n    if i % 15 == 0: print("FizzBuzz")\n    elif i % 3 == 0: print("Fizz")\n    elif i % 5 == 0: print("Buzz")\n    else: print(i)`,
      status: SubmissionStatus.APPROVED,
      feedback: 'Excellent work! Clean and optimal solution.',
      reviewedAt: new Date()
    }
  });

  // 10. Achievements
  const achievements = await prisma.achievement.createMany({
    data: [
      { code: 'FIRST_CHALLENGE', name: 'First Code Challenge', description: 'Submitted and solved your first challenge task.', icon: 'target', xpReward: 50 },
      { code: 'SEVEN_DAY_STREAK', name: 'Week on Fire', description: 'Maintained a 7-day daily activity streak.', icon: 'flame', xpReward: 75 },
      { code: 'FIRST_PROJECT', name: 'Project Architect', description: 'Completed and submitted your first mini-project.', icon: 'trophy', xpReward: 100 },
      { code: 'EXAM_ACE', name: 'Exam Ace', description: 'Scored 90% or higher on a monthly exam.', icon: 'star', xpReward: 100 }
    ]
  });

  const firstChallengeAch = await prisma.achievement.findUnique({ where: { code: 'FIRST_CHALLENGE' } });
  if (firstChallengeAch) {
    await prisma.studentAchievement.create({
      data: {
        studentId: createdStudents[0].id,
        achievementId: firstChallengeAch.id
      }
    });
  }

  // 11. Monthly Exam
  const exam = await prisma.exam.create({
    data: {
      title: 'August Programming Fundamentals Exam',
      description: 'Covers variables, operators, condition branching, and loop constructs.',
      curriculumId: curriculumEB.id,
      startsAt: new Date(Date.now() - 86400000 * 2),
      endsAt: new Date(Date.now() + 86400000 * 5),
      durationMinutes: 45,
      totalMarks: 100,
      xpReward: 100,
      isPublished: true
    }
  });

  await prisma.examQuestion.createMany({
    data: [
      {
        examId: exam.id,
        questionText: 'What is the output of 7 // 2 in Python?',
        questionType: QuestionType.MULTIPLE_CHOICE,
        options: JSON.stringify(['3.5', '3', '4', '3.0']),
        correctAnswer: '3',
        marks: 25,
        order: 1
      },
      {
        examId: exam.id,
        questionText: 'Which keyword is used to exit a loop immediately?',
        questionType: QuestionType.MULTIPLE_CHOICE,
        options: JSON.stringify(['continue', 'pass', 'break', 'exit']),
        correctAnswer: 'break',
        marks: 25,
        order: 2
      },
      {
        examId: exam.id,
        questionText: 'What data type is the result of (10 > 5)?',
        questionType: QuestionType.MULTIPLE_CHOICE,
        options: JSON.stringify(['int', 'float', 'bool', 'str']),
        correctAnswer: 'bool',
        marks: 25,
        order: 3
      },
      {
        examId: exam.id,
        questionText: 'Which operator is used for exponentiation in Python?',
        questionType: QuestionType.MULTIPLE_CHOICE,
        options: JSON.stringify(['^', '**', 'pow', '^^']),
        correctAnswer: '**',
        marks: 25,
        order: 4
      }
    ]
  });

  // Attempt for Omar
  await prisma.examAttempt.create({
    data: {
      examId: exam.id,
      studentId: createdStudents[0].id,
      answers: JSON.stringify({ q1: '3', q2: 'break', q3: 'bool', q4: '**' }),
      score: 100,
      percentage: 100.0,
      xpEarned: 100
    }
  });

  // 12. XP Transactions
  await prisma.xPTransaction.createMany({
    data: [
      { studentId: createdStudents[0].id, amount: 10, reason: 'Session #1 Attendance', sourceType: 'ATTENDANCE', sourceId: session1.id },
      { studentId: createdStudents[0].id, amount: 10, reason: 'Session #2 Attendance', sourceType: 'ATTENDANCE', sourceId: session2.id },
      { studentId: createdStudents[0].id, amount: 30, reason: `Task: ${task1.title}`, sourceType: 'TASK', sourceId: task1.id },
      { studentId: createdStudents[0].id, amount: 50, reason: 'Achievement: First Code Challenge', sourceType: 'ACHIEVEMENT', sourceId: firstChallengeAch?.id },
      { studentId: createdStudents[0].id, amount: 100, reason: `Exam: ${exam.title} (100%)`, sourceType: 'EXAM', sourceId: exam.id }
    ]
  });

  // 13. Payments
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  await prisma.payment.createMany({
    data: [
      { studentId: createdStudents[0].id, year: currentYear, month: currentMonth, amount: 250, status: PaymentStatus.PAID, paidAt: new Date() },
      { studentId: createdStudents[1].id, year: currentYear, month: currentMonth, amount: 250, status: PaymentStatus.PAID, paidAt: new Date() },
      { studentId: createdStudents[2].id, year: currentYear, month: currentMonth, amount: 250, status: PaymentStatus.UNPAID },
      { studentId: createdStudents[3].id, year: currentYear, month: currentMonth, amount: 250, status: PaymentStatus.PAID, paidAt: new Date() },
      { studentId: createdStudents[4].id, year: currentYear, month: currentMonth, amount: 250, status: PaymentStatus.UNPAID },
      { studentId: createdStudents[5].id, year: currentYear, month: currentMonth, amount: 250, status: PaymentStatus.UNPAID }
    ]
  });

  console.log('[Seed] Seed data successfully inserted.');
  console.log('---------------------------------------------------------');
  console.log('Admin:       Email: admin.demo@codek.local | Login ID: ADM-001 | Password: AdminDemo@123');
  console.log('Student 1:   Login ID: STU-1001  | Password: Student@123 (Omar Hassan - Group A)');
  console.log('Student 2:   Login ID: STU-1002  | Password: Student@123 (Youssef Ali - Group A)');
  console.log('Parent 1:    Login ID: PAR-2001  | Password: Parent@123  (Hassan Ali)');
  console.log('Parent 2:    Login ID: PAR-2002  | Password: Parent@123  (Mona Adel)');
  console.log('---------------------------------------------------------');
}

export async function seedDatabase() {
  await main();
}

if (process.argv[1]?.includes('seed.ts')) {
  main()
    .catch((e) => {
      console.error('Seed error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
