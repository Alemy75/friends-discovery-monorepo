import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/config.service';

@Injectable()
export class SmartCaptchaGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!this.config.captchaEnabled) return true;
    const token = ctx.switchToHttp().getRequest().body?.captchaToken;
    if (!token) throw new BadRequestException('Captcha token required');
    const params = new URLSearchParams({ secret: this.config.captchaSecret ?? '', token });
    const res = await fetch(`https://smartcaptcha.yandexcloud.net/validate?${params}`);
    const data = (await res.json()) as { status?: string };
    if (data.status !== 'ok') throw new BadRequestException('Captcha validation failed');
    return true;
  }
}
