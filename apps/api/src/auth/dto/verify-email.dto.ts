import { Transform } from 'class-transformer';
import { IsEmail, Length } from 'class-validator';

export class VerifyEmailDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @Length(6, 6)
  code!: string;
}
