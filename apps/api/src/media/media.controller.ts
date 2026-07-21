import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PhotoUploadUrlResponse } from '@friends-ai/contracts';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { MediaService } from './media.service';
import { CreatePhotoUploadUrlDto } from './dto/create-photo-upload-url.dto';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('photo-upload-url')
  @HttpCode(200)
  createUploadUrl(@CurrentUser() user: AuthUser, @Body() dto: CreatePhotoUploadUrlDto): Promise<PhotoUploadUrlResponse> {
    return this.media.createPhotoUploadUrl(user.id, dto);
  }
}
