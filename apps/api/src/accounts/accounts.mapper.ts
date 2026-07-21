import { Prisma } from '@prisma/client';
import { AccountKind, Intent, MyAccountResponse, ProfileStatus } from '@friends-ai/contracts';

export const ACCOUNT_INCLUDE = {
  city: true,
  members: { orderBy: { position: 'asc' } },
  interests: { include: { interest: true } },
} satisfies Prisma.AccountInclude;

type AccountWithRelations = Prisma.AccountGetPayload<{ include: typeof ACCOUNT_INCLUDE }>;

export function toMyAccountResponse(account: AccountWithRelations): MyAccountResponse {
  return {
    id: account.id,
    kind: account.kind as AccountKind,
    city: { id: account.city.id, slug: account.city.slug, name: account.city.name, timezone: account.city.timezone },
    bio: account.bio,
    status: account.status as ProfileStatus,
    members: account.members.map((m) => ({ id: m.id, position: m.position, name: m.name, age: m.age, photoUrl: m.photoUrl })),
    interests: account.interests.map((ai) => ({ slug: ai.interest.slug, label: ai.interest.label })),
    intents: account.intents as Intent[],
    lastActiveAt: account.lastActiveAt.toISOString(),
  };
}
