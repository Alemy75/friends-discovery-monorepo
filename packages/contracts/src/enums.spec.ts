import { AccountKind, Intent } from './enums';

describe('contracts enums', () => {
  it('AccountKind has single and couple string values', () => {
    expect(AccountKind.Single).toBe('single');
    expect(AccountKind.Couple).toBe('couple');
  });

  it('Intent values match the reference domain', () => {
    expect(Object.values(Intent)).toEqual([
      'walks',
      'double-dates',
      'hobby',
      'travel',
      'deep-talks',
      'events',
    ]);
  });
});
