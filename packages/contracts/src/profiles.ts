import { AccountKind, Intent } from './enums';

export enum ProfileStatus {
  Active = 'active',
  Hidden = 'hidden',
  Banned = 'banned',
}

export const INTENT_LABELS: Record<Intent, string> = {
  [Intent.Walks]: 'Прогулки по городу',
  [Intent.DoubleDates]: 'Дабл-дейты',
  [Intent.Hobby]: 'Общее хобби',
  [Intent.Travel]: 'Совместные поездки',
  [Intent.DeepTalks]: 'Глубокие разговоры',
  [Intent.Events]: 'Вечеринки и события',
};

export interface CityDto {
  id: string;
  slug: string;
  name: string;
  timezone: string;
}

export interface InterestDto {
  slug: string;
  label: string;
}

export interface AccountMemberDto {
  id: string;
  position: number;
  name: string;
  age: number;
  photoUrl: string | null;
}

export interface MyAccountResponse {
  id: string;
  kind: AccountKind;
  city: CityDto;
  bio: string | null;
  status: ProfileStatus;
  members: AccountMemberDto[];
  interests: InterestDto[];
  intents: Intent[];
  lastActiveAt: string;
}

export interface PhotoUploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresIn: number;
}
