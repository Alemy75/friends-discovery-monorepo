import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { PhotoUploadUrlResponse } from '@friends-ai/contracts';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePhotoUploadUrlDto } from './dto/create-photo-upload-url.dto';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const URL_TTL_SECONDS = 900;

@Injectable()
export class MediaService {
  private readonly s3: S3Client;

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.s3 = new S3Client({
      endpoint: config.s3Endpoint,
      region: config.s3Region,
      credentials: { accessKeyId: config.s3AccessKey, secretAccessKey: config.s3SecretKey },
      forcePathStyle: true,
    });
  }

  async createPhotoUploadUrl(userId: string, dto: CreatePhotoUploadUrlDto): Promise<PhotoUploadUrlResponse> {
    const ext = EXT_BY_MIME[dto.contentType];
    if (!ext) throw new BadRequestException('Unsupported content type');
    if (dto.contentLength > this.config.s3UploadMaxBytes) throw new BadRequestException('File too large');

    const account = await this.prisma.account.findUnique({ where: { ownerUserId: userId } });
    if (!account) throw new NotFoundException('Account not found');

    const objectKey = `accounts/${account.id}/${randomUUID()}.${ext}`;
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.config.s3Bucket, Key: objectKey, ContentType: dto.contentType }),
      { expiresIn: URL_TTL_SECONDS },
    );

    return {
      uploadUrl,
      objectKey,
      publicUrl: `${this.config.s3PublicUrl}/${objectKey}`,
      expiresIn: URL_TTL_SECONDS,
    };
  }
}
