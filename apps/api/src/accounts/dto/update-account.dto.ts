import { ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Intent } from '@friends-ai/contracts';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsString({ each: true })
  interestSlugs?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(Intent, { each: true })
  intents?: Intent[];
}
