import { Intent } from './enums';
import { ProfileStatus, INTENT_LABELS } from './profiles';

describe('profiles contracts', () => {
  it('ProfileStatus has active/hidden/banned string values', () => {
    expect(ProfileStatus.Active).toBe('active');
    expect(ProfileStatus.Hidden).toBe('hidden');
    expect(ProfileStatus.Banned).toBe('banned');
  });

  it('INTENT_LABELS covers every Intent value with a non-empty label', () => {
    for (const value of Object.values(Intent)) {
      expect(INTENT_LABELS[value]).toBeTruthy();
    }
    expect(Object.keys(INTENT_LABELS).sort()).toEqual([...Object.values(Intent)].sort());
  });
});
