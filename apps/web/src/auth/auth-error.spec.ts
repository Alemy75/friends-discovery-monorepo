import { HttpError } from '../lib/api/http-client';
import { authErrorMessage } from './auth-error';

it('maps a known status to its message', () => {
  expect(authErrorMessage(new HttpError(409, null), { 409: 'занят' })).toBe('занят');
});
it('falls back for unknown status or non-HttpError', () => {
  expect(authErrorMessage(new HttpError(500, null), { 409: 'занят' }, 'упс')).toBe('упс');
  expect(authErrorMessage(new Error('x'), { 409: 'занят' }, 'упс')).toBe('упс');
});
