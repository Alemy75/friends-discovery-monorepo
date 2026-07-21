import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountKind, MyAccountResponse } from '@friends-ai/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeKindDto } from './dto/change-kind.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { ACCOUNT_INCLUDE, toMyAccountResponse } from './accounts.mapper';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAccount(userId: string, dto: CreateAccountDto): Promise<MyAccountResponse> {
    const existing = await this.prisma.account.findUnique({ where: { ownerUserId: userId } });
    if (existing) throw new ConflictException('Account already exists');

    this.assertMemberCardinality(dto.kind, dto.members.length);

    const city = await this.prisma.city.findFirst({ where: { id: dto.cityId, isActive: true } });
    if (!city) throw new BadRequestException('Unknown or inactive city');

    const interestIds = await this.resolveInterestIds(dto.interestSlugs);

    const account = await this.prisma.account.create({
      data: {
        ownerUserId: userId,
        kind: dto.kind,
        cityId: dto.cityId,
        bio: dto.bio ?? null,
        intents: dto.intents,
        members: { create: dto.members.map((m, i) => ({ position: i, name: m.name, age: m.age })) },
        interests: { create: interestIds.map((interestId) => ({ interestId })) },
      },
      include: ACCOUNT_INCLUDE,
    });
    return toMyAccountResponse(account);
  }

  async getMyAccount(userId: string): Promise<MyAccountResponse> {
    const account = await this.requireOwnAccount(userId);
    return toMyAccountResponse(account);
  }

  async requireOwnAccount(userId: string) {
    const account = await this.prisma.account.findUnique({
      where: { ownerUserId: userId },
      include: ACCOUNT_INCLUDE,
    });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  assertMemberCardinality(kind: AccountKind, count: number): void {
    const expected = kind === AccountKind.Couple ? 2 : 1;
    if (count !== expected) {
      throw new BadRequestException(`${kind} account must have exactly ${expected} member(s)`);
    }
  }

  async resolveInterestIds(slugs: string[], tx: Prisma.TransactionClient | PrismaService = this.prisma): Promise<string[]> {
    const unique = [...new Set(slugs)];
    const interests = await tx.interest.findMany({ where: { slug: { in: unique }, isActive: true } });
    if (interests.length !== unique.length) throw new BadRequestException('Unknown or inactive interests');
    return interests.map((i) => i.id);
  }

  async updateProfile(userId: string, dto: UpdateAccountDto): Promise<MyAccountResponse> {
    const account = await this.requireOwnAccount(userId);

    await this.prisma.$transaction(async (tx) => {
      if (dto.interestSlugs !== undefined) {
        const ids = await this.resolveInterestIds(dto.interestSlugs, tx);
        await tx.accountInterest.deleteMany({ where: { accountId: account.id } });
        await tx.accountInterest.createMany({ data: ids.map((interestId) => ({ accountId: account.id, interestId })) });
      }
      const data: Prisma.AccountUpdateInput = {};
      if (dto.bio !== undefined) data.bio = dto.bio;
      if (dto.intents !== undefined) data.intents = dto.intents;
      if (Object.keys(data).length > 0) await tx.account.update({ where: { id: account.id }, data });
    });

    return this.getMyAccount(userId);
  }

  async changeKind(userId: string, dto: ChangeKindDto): Promise<MyAccountResponse> {
    const account = await this.requireOwnAccount(userId);
    if (account.kind === dto.kind) throw new BadRequestException(`Account is already ${dto.kind}`);

    await this.prisma.$transaction(async (tx) => {
      if (dto.kind === AccountKind.Couple) {
        if (!dto.secondMember) throw new BadRequestException('secondMember is required to switch to couple');
        await tx.accountMember.create({
          data: { accountId: account.id, position: 1, name: dto.secondMember.name, age: dto.secondMember.age },
        });
      } else {
        await tx.accountMember.deleteMany({ where: { accountId: account.id, position: { gte: 1 } } });
      }
      await tx.account.update({ where: { id: account.id }, data: { kind: dto.kind } });
    });

    return this.getMyAccount(userId);
  }
}
