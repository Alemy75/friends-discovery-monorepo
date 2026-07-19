import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const svc = new PasswordService();

  it('hashes and verifies', async () => {
    const hash = await svc.hash('correct horse');
    expect(hash).not.toContain('correct horse');
    expect(await svc.verify(hash, 'correct horse')).toBe(true);
    expect(await svc.verify(hash, 'wrong')).toBe(false);
  });
});
