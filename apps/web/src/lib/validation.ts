import { z } from 'zod';

export const logQuerySchema = z.object({
  logGroupName: z.string().min(1),
  queryString: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  limit: z.number().int().positive().max(10_000).optional(),
  pollIntervalMs: z.number().int().positive().max(10_000).optional(),
  maxPollAttempts: z.number().int().positive().max(100).optional(),
});

export type LogQueryPayload = z.infer<typeof logQuerySchema>;

export const savedQuerySchema = z.object({
  name: z.string().min(1),
  logGroup: z.string().min(1),
  queryString: z.string().min(1),
  description: z.string().max(512).optional(),
  tags: z.array(z.string().min(1)).max(10).optional(),
});

export type SavedQueryPayload = z.infer<typeof savedQuerySchema>;
