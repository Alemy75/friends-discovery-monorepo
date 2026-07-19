import { Role, AccountStatus } from './auth';

describe('auth contracts', () => {
  it('Role values', () => {
    expect(Role.User).toBe('user');
    expect(Role.Moderator).toBe('moderator');
    expect(Role.Admin).toBe('admin');
  });
  it('AccountStatus values', () => {
    expect(Object.values(AccountStatus)).toEqual(['active', 'blocked']);
  });
});
