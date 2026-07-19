import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@friends-ai/contracts';

export interface AuthUser { id: string; role: Role }

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
