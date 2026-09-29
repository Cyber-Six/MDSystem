jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
  createHash: jest.fn(),
  randomInt: jest.fn(),
  getRandomValues: jest.fn(),
  randomUUID: jest.fn(),
}));

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const {
  delayRandom,
  generateOTP,
  generateRandomKey,
  generateUUID,
  hashOTP,
  hashPassword,
  verifyPassword,
} = require('../security');

describe('security helpers', () => {
  beforeEach(() => jest.resetAllMocks());

  it('hashes and verifies passwords using the configured bcrypt strength', async () => {
    bcrypt.hash.mockResolvedValue('hashed');
    bcrypt.compare.mockResolvedValue(true);
    await expect(hashPassword('secret')).resolves.toBe('hashed');
    await expect(verifyPassword('secret', 'hashed')).resolves.toBe(true);
    expect(bcrypt.hash).toHaveBeenCalledWith('secret', 10);
    expect(bcrypt.compare).toHaveBeenCalledWith('secret', 'hashed');
  });

  it('generates random key, UUID, OTP, and SHA-256 digest values', () => {
    crypto.randomBytes.mockReturnValue({ toString: jest.fn(() => 'abcd') });
    crypto.randomUUID.mockReturnValue('uuid-1');
    crypto.randomInt.mockReturnValueOnce(1).mockReturnValueOnce(2).mockReturnValueOnce(3);
    const digest = jest.fn(() => 'digest');
    const update = jest.fn(() => ({ digest }));
    crypto.createHash.mockReturnValue({ update });

    expect(generateRandomKey(2)).toBe('abcd');
    expect(generateRandomKey()).toBe('abcd');
    expect(crypto.randomBytes).toHaveBeenLastCalledWith(32);
    expect(generateUUID()).toBe('uuid-1');
    expect(generateOTP(3)).toBe('123');
    crypto.randomInt.mockReset().mockReturnValue(4);
    expect(generateOTP()).toBe('444444');
    expect(hashOTP('123456')).toBe('digest');
    expect(crypto.createHash).toHaveBeenCalledWith('sha256');
    expect(update).toHaveBeenCalledWith('123456');
  });

  it('rejects inverted delay bounds before creating a timer', async () => {
    expect(() => delayRandom(2, 1)).toThrow('minMs must be <= maxMs');
  });

  it('schedules a bounded randomized delay', async () => {
    jest.useFakeTimers();
    crypto.getRandomValues.mockImplementation((values) => { values[0] = 0; return values; });
    const promise = delayRandom(10, 20, 1, 0.5);
    await jest.advanceTimersByTimeAsync(10);
    await expect(promise).resolves.toBeUndefined();
    jest.useRealTimers();
  });

  it('applies default delay bounds and feed settings when omitted', async () => {
    jest.useFakeTimers();
    crypto.getRandomValues.mockImplementation((values) => { values[0] = 0; return values; });
    const promise = delayRandom();
    await jest.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toBeUndefined();
    jest.useRealTimers();
  });
});
