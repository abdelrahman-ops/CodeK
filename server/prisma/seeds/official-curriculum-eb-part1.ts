import { prisma, pool } from '../../src/db/prisma.js';
import { parseContentSpec, PIPELINE_VERSION } from './curriculum/content-spec-parser.js';
import { validateCurriculumPackage } from './curriculum/curriculum-validator.js';
import {
  captureLegacySnapshot,
  calculateDiff,
  executeSeed,
  runAudit,
  verifyLegacySafety
} from './curriculum/curriculum-pipeline.js';

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isAuditOnly = args.includes('--audit');

  console.log('===============================================================');
  console.log('📚 CodeK Official Curriculum Ingestion & Integrity Pipeline');
  console.log(`📌 Pipeline Version : ${PIPELINE_VERSION}`);
  console.log(`⚙️  Execution Mode    : ${isDryRun ? 'DRY RUN (READ-ONLY)' : isAuditOnly ? 'AUDIT ONLY (READ-ONLY)' : 'IDEMPOTENT SEED & AUDIT'}`);
  console.log('===============================================================\n');

  // Step 1: Parse Authoritative Specification
  console.log('🔍 [1/5] Parsing authoritative content specification...');
  const pkg = parseContentSpec();
  console.log(`   - Spec SHA-256 : ${pkg.specHash}`);
  console.log(`   - Course Code  : ${pkg.course.code}`);
  console.log(`   - Course Title : ${pkg.course.title}`);
  console.log(`   - Chapters     : ${pkg.totalChapters}`);
  console.log(`   - Lessons      : ${pkg.totalLessons}`);
  console.log(`   - Videos       : ${pkg.totalVideos}`);
  console.log(`   - Tasks        : ${pkg.totalTasks}`);
  console.log(`   - Challenges   : ${pkg.totalChallenges}`);
  console.log(`   - Exams/Quizzes: ${pkg.totalExams}`);
  console.log(`   - Questions    : ${pkg.totalQuestions}\n`);

  // Step 2: Validate Content Package
  console.log('🛡️  [2/5] Validating curriculum package integrity...');
  const validation = validateCurriculumPackage(pkg);
  if (!validation.valid) {
    console.error('❌ VALIDATION FAILED:');
    validation.errors.forEach(err => console.error(`   - ${err}`));
    process.exit(1);
  }
  console.log('✅ Validation PASSED: All structural, identity, and count rules satisfied.\n');

  // Step 3: Handle --audit only mode
  if (isAuditOnly) {
    console.log('📊 Running post-seed audit verification in read-only mode...');
    const auditReport = await runAudit(prisma, pkg);
    console.log(`\nAudit Result: ${auditReport.status}`);
    auditReport.checks.forEach(c => {
      console.log(`  [${c.status}] ${c.name}: ${c.actual}`);
    });

    if (auditReport.status === 'FAIL') {
      console.error('\n❌ AUDIT FAILED: Discrepancies detected between DB and specification.');
      process.exit(1);
    }
    console.log('\n🎉 AUDIT COMPLETE: Database matches specification perfectly.');
    return;
  }

  // Step 4: Snapshot Legacy Data & Calculate Intended Diff
  console.log('📸 [3/5] Inspecting database state & capturing legacy safety snapshot...');
  const beforeSnapshot = await captureLegacySnapshot(prisma);
  console.log(`   - Existing Legacy Curricula : ${beforeSnapshot.curriculaCount}`);
  console.log(`   - Existing Legacy Lessons   : ${beforeSnapshot.lessonsCount}`);
  console.log(`   - Existing Student Progress : ${beforeSnapshot.lessonProgressCount}`);

  console.log('\n⚖️  Calculating planned mutations against database...');
  const diff = await calculateDiff(prisma, pkg);

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('PLANNED DATABASE MUTATIONS SUMMARY');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`  CREATE    : ${diff.creates}`);
  console.log(`  UPDATE    : ${diff.updates}`);
  console.log(`  UNCHANGED : ${diff.unchanged}`);
  console.log(`  CONFLICT  : ${diff.conflicts}`);
  console.log('───────────────────────────────────────────────────────────────');

  if (diff.conflicts > 0) {
    console.error('\n❌ OWNERSHIP CONFLICT DETECTED:');
    diff.items
      .filter(i => i.action === 'CONFLICT')
      .forEach(i => console.error(`   - [${i.entity}] Code "${i.code}": ${i.details}`));
    console.error('Seed aborted to prevent accidental corruption of foreign records.');
    process.exit(1);
  }

  // Handle --dry-run
  if (isDryRun) {
    console.log('\n🛡️  DRY RUN COMPLETE: No database mutations were applied.');
    console.log('===============================================================');
    return;
  }

  // Step 5: Execute Idempotent Seed
  console.log('\n🚀 [4/5] Executing transactional idempotent seed...');
  const seedResult = await executeSeed(prisma, pkg);
  console.log(`✅ Seed applied successfully: ${seedResult.created} created, ${seedResult.updated} updated, ${seedResult.unchanged} unchanged.`);

  // Step 6: Verify Legacy Data Safety
  console.log('\n🔒 [5/5] Verifying legacy data safety after seed...');
  const afterSnapshot = await captureLegacySnapshot(prisma);
  const safetyCheck = verifyLegacySafety(beforeSnapshot, afterSnapshot);

  if (!safetyCheck.safe) {
    console.error('❌ CRITICAL SAFETY VIOLATION: Legacy data was unexpectedly modified during seed!');
    safetyCheck.details.forEach(d => console.error(`   - ${d}`));
    process.exit(2);
  }
  console.log('✅ Legacy Safety Verified:');
  console.log('   - Legacy Curricula Modified : 0');
  console.log('   - Legacy Curricula Deleted  : 0');
  console.log('   - Student Progress Altered  : 0');

  // Step 7: Run Post-Seed Audit and Generate Markdown Report
  console.log('\n📑 Running post-seed integrity audit & writing report...');
  const auditReport = await runAudit(prisma, pkg);
  console.log(`\nAudit Result: ${auditReport.status}`);
  auditReport.checks.forEach(c => {
    console.log(`  [${c.status}] ${c.name}: ${c.actual}`);
  });

  if (auditReport.status === 'FAIL') {
    console.error('\n❌ POST-SEED AUDIT FAILED!');
    process.exit(1);
  }

  console.log('\n===============================================================');
  console.log('🎉 PHASE 10 CURRICULUM INGESTION COMPLETE');
  console.log('📄 Audit Report saved to docs/curriculum/CODEK_PHASE10_SEED_AUDIT.md');
  console.log('===============================================================');
}

main()
  .catch(err => {
    console.error('Fatal Pipeline Error:', err);
    process.exit(2);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
