import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { Role } from '@friends-ai/contracts';
import { AppConfigService } from '../config/config.service';
import { RedisService } from '../redis/redis.service';

interface SessionData {
  userId: string;
  tokenHash: string;
}

@Injectable()
export class TokenService {
  private readonly jwt: JwtService;

  constructor(
    private readonly config: AppConfigService,
    private readonly redis: RedisService,
  ) {
    this.jwt = new JwtService({ secret: this.config.jwtSecret });
  }

  signAccess(userId: string, role: Role): string {
    return this.jwt.sign({ sub: userId, role }, { expiresIn: this.config.accessTtl });
  }

  verifyAccess(token: string): { sub: string; role: Role } {
    try {
      const p = this.jwt.verify<{ sub: string; role: Role }>(token, { secret: this.config.jwtSecret });
      return { sub: p.sub, role: p.role };
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  async issueSession(userId: string): Promise<{ refreshToken: string; sessionId: string }> {
    const sessionId = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const refreshToken = `${sessionId}.${secret}`;
    await this.persist(sessionId, { userId, tokenHash: this.hash(refreshToken) });
    await this.redis.client.sadd(this.userKey(userId), sessionId);
    // Keep the per-user session-index key from growing unbounded forever —
    // refresh it to the same TTL as the sessions it tracks.
    await this.redis.client.expire(this.userKey(userId), this.config.refreshTtl);
    return { refreshToken, sessionId };
  }

  async rotate(refreshToken: string): Promise<{ userId: string; refreshToken: string; sessionId: string }> {
    const sessionId = refreshToken.split('.')[0] ?? '';
    const raw = await this.redis.client.get(this.key(sessionId));
    if (!raw) throw new UnauthorizedException('Invalid refresh token');
    const data = JSON.parse(raw) as SessionData;
    if (data.tokenHash !== this.hash(refreshToken)) {
      // Reuse of a rotated/old token → kill the session.
      await this.revoke(sessionId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    const secret = randomBytes(32).toString('base64url');
    const next = `${sessionId}.${secret}`;
    await this.persist(sessionId, { userId: data.userId, tokenHash: this.hash(next) });
    return { userId: data.userId, refreshToken: next, sessionId };
  }

  async revoke(sessionId: string): Promise<void> {
    const raw = await this.redis.client.get(this.key(sessionId));
    if (raw) {
      const { userId } = JSON.parse(raw) as SessionData;
      await this.redis.client.srem(this.userKey(userId), sessionId);
    }
    await this.redis.client.del(this.key(sessionId));
  }

  async revokeAll(userId: string): Promise<void> {
    const ids = await this.redis.client.smembers(this.userKey(userId));
    if (ids.length) await this.redis.client.del(...ids.map((id) => this.key(id)));
    await this.redis.client.del(this.userKey(userId));
  }

  private async persist(sessionId: string, data: SessionData): Promise<void> {
    await this.redis.client.set(this.key(sessionId), JSON.stringify(data), 'EX', this.config.refreshTtl);
  }
  private key(sessionId: string): string {
    return `refresh:${sessionId}`;
  }
  private userKey(userId: string): string {
    return `refreshuser:${userId}`;
  }
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
