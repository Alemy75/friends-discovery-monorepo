import { SetMetadata } from '@nestjs/common';
import { Role } from '@friends-ai/contracts';
export const ROLES = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
