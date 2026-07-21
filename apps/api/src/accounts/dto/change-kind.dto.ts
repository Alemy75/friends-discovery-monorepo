import { Type } from 'class-transformer';
import { IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { AccountKind } from '@friends-ai/contracts';
import { MemberInputDto } from './member-input.dto';

export class ChangeKindDto {
  @IsEnum(AccountKind)
  kind!: AccountKind;

  @IsOptional()
  @ValidateNested()
  @Type(() => MemberInputDto)
  secondMember?: MemberInputDto;
}
