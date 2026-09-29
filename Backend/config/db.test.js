jest.mock('pg', () => ({ Pool: jest.fn(), types: { setTypeParser: jest.fn() } }));
jest.mock('./config', () => ({ db: { host: 'db.test', user: 'test', password: 'fixture', name: 'fixture', port: 5432, max: 5, idleTimeoutMillis: 20, connectionTimeoutMillis: 30, statement_timeout: 40 } }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
const pg = require('pg');
const logger = require('../utils/logger');

test('configures the pool, preserves SQL dates, and handles connection lifecycle', () => {
  const callbacks = {};
  const pool = { on: jest.fn((event, callback) => { callbacks[event] = callback; }) };
  pg.Pool.mockReturnValue(pool);
  const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
  try {
    expect(require('./db')).toBe(pool);
    expect(pg.Pool).toHaveBeenCalledWith({ host: 'db.test', user: 'test', password: 'fixture', database: 'fixture', port: 5432, max: 5, idleTimeoutMillis: 20, connectionTimeoutMillis: 30, statement_timeout: 40 });
    for (const [oid, parse] of pg.types.setTypeParser.mock.calls) {
      expect([1082, 1114]).toContain(oid);
      expect(parse('2026-04-14 21:00:00')).toBe('2026-04-14 21:00:00');
    }
    expect(pg.types.setTypeParser).toHaveBeenCalledTimes(2);
    callbacks.connect();
    expect(logger.info).toHaveBeenCalled();
    const error = new Error('connection lost');
    callbacks.error(error);
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), error);
    expect(exit).toHaveBeenCalledWith(-1);
  } finally { exit.mockRestore(); }
});
