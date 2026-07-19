import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: AppConfigService) {
    this.client = new Redis(config.redisUrl, { maxRetriesPerRequest: null, lazyConnect: false });
  }

  ping(): Promise<'PONG'> {
    return this.client.ping() as Promise<'PONG'>;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
