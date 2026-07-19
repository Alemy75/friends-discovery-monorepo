import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, randomInt } from 'node:crypto';
import { RedisService } from '../redis/redis.service';
import { MAILER, Mailer } from '../mail/mailer';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class VerificationService {
  constructor(
    private readonly redis: RedisService,
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly config: AppConfigService,
  ) {}

  async issueEmailCode(email: string): Promise<void> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.redis.client.set(`verify:${email}`, code, 'EX', 900);
    await this.mailer.send({
      to: email,
      subject: 'Подтверждение email — friends.ai',
      text: `Ваш код подтверждения: ${code}`,
    });
  }

  async confirmEmailCode(email: string, code: string): Promise<boolean> {
    const stored = await this.redis.client.get(`verify:${email}`);
    if (!stored || stored !== code) return false;
    await this.redis.client.del(`verify:${email}`);
    return true;
  }

  async issueResetToken(email: string): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    await this.redis.client.set(`reset:${token}`, email, 'EX', 3600);
    await this.mailer.send({
      to: email,
      subject: 'Сброс пароля — friends.ai',
      text: `Ссылка для сброса пароля: ${this.config.appUrl}/reset?token=${token}`,
    });
  }

  async consumeResetToken(token: string): Promise<string | null> {
    const email = await this.redis.client.get(`reset:${token}`);
    if (!email) return null;
    await this.redis.client.del(`reset:${token}`);
    return email;
  }
}
