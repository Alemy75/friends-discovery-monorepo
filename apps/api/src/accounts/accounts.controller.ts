import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { MyAccountResponse } from '@friends-ai/contracts';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { AccountsService } from './accounts.service';
import { ChangeKindDto } from './dto/change-kind.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

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

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateAccountDto): Promise<MyAccountResponse> {
    return this.accounts.updateProfile(user.id, dto);
  }

  @Patch('me/kind')
  changeKind(@CurrentUser() user: AuthUser, @Body() dto: ChangeKindDto): Promise<MyAccountResponse> {
    return this.accounts.changeKind(user.id, dto);
  }
}
