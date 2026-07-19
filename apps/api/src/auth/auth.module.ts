import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { VerificationService } from './verification.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, VerificationService],
  exports: [TokenService],
})
export class AuthModule {}
