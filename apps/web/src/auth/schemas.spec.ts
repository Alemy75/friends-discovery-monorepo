import { registerSchema, codeSchema, loginSchema } from './schemas';

it('registerSchema requires a valid email and 8+ char password', () => {
  expect(registerSchema.safeParse({ email: 'a@b.com', password: 'password123', consent: true }).success).toBe(true);
  expect(registerSchema.safeParse({ email: 'x', password: 'password123', consent: true }).success).toBe(false);
  expect(registerSchema.safeParse({ email: 'a@b.com', password: 'short', consent: true }).success).toBe(false);
});

it('registerSchema requires consent to be checked (true)', () => {
  expect(
    registerSchema.safeParse({ email: 'a@b.com', password: 'password123', consent: false }).success,
  ).toBe(false);
  expect(
    registerSchema.safeParse({ email: 'a@b.com', password: 'password123' }).success,
  ).toBe(false);
  expect(
    registerSchema.safeParse({ email: 'a@b.com', password: 'password123', consent: true }).success,
  ).toBe(true);
});

it('codeSchema requires exactly 6 chars', () => {
  expect(codeSchema.safeParse({ code: '123456' }).success).toBe(true);
  expect(codeSchema.safeParse({ code: '123' }).success).toBe(false);
});

it('loginSchema requires a valid email and non-empty password', () => {
  expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
});
