export enum Role {
  User = 'user',
  Moderator = 'moderator',
  Admin = 'admin',
}

export enum AccountStatus {
  Active = 'active',
  Blocked = 'blocked',
}

export interface MeResponse {
  id: string;
  email: string;
  role: Role;
  status: AccountStatus;
  emailVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
}
