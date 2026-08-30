import { prisma } from '../../db/prisma.js';
import { CreateCurriculumInput, ListCurriculumQuery, UpdateCurriculumInput } from './curriculum.schema.js';
import { BadRequestError, NotFoundError } from '../../common/errors/app-error.js';
import { createAuditLog } from '../audit/audit.service.js';

export async function createCurriculum(input: CreateCurriculumInput, actorUserId?: string) {
  const curriculum = await prisma.curriculum.create({
    data: {
      title: input.title,
      description: input.description,
      type: input.type,
      track: input.track,
      isPublished: input.isPublished
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'CURRICULUM_CREATED',
    entityType: 'Curriculum',
    entityId: curriculum.id,
    metadata: { title: curriculum.title, type: curriculum.type }
  });

  return curriculum;
}

export async function listCurricula(query: ListCurriculumQuery) {
  const where = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.track ? { track: query.track } : {})
  };

  return prisma.curriculum.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: {
      _count: {
        select: { lessons: true, exams: true }
      }
    }
  });
}

export async function getCurriculumById(id: string) {
  const curriculum = await prisma.curriculum.findUnique({
    where: { id },
    include: {
      lessons: {
        orderBy: { order: 'asc' },
        include: {
          tasks: {
            where: { isPublished: true },
            select: { id: true, title: true, taskType: true, difficulty: true, xpReward: true }
          }
        }
      },
      exams: {
        where: { isPublished: true },
        select: { id: true, title: true, durationMinutes: true, totalMarks: true, xpReward: true }
      }
    }
  });

  if (!curriculum) {
    throw new NotFoundError('Curriculum not found');
  }

  return curriculum;
}

export async function updateCurriculum(
  id: string,
  input: UpdateCurriculumInput,
  actorUserId?: string
) {
  const existing = await prisma.curriculum.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Curriculum not found');

  const updated = await prisma.curriculum.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description !== undefined ? input.description : undefined,
      type: input.type,
      track: input.track !== undefined ? input.track : undefined,
      isPublished: input.isPublished
    }
  });

  await createAuditLog({
    actorUserId,
    action: 'CURRICULUM_UPDATED',
    entityType: 'Curriculum',
    entityId: id,
    metadata: { changed: input }
  });

  return updated;
}

export async function deleteCurriculum(id: string, actorUserId?: string) {
  const existing = await prisma.curriculum.findUnique({
    where: { id },
    include: {
      _count: { select: { lessons: true, exams: true } }
    }
  });
  if (!existing) throw new NotFoundError('Curriculum not found');

  if (existing._count.lessons > 0 || existing._count.exams > 0) {
    throw new BadRequestError('Cannot delete curriculum with associated lessons or exams. Remove lessons/exams first or unpublish the track.');
  }

  await prisma.curriculum.delete({ where: { id } });

  await createAuditLog({
    actorUserId,
    action: 'CURRICULUM_DELETED',
    entityType: 'Curriculum',
    entityId: id,
    metadata: { title: existing.title }
  });

  return { success: true };
}
