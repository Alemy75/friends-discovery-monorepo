import { validateEnv } from './env.schema';

const valid = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
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
});
