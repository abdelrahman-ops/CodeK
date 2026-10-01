import { z } from 'zod';
import { Difficulty, RelationshipType, RegistrationStatus, StudentGrade } from '@prisma/client';

export const createPublicRegistrationSchema = z.object({
  firstName: z.string().min(2, 'First name is required').max(50),
  lastName: z.string().min(2, 'Last name is required').max(50),
  phone: z.string().min(8, 'Valid phone number is required').max(20),
  whatsappPhone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),

  dateOfBirth: z.string().optional().nullable(),
  schoolName: z.string().max(100).optional().nullable(),
  grade: z.preprocess((val) => {
    if (typeof val === 'string') {
      const v = val.trim().toUpperCase();
      if (v === 'GRADE 10' || v === 'GRADE_1' || v.includes('1ST') || v.includes('الأول') || v.includes('1')) return StudentGrade.GRADE_1;
      if (v === 'GRADE 11' || v === 'GRADE_2' || v.includes('2ND') || v.includes('الثاني') || v.includes('2')) return StudentGrade.GRADE_2;
      if (v === 'GRADE 12' || v === 'GRADE_3' || v.includes('3RD') || v.includes('الثالث') || v.includes('3')) return StudentGrade.GRADE_3;
      return undefined;
    }
    return val;
  }, z.nativeEnum(StudentGrade).optional().nullable()),
  programmingLevel: z.nativeEnum(Difficulty).default(Difficulty.BEGINNER),
  previousExperience: z.string().max(1000).optional().nullable(),
  motivation: z.string().max(1000).optional().nullable(),

  preferredDays: z.string().max(200).optional().nullable(),
  preferredTimes: z.string().max(200).optional().nullable(),
  preferredGroupId: z.string().optional().nullable(),

  parentName: z.string().max(100).optional().nullable(),
  parentPhone: z.string().max(20).optional().nullable(),
  parentRelationship: z.nativeEnum(RelationshipType).optional().nullable(),

  // Anti-spam fields
  website: z.string().optional().nullable(), // Honeypot field (must be empty)
  formLoadedAt: z.number().optional().nullable() // Submission timing check
});

export type CreatePublicRegistrationInput = z.infer<typeof createPublicRegistrationSchema>;

export const updateRegistrationSettingsSchema = z.object({
  isOpen: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  maxRegistrations: z.number().int().min(1).optional().nullable()
});

export type UpdateRegistrationSettingsInput = z.infer<typeof updateRegistrationSettingsSchema>;

export const updateRegistrationSchema = z.object({
  adminNotes: z.string().max(2000).optional().nullable(),
  rejectionReason: z.string().max(1000).optional().nullable(),
  status: z.nativeEnum(RegistrationStatus).optional()
});

export type UpdateRegistrationInput = z.infer<typeof updateRegistrationSchema>;

export const approveRegistrationSchema = z.object({
  groupId: z.string().uuid().optional().nullable(),
  adminNotes: z.string().max(2000).optional().nullable()
});

export const bulkRegistrationStatusSchema = z.object({
  registrationIds: z.array(z.string().uuid()).min(1, 'At least one registration ID is required'),
  status: z.nativeEnum(RegistrationStatus),
  rejectionReason: z.string().max(1000).optional().nullable()
});

export const bulkApproveRegistrationsSchema = z.object({
  registrationIds: z.array(z.string().uuid()).min(1, 'At least one registration ID is required'),
  groupId: z.string().uuid().optional().nullable()
});

export type ApproveRegistrationInput = z.infer<typeof approveRegistrationSchema>;
export type BulkRegistrationStatusInput = z.infer<typeof bulkRegistrationStatusSchema>;
export type BulkApproveRegistrationsInput = z.infer<typeof bulkApproveRegistrationsSchema>;
