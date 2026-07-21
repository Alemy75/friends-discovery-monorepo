import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AccountKind, Intent } from '@friends-ai/contracts';
import { CreateAccountDto } from './create-account.dto';

function errorsFor(payload: unknown) {
  return validateSync(plainToInstance(CreateAccountDto, payload), { whitelist: true, forbidNonWhitelisted: true });
}

describe('CreateAccountDto validation', () => {
  const valid = {
    kind: AccountKind.Single,
    cityId: 'city1',
    members: [{ name: 'A', age: 30 }],
    interestSlugs: ['coffee', 'books'],
    intents: [Intent.Walks],
  };

  it('accepts a valid single payload', () => {
    expect(errorsFor(valid)).toHaveLength(0);
  });

  it('rejects fewer than 2 interest slugs', () => {
    expect(errorsFor({ ...valid, interestSlugs: ['coffee'] }).length).toBeGreaterThan(0);
  });

  it('rejects age outside 18-99', () => {
    expect(errorsFor({ ...valid, members: [{ name: 'A', age: 15 }] }).length).toBeGreaterThan(0);
  });

  it('rejects an empty members array', () => {
    expect(errorsFor({ ...valid, members: [] }).length).toBeGreaterThan(0);
  });

  it('rejects an unknown enum intent', () => {
    expect(errorsFor({ ...valid, intents: ['skydiving'] }).length).toBeGreaterThan(0);
  });
});
