import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { MyAccountResponse } from '@friends-ai/contracts';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAccountDto): Promise<MyAccountResponse> {
    return this.accounts.createAccount(user.id, dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<MyAccountResponse> {
    return this.accounts.getMyAccount(user.id);
  }
}
