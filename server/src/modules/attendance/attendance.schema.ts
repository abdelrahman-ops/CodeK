import { z } from 'zod';
import { AttendanceStatus } from '@prisma/client';

export const confirmStudentAttendanceSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  token: z.string().min(1).optional(),
  qrToken: z.string().min(1).optional()
}).refine((d) => Boolean(d.token || d.qrToken), {
  message: 'Attendance token is required',
  path: ['token']
});

export const adminMarkAttendanceSchema = z.object({
  sessionId: z.string().uuid(),
  studentId: z.string().uuid(),
  status: z.nativeEnum(AttendanceStatus),
  notes: z.string().optional()
});

export type ConfirmStudentAttendanceInput = z.infer<typeof confirmStudentAttendanceSchema>;
export type AdminMarkAttendanceInput = z.infer<typeof adminMarkAttendanceSchema>;
