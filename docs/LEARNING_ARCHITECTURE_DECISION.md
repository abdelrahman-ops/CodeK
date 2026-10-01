# Architectural Decision Record: Learning Platform Foundation (Phase 1)

**Status:** APPROVED  
**Date:** September 2026  
**Context:** CodeK Academy Architecture Evolution  
**Deciders:** Antigravity Senior Architecture Team & CodeK Academy Engineering  

---

## 1. Context & Business Goal

CodeK Academy is transitioning from a physical/blended academy operations system (managing class groups, student registration, physical session scheduling, and in-person QR attendance) into an **integrated learning platform**.

The target learning experience hierarchy is:
```text
Course
  └── Section (Module)
        └── Lesson
              ├── Video
              ├── Rich Content (TipTap HTML / Markdown)
              ├── External Resources (Canva / Presentation decks / Slides)
              ├── Progress (Not Started / In Progress / Completed)
              ├── Practice / Tasks (Daily Task, Challenge, Project)
              ├── Quizzes / Exams (Auto-graded multiple choice & short answer)
              └── Gamification (XP, Badges, Streaks, Leaderboards)
```

This evolution must coexist with all existing production capabilities without breaking changes, data loss, or unnecessary duplication.

---

## 2. Existing Content Model Analysis

The existing database schema in `server/prisma/schema.prisma` implements:
- **`Curriculum`**: Represents the subject track and training curriculum (`title`, `description`, `type: OFFICIAL_EB | ACADEMY`, `track: "Fundamentals" | "Python" | "AI" | "Web"`, `isPublished`).
- **`Lesson`**: Belongs directly to a `Curriculum` (`curriculumId`), with `title`, `description`, `content` (Markdown/HTML), `difficulty`, `estimatedDurationMinutes`, `order`, `isPublished`, `externalResourceUrl`, `externalResourceTitle`.
- **`SessionLesson`**: Junction linking `Session` and `Lesson` with a specific sequence `order`.
- **`Attendance`**: Links `Session` and `Student` (`status: PRESENT | ABSENT`).
- **`Task`**: Optionally linked to `Lesson` (`lessonId`), assigned to class groups (`TaskAssignment`), submitted by students (`Submission`), and awarded XP (`XPTransaction`).
- **`Exam`**: Optionally linked to `Curriculum` (`curriculumId`) and `Group` (`groupId`).

---

## 3. The Core Architectural Decision

### Canonical Question:
*Should we create a second, separate `Course` / `CourseLesson` entity tree, or evolve the existing `Curriculum` / `Lesson` system into the canonical learning content hierarchy?*

### Decision:
**We will evolve the existing `Curriculum` and `Lesson` entities into the canonical learning platform model and add an intermediary `Section` model. We will NOT create a duplicate `Lesson` or `Course` table.**

1. **`Curriculum` is the Course:**  
   In educational academies, a curriculum *is* the formal course/track syllabus. Creating a separate `Course` table alongside `Curriculum` would create split-brain data models, duplicate task/exam relations, and confuse reporting. We support `/courses` route aliases in the API for semantic clarity while preserving `/curriculum` for backward compatibility.

2. **Additive `Section` Model:**  
   We introduce a `Section` model:
   ```prisma
   model Section {
     id           String     @id @default(uuid())
     curriculumId String
     curriculum   Curriculum @relation(fields: [curriculumId], references: [id], onDelete: Cascade)
     title        String
     description  String?
     order        Int        @default(1)
     isPublished  Boolean    @default(true)
     createdAt    DateTime   @default(now())
     updatedAt    DateTime   @updatedAt

     lessons      Lesson[]

     @@index([curriculumId, order])
   }
   ```

3. **Extend Existing `Lesson` Additively:**  
   We add optional and default fields to `Lesson`:
   - `sectionId String?` (FK -> `Section`, `onDelete: SetNull`): allows lessons to be grouped into sections, while remaining directly attached to `Curriculum` via `curriculumId`.
   - `isFree Boolean @default(false)`: flags preview lessons.
   - `accessType LessonAccessType @default(ATTENDANCE_REQUIRED)`: provides explicit access policy control.
   - `videoUrl String?`: supports future video embeds (YouTube, Vimeo, Cloudflare Stream).
   - `videoDurationSeconds Int?`: video runtime length.

4. **Dedicated `StudentLessonProgress` Model:**  
   We track individual student progress through a dedicated relation:
   ```prisma
   model StudentLessonProgress {
     id                  String               @id @default(uuid())
     studentId           String
     student             Student              @relation(fields: [studentId], references: [id], onDelete: Cascade)
     lessonId            String
     lesson              Lesson               @relation(fields: [lessonId], references: [id], onDelete: Cascade)
     status              LessonProgressStatus @default(NOT_STARTED)
     progressPercentage  Int                  @default(0) // 0 - 100
     lastWatchedPosition Int                  @default(0) // in seconds
     startedAt           DateTime?
     completedAt         DateTime?
     createdAt           DateTime             @default(now())
     updatedAt           DateTime             @updatedAt

     @@unique([studentId, lessonId])
     @@index([studentId, status])
     @@index([lessonId])
   }
   ```

---

## 4. Why Duplication is Avoided

1. **Avoids Redundant Entity Trees:** Creating a separate `CourseLesson` table would require duplicating `Task.lessonId`, `SessionLesson.lessonId`, and `Submission` logic.
2. **Zero Breaking Changes:** Every existing API query expecting `prisma.lesson.findMany({ where: { curriculumId } })` continues to work unaltered because `curriculumId` remains present on `Lesson`.
3. **Database Integrity:** Existing foreign keys and cascade deletions remain valid without data migration overhead.
4. **Gradual Section Adoption:** Lessons can exist in a curriculum without a section (`sectionId: null`) during transitional periods, or be grouped under sections as admins organize them.

---

## 5. Compatibility Analysis

### A. Compatibility with Existing Sessions
Class sessions are linked to lessons via `SessionLesson (sessionId, lessonId)`. Because `Lesson.id` remains the primary identifier, class session creation, session lesson planning, and session detail displays continue to function identically.

### B. Compatibility with Attendance Unlocking
Existing attendance-gated lesson unlocking is strictly preserved:
- When a student requests a lesson, the backend inspects `lesson.accessType`:
  - If `lesson.accessType === ATTENDANCE_REQUIRED` (the default): The system checks whether the student has `AttendanceStatus.PRESENT` for any session linked to the lesson via `SessionLesson`. If not, `isLocked: true, lockReason: 'ATTENDANCE_REQUIRED'` and content is shielded.
  - If `lesson.isFree === true` or `lesson.accessType === FREE`: The lesson unlocks immediately without requiring session attendance.
- This allows public or enrolled preview lessons without compromising physical session attendance requirements.

### C. Future Compatibility with Video
- The `videoUrl` and `videoDurationSeconds` fields store video references as strings and integers.
- No binary video storage is stored in PostgreSQL.
- In future phases, when an external video provider (e.g. Mux, Cloudflare Stream, Bunny.net, or Vimeo OTP) is introduced, the backend can issue signed playback tokens or embed URLs using these fields without changing the relational model.

### D. Future Compatibility with Subscriptions & Access Modes
- The `LessonAccessType` enum defines:
  - `ATTENDANCE_REQUIRED` (Current default)
  - `FREE` (Public preview)
  - `ENROLLED` (Enrolled in group/course)
  - `SUBSCRIPTION_REQUIRED` (Reserved for future paid subscription tiers)
  - `ADMIN_GRANTED` (Manually granted access)
- Adding subscriptions in future phases will simply evaluate active student subscription status against `SUBSCRIPTION_REQUIRED` without schema refactoring.

### E. Future Compatibility with Progress Calculation
- **Lesson Level:** Tracked in `StudentLessonProgress` with status (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`), percentage, and last watched video timestamp.
- **Course Level:** Derived dynamically on read:
  $$\text{Course Progress} = \frac{\text{Count of Completed Accessible Lessons}}{\text{Count of Total Accessible Lessons}} \times 100$$
  Deriving this dynamically eliminates cache invalidation bugs and redundant database updates.

### F. Future Compatibility with Tasks, Quizzes, Exams & Gamification
- Tasks remain attached via `Task.lessonId`.
- Submissions and auto-grading continue to reward XP into `XPTransaction`.
- Merely opening or progressing through a lesson does **not** grant XP, preventing XP inflation.
- Course completion achievements can easily inspect whether course progress has reached 100%.

---

## 6. Conclusion
By evolving `Curriculum` into the Course root, introducing an additive `Section` model, extending `Lesson` with optional fields, and introducing `StudentLessonProgress`, we satisfy all requirements for the modern CodeK learning platform while preserving 100% of existing operational features and tests.
