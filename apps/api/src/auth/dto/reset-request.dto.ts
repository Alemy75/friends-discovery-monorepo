import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class ResetRequestDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;
}
