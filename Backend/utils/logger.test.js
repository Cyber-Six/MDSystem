jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('fs', () => ({ existsSync: jest.fn(), mkdirSync: jest.fn() }));
jest.mock('winston', () => ({
  createLogger: jest.fn(),
  format: Object.fromEntries(['combine', 'timestamp', 'errors', 'printf', 'colorize', 'json'].map(name => [name, jest.fn((...args) => ({ name, args }))])),
  transports: { Console: jest.fn(), File: jest.fn() },
}));
const path = require('path');
const { withEnvironment } = require('../test-support/fixtures.cjs');
test.each([false, true])('configures daily file and console logging (directory exists=%s)', exists => {
  jest.resetModules();
  const restore = withEnvironment({ LOGGER_DIR: exists ? 'test-logs' : undefined, LOG_LEVEL: exists ? 'debug' : undefined });
  const winston = require('winston'), fs = require('fs');
  const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
  winston.createLogger.mockReturnValue(logger);
  fs.existsSync.mockReturnValue(exists);
  jest.useFakeTimers().setSystemTime(new Date('2026-04-04T16:00:00Z'));
  try {
    const exported = require('./logger');
    expect(exported).toBe(logger);
    expect(exported.logger).toBe(logger);
    expect(winston.createLogger).toHaveBeenCalledWith(expect.objectContaining({ level: exists ? 'debug' : 'info' }));
    expect(winston.transports.File).toHaveBeenCalledWith(expect.objectContaining({ filename: path.join(exists ? 'test-logs' : 'logs', 'app-2026-04-04.log') }));
    if (!exists) expect(fs.mkdirSync).toHaveBeenCalledWith('logs', { recursive: true });
    else expect(fs.mkdirSync).not.toHaveBeenCalled();
    const [fileFormat, consoleFormat] = winston.format.printf.mock.calls.map(([fn]) => fn);
    expect(fileFormat({ timestamp: 'now', level: 'info', message: 'hello' })).toBe('now INFO: hello');
    expect(fileFormat({ timestamp: 'now', level: 'warn', message: 'hello', id: 1 })).toBe('now WARN: hello {"id":1}');
    expect(consoleFormat({ timestamp: 'now', level: 'info', message: 'hello' })).toBe('now info: hello');
    expect(consoleFormat({ timestamp: 'now', level: 'warn', message: 'hello', id: 1 })).toBe('now warn: hello {"id":1}');
    exported.info('message');
  } finally { jest.useRealTimers(); restore(); }
});
