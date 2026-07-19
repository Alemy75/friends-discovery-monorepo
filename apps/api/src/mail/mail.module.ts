import { Global, Module } from '@nestjs/common';
import { MAILER } from './mailer';
import { DevMailerService } from './dev-mailer.service';

@Global()
@Module({
  providers: [{ provide: MAILER, useClass: DevMailerService }],
  exports: [MAILER],
})
export class MailModule {}
