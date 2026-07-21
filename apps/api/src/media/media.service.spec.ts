import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MediaService } from './media.service';

function makeConfig() {
  return {
    s3Endpoint: 'http://localhost:9000',
    s3Region: 'us-east-1',
    s3Bucket: 'friends-media',
    s3AccessKey: 'minio',
    s3SecretKey: 'changeme123',
    s3PublicUrl: 'http://localhost:9000/friends-media',
    s3UploadMaxBytes: 5 * 1024 * 1024,
  } as any;
}

describe('MediaService.createPhotoUploadUrl', () => {
  it('returns a presigned url + object key under the account namespace', async () => {
    const prisma = { account: { findUnique: jest.fn().mockResolvedValue({ id: 'acc1' }) } } as any;
    const svc = new MediaService(makeConfig(), prisma);

    const res = await svc.createPhotoUploadUrl('u1', { contentType: 'image/jpeg', contentLength: 1000 });

    expect(res.objectKey).toMatch(/^accounts\/acc1\/[a-f0-9-]+\.jpg$/);
    expect(res.uploadUrl).toContain('http');
    expect(res.publicUrl).toBe(`http://localhost:9000/friends-media/${res.objectKey}`);
    expect(res.expiresIn).toBeGreaterThan(0);
  });

  it('rejects unsupported content type', async () => {
    const prisma = { account: { findUnique: jest.fn().mockResolvedValue({ id: 'acc1' }) } } as any;
    const svc = new MediaService(makeConfig(), prisma);
    await expect(svc.createPhotoUploadUrl('u1', { contentType: 'application/pdf', contentLength: 10 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects oversize files', async () => {
    const prisma = { account: { findUnique: jest.fn().mockResolvedValue({ id: 'acc1' }) } } as any;
    const svc = new MediaService(makeConfig(), prisma);
    await expect(svc.createPhotoUploadUrl('u1', { contentType: 'image/png', contentLength: 6 * 1024 * 1024 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFound when the user has no account', async () => {
    const prisma = { account: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
    const svc = new MediaService(makeConfig(), prisma);
    await expect(svc.createPhotoUploadUrl('u1', { contentType: 'image/jpeg', contentLength: 10 })).rejects.toBeInstanceOf(NotFoundException);
  });
});
