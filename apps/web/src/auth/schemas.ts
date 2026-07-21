import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export const codeSchema = z.object({ code: z.string().length(6) });
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterValues = z.infer<typeof registerSchema>;
export type CodeValues = z.infer<typeof codeSchema>;
export type LoginValues = z.infer<typeof loginSchema>;
