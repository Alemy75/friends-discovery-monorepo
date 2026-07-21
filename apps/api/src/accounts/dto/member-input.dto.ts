import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export class MemberInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @IsInt()
  @Min(18)
  @Max(99)
  age!: number;
}
