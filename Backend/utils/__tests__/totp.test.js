const {
  decryptTotpSecret,
  encryptTotpSecret,
  totpGenerateSecret,
  totpGetToken,
  totpKeyUri,
  totpVerify,
} = require('../totp');
const crypto = require('crypto');

describe('TOTP utilities', () => {
  const originalKey = process.env.TOTP_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.TOTP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-05-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalKey === undefined) delete process.env.TOTP_ENCRYPTION_KEY;
    else process.env.TOTP_ENCRYPTION_KEY = originalKey;
  });

  test('generates base32 secrets and stable six-digit tokens', () => {
    const secret = totpGenerateSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    const token = totpGetToken(secret, Date.now());
    expect(token).toMatch(/^\d{6}$/);
    expect(totpVerify(token, secret)).toBe(true);
    expect(totpVerify('invalid', secret)).toBe(false);
  });

  test('builds an encoded otpauth URI', () => {
    expect(totpKeyUri('patient@example.test', 'ABC123', 'MD System')).toBe(
      'otpauth://totp/MD%20System%3Apatient%40example.test?secret=ABC123&issuer=MD%20System&algorithm=SHA1&digits=6&period=30',
    );
  });

  test('covers optional defaults, ignored Base32 characters, and non-byte-aligned encoding', () => {
    const secret = 'ABC!';
    expect(totpGetToken(secret)).toMatch(/^\d{6}$/);
    const expected = totpGetToken(secret, Date.now());
    const incorrect = expected === '000000' ? '000001' : '000000';
    expect(totpVerify(incorrect, secret, 0)).toBe(false);
    expect(totpKeyUri('account@example.test', 'SECRET')).toContain('issuer=MDSystem');

    jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from([0xff]));
    expect(totpGenerateSecret()).toBe('74');
  });

  test('encrypts and decrypts a TOTP secret and rejects invalid key or payloads', () => {
    const encrypted = encryptTotpSecret('SECRET123');
    expect(encrypted.split(':')).toHaveLength(3);
    expect(decryptTotpSecret(encrypted)).toBe('SECRET123');
    expect(() => decryptTotpSecret('invalid')).toThrow(/Invalid encrypted/);
    process.env.TOTP_ENCRYPTION_KEY = 'short';
    expect(() => encryptTotpSecret('SECRET123')).toThrow(/TOTP_ENCRYPTION_KEY/);
  });
});
