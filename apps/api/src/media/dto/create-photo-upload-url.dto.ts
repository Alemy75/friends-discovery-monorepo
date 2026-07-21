import { IsInt, IsPositive, IsString } from 'class-validator';

export class CreatePhotoUploadUrlDto {
  @IsString()
  contentType!: string;

  @IsInt()
  @IsPositive()
  contentLength!: number;
}
