import { Body, Controller, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppConfigService } from '../config/config.service';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly config: AppConfigService,
  ) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterDto): Promise<void> {
    await this.auth.register(dto.email, dto.password);
  }

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

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.auth.login(dto.email, dto.password);
    res.cookie('refresh_token', refreshToken, this.cookieOpts());
    return { accessToken };
  }

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

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.['refresh_token'];
    if (token) await this.tokens.revoke(String(token).split('.')[0]);
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  }
}
