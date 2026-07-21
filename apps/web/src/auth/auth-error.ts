import { HttpError } from '../lib/api/http-client';

export function authErrorMessage(
  err: unknown,
  map: Record<number, string>,
  fallback = 'Что-то пошло не так, попробуйте ещё раз',
): string {
  if (err instanceof HttpError && map[err.status]) return map[err.status];
  return fallback;
}
