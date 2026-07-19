import { SmartCaptchaGuard } from './smart-captcha.guard';
import { ExecutionContext } from '@nestjs/common';

const ctx = (body: any): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => ({ body }) }) }) as any;

describe('SmartCaptchaGuard', () => {
  it('passes through when captcha is disabled', async () => {
    const guard = new SmartCaptchaGuard({ captchaEnabled: false } as any);
    await expect(guard.canActivate(ctx({}))).resolves.toBe(true);
  });

  it('rejects a missing token when captcha is enabled', async () => {
    const guard = new SmartCaptchaGuard({ captchaEnabled: true, captchaSecret: 's' } as any);
    await expect(guard.canActivate(ctx({}))).rejects.toThrow();
  });
});
