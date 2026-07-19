import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import * as path from 'node:path';

export interface StartedPostgres {
  url: string;
  stop: () => Promise<void>;
}

export async function startPostgres(): Promise<StartedPostgres> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16').start();
  // @testcontainers/postgresql builds the URI with the "postgres://" scheme,
  // but the app's env schema (Task 3) requires "postgresql://" — normalize it.
  const url = container.getConnectionUri().replace(/^postgres:\/\//, 'postgresql://');
  // Apply committed migrations to the fresh container.
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
  return {
    url,
    stop: async () => {
      await container.stop();
    },
  };
}
