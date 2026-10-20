/** @jest-environment node */
import { apiEndpoint, normalizeApiBaseUrl } from './api-url';

describe('API URL configuration edge cases', () => {
  test.each([
    ['', ''], [' \t\n ', ''], ['/', ''],
    ['HTTPS://WWW.MDSYSTEMTIP.SPACE:443/api///', 'https://www.mdsystemtip.space/api'],
    ['http://localhost:80/api/', 'http://localhost/api'],
    ['http://[::1]:3000/api/', 'http://[::1]:3000/api'],
    [' /api/v1/// ', '/api/v1'],
    ['https://www.mdsystemtip.space/api/../v2/', 'https://www.mdsystemtip.space/v2'],
    ['https://www.mdsystemtip.space/api%20v1/', 'https://www.mdsystemtip.space/api%20v1'],
  ])('normalizes %p without losing supported host or path information', (input, expected) => {
    expect(normalizeApiBaseUrl(input)).toBe(expected);
    expect(normalizeApiBaseUrl(expected)).toBe(expected);
    expect(apiEndpoint(input, '/auth/refresh')).toBe(`${expected}/auth/refresh`);
  });

  test.each([
    null, undefined, {}, [],
    'https://www.mdsystemtip.space:99999', 'https://[::1',
    'javascript:alert(1)', 'file:///etc/passwd',
    '/api\u0000v1', '/api\tv1', '/api\nv1', '/api\u007fv1',
    'https://www.mdsystemtip.space/has space',
    'https://user@www.mdsystemtip.space', 'https://:secret@www.mdsystemtip.space',
    'https://www.mdsystemtip.space/?', '/api#', '///attacker.example',
  ])('rejects unsafe or invalid configuration %p', (input) => {
    expect(() => normalizeApiBaseUrl(input)).toThrow('API base URL');
  });

  test('validation errors do not echo a configuration secret', () => {
    expect(() => normalizeApiBaseUrl('https://user:private-secret@api.example'))
      .toThrow('API base URL');
    try {
      normalizeApiBaseUrl('https://user:private-secret@api.example');
    } catch (error) {
      expect(error.message).not.toContain('private-secret');
    }
  });
});
