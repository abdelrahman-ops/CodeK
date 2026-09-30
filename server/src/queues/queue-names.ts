/**
 * Queue names used across CodeK Academy BullMQ workflows.
 * Exactly two queues:
 * 1. EMAIL_QUEUE: Transactional emails (verification, OTP, password reset).
 * 2. VIDEO_QUEUE: Application-side video lifecycle orchestration (Mux post-processing, cleanup).
 */
export const EMAIL_QUEUE = 'email';
export const VIDEO_QUEUE = 'video';

export type QueueName = typeof EMAIL_QUEUE | typeof VIDEO_QUEUE;
