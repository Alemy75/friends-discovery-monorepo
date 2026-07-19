import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { MeResponse } from '@friends-ai/contracts';
import { AppConfigService } from '../config/config.service';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetDto } from './dto/reset.dto';
import { ResetRequestDto } from './dto/reset-request.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser, AuthUser } from './decorators/current-user.decorator';
import { SmartCaptchaGuard } from './guards/smart-captcha.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @UseGuards(SmartCaptchaGuard)
  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterDto): Promise<void> {
    await this.auth.register(dto.email, dto.password);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(204)
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<void> {
    await this.auth.verifyEmail(dto.email, dto.code);
  }

  private cookieOpts() {
    return {
      httpOnly: true,
      sameSite: 'strict' as const,
      secure: this.config.cookieSecure,
      path: '/api/v1/auth',
      maxAge: this.config.refreshTtl * 1000,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.auth.login(dto.email, dto.password);
    res.cookie('refresh_token', refreshToken, this.cookieOpts());
    return { accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.['refresh_token'];
    if (!token) throw new UnauthorizedException('No refresh token');
    const rotated = await this.tokens.rotate(token);
    const user = await this.auth.userRole(rotated.userId);
    res.cookie('refresh_token', rotated.refreshToken, this.cookieOpts());
    return { accessToken: this.tokens.signAccess(rotated.userId, user) };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.['refresh_token'];
    if (token) await this.tokens.revoke(String(token).split('.')[0]);
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  }

  @Public()
  @UseGuards(SmartCaptchaGuard)
  @Post('password/reset-request')
  @HttpCode(204)
  async resetRequest(@Body() dto: ResetRequestDto): Promise<void> {
    await this.auth.requestReset(dto.email);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(204)
  async reset(@Body() dto: ResetDto): Promise<void> {
    await this.auth.resetPassword(dto.token, dto.password);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.auth.me(user.id);
  }

  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(@CurrentUser() user: AuthUser): Promise<void> {
    await this.tokens.revokeAll(user.id);
  }
}
