import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AccountStatus, MeResponse, Role } from '@friends-ai/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { VerificationService } from './verification.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly verification: VerificationService,
    private readonly tokens: TokenService,
  ) {}

  async register(email: string, password: string): Promise<void> {
    const existing = await this.prisma.authIdentity.findUnique({
      where: { provider_identifier: { provider: 'password', identifier: email } },
    });
    if (existing) throw new ConflictException('Email already registered');
    const secretHash = await this.passwords.hash(password);
    await this.prisma.user.create({
      data: { identities: { create: { provider: 'password', identifier: email, secretHash } } },
    });
    await this.verification.issueEmailCode(email);
  }

  async verifyEmail(email: string, code: string): Promise<void> {
    const ok = await this.verification.confirmEmailCode(email, code);
    if (!ok) throw new BadRequestException('Invalid or expired code');
    await this.prisma.authIdentity.update({
      where: { provider_identifier: { provider: 'password', identifier: email } },
      data: { verifiedAt: new Date() },
    });
  }

  async login(email: string, password: string) {
    const identity = await this.prisma.authIdentity.findUnique({
      where: { provider_identifier: { provider: 'password', identifier: email } },
      include: { user: true },
    });
    if (!identity?.secretHash || !(await this.passwords.verify(identity.secretHash, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (identity.user.status !== 'active') throw new UnauthorizedException('Account blocked');
    const { refreshToken } = await this.tokens.issueSession(identity.userId);
    return {
      userId: identity.userId,
      accessToken: this.tokens.signAccess(identity.userId, identity.user.role as Role),
      refreshToken,
    };
  }

  async userRole(userId: string): Promise<Role> {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return u.role as Role;
  }

  /**
   * Re-checks account status for a rotated refresh session. If the account is
   * no longer active, revokes the given session and rejects — a blocked user
   * must not be able to mint a fresh access token via refresh.
   */
  async activeUserRole(userId: string, sessionId: string): Promise<Role> {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (u.status !== 'active') {
      await this.tokens.revoke(sessionId);
      throw new UnauthorizedException('Account blocked');
    }
    return u.role as Role;
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { identities: { where: { provider: 'password' }, take: 1 } },
    });
    const identity = user.identities[0];
    return {
      id: user.id,
      email: identity?.identifier ?? '',
      role: user.role as Role,
      status: user.status as AccountStatus,
      emailVerified: !!identity?.verifiedAt,
    };
  }

  async requestReset(email: string): Promise<void> {
    const identity = await this.prisma.authIdentity.findUnique({
      where: { provider_identifier: { provider: 'password', identifier: email } },
    });
    if (identity) await this.verification.issueResetToken(email);
    // Always resolve — do not reveal whether the email exists.
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const email = await this.verification.consumeResetToken(token);
    if (!email) throw new BadRequestException('Invalid or expired token');
    const secretHash = await this.passwords.hash(newPassword);
    const identity = await this.prisma.authIdentity.update({
      where: { provider_identifier: { provider: 'password', identifier: email } },
      data: { secretHash },
    });
    await this.tokens.revokeAll(identity.userId);
  }
}
