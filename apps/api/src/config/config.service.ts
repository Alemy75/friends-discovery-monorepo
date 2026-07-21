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
  get jwtSecret(): string {
    return this.config.get('JWT_SECRET', { infer: true });
  }
  get accessTtl(): number {
    return this.config.get('JWT_ACCESS_TTL', { infer: true });
  }
  get refreshTtl(): number {
    return this.config.get('JWT_REFRESH_TTL', { infer: true });
  }
  get cookieSecure(): boolean {
    return this.config.get('COOKIE_SECURE', { infer: true });
  }
  get appUrl(): string {
    return this.config.get('APP_URL', { infer: true });
  }
  get mailFrom(): string {
    return this.config.get('MAIL_FROM', { infer: true });
  }
  get captchaEnabled(): boolean {
    return this.config.get('CAPTCHA_ENABLED', { infer: true });
  }
  get captchaSecret(): string | undefined {
    return this.config.get('CAPTCHA_SECRET', { infer: true });
  }
  get s3Endpoint(): string {
    return this.config.get('S3_ENDPOINT', { infer: true });
  }
  get s3Region(): string {
    return this.config.get('S3_REGION', { infer: true });
  }
  get s3Bucket(): string {
    return this.config.get('S3_BUCKET', { infer: true });
  }
  get s3AccessKey(): string {
    return this.config.get('S3_ACCESS_KEY', { infer: true });
  }
  get s3SecretKey(): string {
    return this.config.get('S3_SECRET_KEY', { infer: true });
  }
  get s3PublicUrl(): string {
    return this.config.get('S3_PUBLIC_URL', { infer: true });
  }
  get s3UploadMaxBytes(): number {
    return this.config.get('S3_UPLOAD_MAX_BYTES', { infer: true });
  }
}
