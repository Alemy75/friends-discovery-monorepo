import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested,
} from 'class-validator';
import { AccountKind, Intent } from '@friends-ai/contracts';
import { MemberInputDto } from './member-input.dto';

export class CreateAccountDto {
  @IsEnum(AccountKind)
  kind!: AccountKind;

  @IsString()
  @IsNotEmpty()
  cityId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => MemberInputDto)
  members!: MemberInputDto[];

  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsString({ each: true })
  interestSlugs!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(Intent, { each: true })
  intents!: Intent[];
}
