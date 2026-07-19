import { validateEnv } from './env.schema';

const valid = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'x'.repeat(32),
  APP_URL: 'http://localhost:5173',
};

describe('validateEnv', () => {
  it('parses and coerces a valid environment', () => {
    const env = validateEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_URL).toBe('postgresql://u:p@localhost:5432/db');
  });

  it('throws when a required var is missing', () => {
    const rest: Partial<typeof valid> = { ...valid };
    delete rest.DATABASE_URL;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('throws when DATABASE_URL is not a postgres url', () => {
    expect(() => validateEnv({ ...valid, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  it('parses auth/mail/captcha env with defaults', () => {
    const env = validateEnv({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'x'.repeat(32),
      APP_URL: 'http://localhost:5173',
    });
    expect(env.JWT_ACCESS_TTL).toBe(900);
    expect(env.JWT_REFRESH_TTL).toBe(2592000);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.CAPTCHA_ENABLED).toBe(false);
    expect(env.MAIL_FROM).toBe('no-reply@friends.local');
  });

  it('parses boolean env from strings correctly', () => {
    expect(
      validateEnv({ ...valid, COOKIE_SECURE: 'false', CAPTCHA_ENABLED: 'false' }).COOKIE_SECURE,
    ).toBe(false);
    expect(validateEnv({ ...valid, COOKIE_SECURE: 'false' }).CAPTCHA_ENABLED).toBe(false);
    expect(validateEnv({ ...valid, COOKIE_SECURE: 'true' }).COOKIE_SECURE).toBe(true);
  });

  it('throws when JWT_SECRET is too short', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        JWT_SECRET: 'short',
        APP_URL: 'http://localhost:5173',
      }),
    ).toThrow(/JWT_SECRET/);
  });
});
