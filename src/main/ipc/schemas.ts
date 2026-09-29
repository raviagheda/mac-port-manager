import { z } from 'zod';

const port = z.number().int().min(1).max(65535);
const pid = z.number().int().positive();

export const killRequestSchema = z.object({
  pid,
  port: port.optional()
});

export const killConfirmForceSchema = z.object({
  pid
});

export const openLocalhostSchema = z.object({
  port
});

export const clipboardWriteTextSchema = z.object({
  text: z.string().max(2048)
});
