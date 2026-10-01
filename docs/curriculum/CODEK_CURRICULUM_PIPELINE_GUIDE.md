# CodeK Curriculum Ingestion & Integrity Pipeline Guide

This operational manual documents the production curriculum ingestion architecture implemented in Phase 10 for the Egyptian Ministry of Education Secondary 2 (Term 1) curriculum.

---

## 1. Overview & Architecture

The ingestion pipeline converts the authoritative Markdown specification (`CODEK_OFFICIAL_CONTENT_SPEC.md`) into database records using an auditable, deterministic, and idempotent architecture.

```text
CODEK_OFFICIAL_CONTENT_SPEC.md (Authoritative Markdown Spec)
                       ↓
     [ content-spec-parser.ts ] (Zero DB dependencies)
                       ↓
    [ curriculum-validator.ts ] (Zero DB dependencies)
                       ↓
     [ curriculum-pipeline.ts ] (Orchestration Engine)
     ┌─────────────────┴─────────────────┐
     ▼                                   ▼
 [ --dry-run ]                      [ Seed Mode ]
 - Inspects DB                      - Captures pre-snapshot
 - Computes planned mutations       - Transactional upsert
 - Detects conflicts                - Legacy safety verification
 - NO WRITES                        - Post-seed audit
                                    - Writes CODEK_PHASE10_SEED_AUDIT.md
```

### Clean Separation of Concerns
1. **Parser (`content-spec-parser.ts`):** Pure function extracting course, chapters, lessons, video blueprints, tasks, challenges, and quizzes without contacting PostgreSQL. Computes the SHA-256 hash of the source spec.
2. **Validator (`curriculum-validator.ts`):** Pure rule engine enforcing ministerial titles, counts, ordering, and code uniqueness.
3. **Pipeline Engine (`curriculum-pipeline.ts`):** Handles targeted legacy snapshots, diff computation, transactional upserts, and audit reporting.
4. **CLI Entrypoint (`official-curriculum-eb-part1.ts`):** Provides executable interface supporting `--dry-run` and `--audit`.

---

## 2. CLI Commands & Usage

From `server/` directory:

### Dry Run (Read-Only)
Inspects the database, compares with the specification, and prints a planned mutation summary without writing to the database:
```bash
npm run seed:curriculum:dry-run
```

### Idempotent Seed & Audit
Validates content, captures a pre-seed snapshot of legacy records, executes transactional upserts, verifies that zero legacy records were modified or deleted, and generates `docs/curriculum/CODEK_PHASE10_SEED_AUDIT.md`:
```bash
npm run seed:curriculum
```

### Audit Only (Production-Safe Read-Only)
Compares database records against the specification and its SHA-256 hash. Safe to run against production environments:
```bash
npm run audit:curriculum
```

### CLI Exit Codes
- `0`: Success / Passed audit / Clean dry-run.
- `1`: Validation failure / Integrity failure / Ownership conflict.
- `2`: Runtime error / Database connection error.

---

## 3. Provenance & Versioning Representation

The database schema explicitly distinguishes ministerial authority from CodeK additions:

```prisma
enum ContentAuthority {
  OFFICIAL   // Ministry of Education authoritative text & curriculum structure
  DERIVED    // CodeK student-friendly descriptions and derived learning outcomes
  PROPOSED   // CodeK pedagogical additions (videos, tasks, flashcards, quizzes)
}
```

### Entity Mapping

| Entity | Authority | Business Identifier Code | Unique Scope |
| :--- | :--- | :--- | :--- |
| **Curriculum** | `OFFICIAL` | `G11-T1-EB-2026` | Global (`@unique`) |
| **Section** | `OFFICIAL` | `G11-T1-CH01` .. `CH04` | Per Curriculum (`@@unique([curriculumId, code])`) |
| **Lesson** | `OFFICIAL` | `G11-T1-CH01-L01` .. `CH04-L04` | Per Curriculum (`@@unique([curriculumId, code])`) |
| **Daily Task** | `PROPOSED` | `G11-T1-CHxx-Lyy-TASK` | Per Lesson (`@@unique([lessonId, code])`) |
| **Challenge** | `PROPOSED` | `G11-T1-CHxx-Lyy-CHALLENGE` | Per Lesson (`@@unique([lessonId, code])`) |
| **Exam (Quiz)** | `PROPOSED` | `G11-T1-CHxx-Lyy-QUIZ` | Per Lesson (`@@unique([lessonId, code])`) |
| **VideoAsset** | `PROPOSED` | `VID-01` .. `VID-14` | Global (`@unique`) |

---

## 4. Idempotency & Database Safety

1. **Upsert Strategy:** All database writes use `upsert` keyed on the composite unique business identifiers.
2. **Zero-Duplicate Guarantee:** Running the seed multiple times yields:
   - Run 1: 75 created, 0 updated.
   - Run 2: 0 created, 75 updated (0 duplicates).
   - Run 3: 0 created, 75 updated (0 duplicates).
3. **Targeted Legacy Snapshot:** Before mutation, the pipeline counts and records legacy curriculum IDs, legacy sections, legacy lessons, and legacy student progress. If any of these metrics deviate after the seed, the pipeline terminates with a safety alert.
4. **Ownership Boundary:** If an entity with the official business code already exists under an unrelated curriculum, the pipeline reports `CONFLICT` and aborts rather than silently overwriting foreign data.

---

## 5. Mock Video Asset Handling

In accordance with curriculum design principles, actual video CDN URLs are not fabricated:
- `provider`: `"MOCK"`
- `providerVideoId`: `"MOCK-VID-xx"`
- `playbackUrl`: `null`
- `status`: `VideoAssetStatus.READY`
- `metadata`: `{ isMock: true, objective: "...", outline: "..." }`

When production videos are produced, administrators can update `playbackUrl` and `provider` without altering lesson relations or curriculum structure.

---

## 6. Adding Future Curriculum Versions

To add subsequent terms or grades (e.g. Term 2, Grade 12):
1. Create the authoritative content specification (e.g., `CODEK_G11_T2_CONTENT_SPEC.md`).
2. Define distinct business codes following the pattern:
   - Course: `G11-T2-EB-2026`
   - Chapters: `G11-T2-CH01` .. `CHxx`
   - Lessons: `G11-T2-CH01-L01` ..
3. Create a dedicated seed runner (e.g. `official-curriculum-eb-part2.ts`) invoking `calculateDiff`, `executeSeed`, and `runAudit`.
4. Because all business codes are scoped to curriculum and lesson codes, multiple terms, tracks, and academic years coexist in the database without collision.
