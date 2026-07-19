import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }
  get port(): number {
    return this.config.get('PORT', { infer: true });
  }
  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }
  get redisUrl(): string {
    return this.config.get('REDIS_URL', { infer: true });
  }
}
