import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { VerificationService } from './verification.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly verification: VerificationService,
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
}
