import { Injectable, Logger } from '@nestjs/common';
import { Mailer, MailMessage } from './mailer';

@Injectable()
export class DevMailerService implements Mailer {
  private readonly log = new Logger('DevMailer');

  async send(msg: MailMessage): Promise<void> {
    this.log.log(`EMAIL to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
  }
}
