jest.mock('dotenv', () => ({ config: jest.fn() }));
const { withEnvironment } = require('../test-support/fixtures.cjs');
let restore;
beforeEach(() => {
  jest.resetModules();
  restore = withEnvironment({
    POSTGRES_HOST: 'db.test', POSTGRES_USER: 'fixture', POSTGRES_PASSWORD: 'fixture', POSTGRES_DB: 'fixture',
    POSTGRES_PORT: undefined, POSTGRES_MAX_CONN: undefined,
    JWT_SECRET: 'fixture', JWT_EXPIRES_IN: undefined, JWT_ISSUER: undefined,
    REDIS_HOST: undefined, REDIS_PORT: undefined, REDIS_USERNAME: undefined, REDIS_PASSWORD: 'fixture', REDIS_DB: undefined,
    SMTP_HOST: undefined, SMTP_PORT: undefined, SMTP_SECURE: undefined, SMTP_USER: 'fixture', SMTP_PASS: 'fixture',
    TOTP_ENCRYPTION_KEY: 'a'.repeat(64),
  });
});
afterEach(() => restore());
test('supplies connection defaults without requiring a developer env file', () => {
  const config = require('./config');
  expect(config.db).toMatchObject({ host: 'db.test', port: 5432, max: 5, statement_timeout: 30000 });
  expect(config.redis).toEqual({ host: '127.0.0.1', port: 6379, username: 'mdsadmin', password: 'fixture', database: 0 });
  expect(config.smtp).toMatchObject({ host: 'smtp.gmail.com', port: 465, secure: false });
  expect(config.jwt).toEqual({ secret: 'fixture', expiresIn: '1h', issuer: 'mdssyme-auth' });
});
test('honors explicit connection and JWT settings', () => {
  Object.assign(process.env, { POSTGRES_PORT: '5433', POSTGRES_MAX_CONN: '10', JWT_EXPIRES_IN: '15m', JWT_ISSUER: 'issuer', REDIS_HOST: 'redis.test', REDIS_PORT: '6380', REDIS_USERNAME: 'test', REDIS_DB: '2', SMTP_HOST: 'smtp.test', SMTP_PORT: '587', SMTP_SECURE: 'true' });
  const config = require('./config');
  expect(config.db).toMatchObject({ port: 5433, max: 10 });
  expect(config.redis).toMatchObject({ host: 'redis.test', port: 6380, username: 'test', database: 2 });
  expect(config.smtp).toMatchObject({ host: 'smtp.test', port: 587, secure: true });
  expect(config.jwt).toMatchObject({ expiresIn: '15m', issuer: 'issuer' });
});
test.each([
  ['POSTGRES_HOST', 'DB config: HOST'], ['POSTGRES_USER', 'DB config: USER'],
  ['POSTGRES_PASSWORD', 'DB config: PASSWORD'], ['POSTGRES_DB', 'DB config: NAME'],
  ['JWT_SECRET', 'JWT config: SECRET'], ['REDIS_PASSWORD', 'Redis config: PASSWORD'],
  ['SMTP_USER', 'SMTP AUTH config'], ['SMTP_PASS', 'SMTP AUTH config'],
  ['TOTP_ENCRYPTION_KEY', 'TOTP_ENCRYPTION_KEY'],
])('fails fast for missing %s', (key, error) => {
  delete process.env[key];
  expect(() => require('./config')).toThrow(error);
});
test('rejects a TOTP encryption key of the wrong length', () => {
  process.env.TOTP_ENCRYPTION_KEY = 'short';
  expect(() => require('./config')).toThrow('64-character hex string');
});
