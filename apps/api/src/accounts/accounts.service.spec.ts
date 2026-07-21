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

describe('AccountsService.updateProfile', () => {
  it('resets interests inside a transaction and updates bio', async () => {
    const tx = {
      interest: { findMany: jest.fn().mockResolvedValue([{ id: 'i1', slug: 'coffee' }, { id: 'i2', slug: 'wine' }]) },
      accountInterest: { deleteMany: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({}) },
      account: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      account: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'a1' }) // requireOwnAccount (первый вызов)
          .mockResolvedValueOnce({ id: 'a1', city: { id: 'c', slug: 's', name: 'n', timezone: 't' }, members: [], interests: [], intents: [], bio: 'new', status: 'active', kind: 'single', lastActiveAt: new Date() }), // финальный getMyAccount
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    } as any;
    const svc = newService(prisma);

    await svc.updateProfile('u1', { bio: 'new', interestSlugs: ['coffee', 'wine'] });

    expect(tx.accountInterest.deleteMany).toHaveBeenCalledWith({ where: { accountId: 'a1' } });
    expect(tx.accountInterest.createMany).toHaveBeenCalledWith({ data: [{ accountId: 'a1', interestId: 'i1' }, { accountId: 'a1', interestId: 'i2' }] });
    expect(tx.account.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { bio: 'new' } });
  });
});

describe('AccountsService.changeKind', () => {
  it('single -> couple requires secondMember and inserts member at position 1', async () => {
    const tx = {
      accountMember: { create: jest.fn().mockResolvedValue({}), deleteMany: jest.fn() },
      account: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      account: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'a1', kind: 'single', members: [{ id: 'm0', position: 0 }] })
          .mockResolvedValueOnce({ id: 'a1', kind: 'couple', city: { id: 'c', slug: 's', name: 'n', timezone: 't' }, members: [], interests: [], intents: [], bio: null, status: 'active', lastActiveAt: new Date() }),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    } as any;
    const svc = newService(prisma);

    await svc.changeKind('u1', { kind: AccountKind.Couple, secondMember: { name: 'B', age: 29 } });

    expect(tx.accountMember.create).toHaveBeenCalledWith({ data: { accountId: 'a1', position: 1, name: 'B', age: 29 } });
    expect(tx.account.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { kind: AccountKind.Couple } });
  });

  it('single -> couple without secondMember throws BadRequest', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue({ id: 'a1', kind: 'single', members: [{ id: 'm0', position: 0 }] }) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb({})),
    } as any;
    const svc = newService(prisma);
    await expect(svc.changeKind('u1', { kind: AccountKind.Couple })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects no-op change to the same kind', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue({ id: 'a1', kind: 'single', members: [] }) },
    } as any;
    const svc = newService(prisma);
    await expect(svc.changeKind('u1', { kind: AccountKind.Single })).rejects.toBeInstanceOf(BadRequestException);
  });
});
