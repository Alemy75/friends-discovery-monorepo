import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/config.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    HealthModule,
    MailModule,
    AuthModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (c: AppConfigService) => ({
        throttlers: [{ ttl: 60000, limit: 20 }],
        storage: new ThrottlerStorageRedisService(c.redisUrl),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
