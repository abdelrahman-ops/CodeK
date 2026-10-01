import { prisma } from '../../db/prisma.js';
import { CreateSectionInput, ReorderSectionsInput, UpdateSectionInput } from './section.schema.js';
import { NotFoundError } from '../../common/errors/app-error.js';
import { createAuditLog } from '../audit/audit.service.js';
import { Role } from '@prisma/client';
import { getStudentGrade, assertGradeAccess } from './curriculum-auth.js';

export async function createSection(
  curriculumId: string,
  input: CreateSectionInput,
  actorUserId?: string
) {
  const curriculum = await prisma.curriculum.findUnique({
    where: { id: curriculumId }
  });

  if (!curriculum) {
    throw new NotFoundError('Curriculum / Course not found');
  }

  // Calculate order if not explicitly specified
  let order = input.order;
  if (!order) {
    const highest = await prisma.section.findFirst({
      where: { curriculumId },
      orderBy: { order: 'desc' }
    });
    order = (highest?.order || 0) + 1;
  }

  const section = await prisma.section.create({
    data: {
      curriculumId,
      title: input.title,
      description: input.description ?? null,
      order,
      isPublished: input.isPublished ?? true
    },
    include: {
      _count: {
        select: { lessons: true }
      }
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'SECTION_CREATED',
    entityType: 'Section',
    entityId: section.id,
    metadata: { curriculumId, title: section.title, order: section.order }
  });

  return section;
}

export async function listSections(
  curriculumId: string,
  requestUser?: { userId: string; role: Role; studentId?: string }
) {
  const curriculum = await prisma.curriculum.findUnique({
    where: { id: curriculumId }
  });

  if (!curriculum) {
    throw new NotFoundError('Curriculum / Course not found');
  }

  if (requestUser?.role === Role.STUDENT && requestUser.studentId) {
    const studentGrade = await getStudentGrade(requestUser.studentId);
    assertGradeAccess(studentGrade, curriculum.grade, 'Curriculum');
  }

  return prisma.section.findMany({
    where: { curriculumId },
    orderBy: { order: 'asc' },
    include: {
      lessons: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          difficulty: true,
          estimatedDurationMinutes: true,
          order: true,
          isPublished: true,
          isFree: true,
          accessType: true,
          videoUrl: true,
          videoDurationSeconds: true
        }
      },
      _count: {
        select: { lessons: true }
      }
    }
  });
}

export async function getSectionById(sectionId: string) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      curriculum: {
        select: { id: true, title: true, type: true, track: true }
      },
      lessons: {
        orderBy: { order: 'asc' }
      }
    }
  });

  if (!section) {
    throw new NotFoundError('Section not found');
  }

  return section;
}

export async function updateSection(
  sectionId: string,
  input: UpdateSectionInput,
  actorUserId?: string
) {
  const existing = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!existing) {
    throw new NotFoundError('Section not found');
  }

  const updated = await prisma.section.update({
    where: { id: sectionId },
    data: {
      title: input.title,
      description: input.description !== undefined ? input.description : undefined,
      order: input.order,
      isPublished: input.isPublished
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'SECTION_UPDATED',
    entityType: 'Section',
    entityId: sectionId,
    metadata: { changed: input }
  });

  return updated;
}

export async function deleteSection(sectionId: string, actorUserId?: string) {
  const existing = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!existing) {
    throw new NotFoundError('Section not found');
  }

  // Deleting a section will set sectionId = null on its child lessons (onDelete: SetNull)
  await prisma.section.delete({
    where: { id: sectionId }
  });

  await createAuditLog({
    actorUserId,
    action: 'SECTION_DELETED',
    entityType: 'Section',
    entityId: sectionId,
    metadata: { title: existing.title, curriculumId: existing.curriculumId }
  });

  return { success: true };
}

export async function reorderSections(
  curriculumId: string,
  input: ReorderSectionsInput,
  actorUserId?: string
) {
  const curriculum = await prisma.curriculum.findUnique({
    where: { id: curriculumId }
  });

  if (!curriculum) {
    throw new NotFoundError('Curriculum / Course not found');
  }

  await prisma.$transaction(
    input.items.map((item) =>
      prisma.section.updateMany({
        where: { id: item.id, curriculumId },
        data: { order: item.order }
      })
    )
  );

  await createAuditLog({
    actorUserId,
    action: 'SECTIONS_REORDERED',
    entityType: 'Section',
    entityId: curriculumId,
    metadata: { itemsCount: input.items.length }
  });

  return listSections(curriculumId);
}

export async function bulkPublishSections(
  ids: string[],
  isPublished: boolean,
  actorUserId?: string
) {
  const result = await prisma.section.updateMany({
    where: { id: { in: ids } },
    data: { isPublished }
  });

  await createAuditLog({
    actorUserId,
    action: isPublished ? 'SECTIONS_BULK_PUBLISHED' : 'SECTIONS_BULK_UNPUBLISHED',
    entityType: 'Section',
    entityId: ids[0] || null,
    metadata: { count: result.count, ids, isPublished }
  });

  return {
    success: true,
    count: result.count,
    ids
  };
}

export async function bulkDeleteSections(
  ids: string[],
  actorUserId?: string
) {
  const successful: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  for (const id of ids) {
    try {
      const section = await prisma.section.findUnique({
        where: { id },
        include: {
          curriculum: true,
          _count: { select: { lessons: true } }
        }
      });

      if (!section) {
        failed.push({ id, reason: 'Section not found' });
        continue;
      }

      if (section.curriculum?.authority === 'OFFICIAL') {
        failed.push({ id, reason: `Cannot delete section "${section.title}" from official curriculum. Official curriculum content is permanently protected.` });
        continue;
      }

      await prisma.section.delete({ where: { id } });
      successful.push(id);
    } catch (err: any) {
      failed.push({ id, reason: err.message || 'Deletion failed' });
    }
  }

  await createAuditLog({
    actorUserId,
    action: 'SECTIONS_BULK_DELETED',
    entityType: 'Section',
    entityId: ids[0] || null,
    metadata: { successfulCount: successful.length, failedCount: failed.length }
  });

  return {
    success: failed.length === 0,
    successful,
    failed
  };
}
