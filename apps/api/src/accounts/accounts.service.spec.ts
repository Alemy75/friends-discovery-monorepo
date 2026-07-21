import { BadRequestException, ConflictException } from '@nestjs/common';
import { AccountKind, Intent } from '@friends-ai/contracts';
import { AccountsService } from './accounts.service';

// Единая фабрика сервиса для всех describe-блоков этого файла (Tasks 5–8).
// Task 9 меняет ТОЛЬКО эту строку (добавляет конфиг-стаб вторым аргументом).
const newService = (prisma: any) => new AccountsService(prisma);

function makeDto(overrides: Partial<any> = {}) {
  return {
    kind: AccountKind.Single,
    cityId: 'city1',
    bio: 'hi',
    members: [{ name: 'A', age: 30 }],
    interestSlugs: ['coffee', 'books'],
    intents: [Intent.Walks],
    ...overrides,
  };
}

describe('AccountsService.createAccount', () => {
  it('rejects a second account for the same user', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue({ id: 'existing' }) },
    } as any;
    const svc = newService(prisma);
    await expect(svc.createAccount('u1', makeDto())).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects couple with only one member', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const svc = newService(prisma);
    await expect(
      svc.createAccount('u1', makeDto({ kind: AccountKind.Couple, members: [{ name: 'A', age: 30 }] })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive/unknown city', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue(null) },
      city: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const svc = newService(prisma);
    await expect(svc.createAccount('u1', makeDto())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown interest slugs', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue(null) },
      city: { findFirst: jest.fn().mockResolvedValue({ id: 'city1', isActive: true }) },
      interest: { findMany: jest.fn().mockResolvedValue([{ id: 'i1', slug: 'coffee' }]) }, // only 1 of 2
    } as any;
    const svc = newService(prisma);
    await expect(svc.createAccount('u1', makeDto())).rejects.toBeInstanceOf(BadRequestException);
  });
});
