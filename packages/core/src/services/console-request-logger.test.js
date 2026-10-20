import { createRequestLogger } from './console-request-logger';

afterEach(() => jest.restoreAllMocks());

test('enabled HTTP diagnostics omit credentials, patient data, and query strings', () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const logger = createRequestLogger({ forceEnabled: true });
  const config = {
    url: '/records?token=query-secret#fragment-secret', method: 'post',
    data: { password: 'password-secret', refreshToken: 'refresh-secret', symptoms: 'private-medical-data' },
    params: { email: 'private@example.com' },
  };
  logger.logRequest(config);
  logger.logResponse({ status: 200, config, data: config.data });
  logger.logError({ config, response: { status: 400, data: config.data } });
  logger.logError({ config, response: { status: 400, data: { errors: [{ message: 'private-graphql-message' }] } } });
  logger.logError(new Error('private-error-message'));
  const output = JSON.stringify([log.mock.calls, error.mock.calls]);
  for (const secret of ['query-secret', 'fragment-secret', 'password-secret', 'refresh-secret', 'private-medical-data', 'private@example.com', 'private-graphql-message', 'private-error-message']) {
    expect(output).not.toContain(secret);
  }
  expect(output).toContain('/records');
  expect(output).toContain('graphQLErrorCount');
});

test.each([false, undefined])('respects explicit disabling and localhost defaults with forceEnabled=%p', (forceEnabled) => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const logger = createRequestLogger({ forceEnabled });
  logger.logRequest({ url: '/records', method: 'get' });
  logger.logResponse({ status: 200, config: { url: '/records' } });
  logger.logError({ response: { status: 500 } });
  if (forceEnabled === false) {
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  } else {
    // jsdom's localhost origin enables development logging by default.
    expect(log).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
  }
});

test.each([
  'https://url-user:url-secret@api.example/records?query-secret#fragment-secret',
  '/records?query-secret\r\nforged-entry#fragment-secret',
  'http://[invalid?query-secret',
])('logs no header, URL credential, query, or nested response secrets for %p', (url) => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const config = {
    method: 'post', url,
    headers: { Authorization: 'Bearer header-secret', Cookie: 'cookie-secret' },
    data: { nested: { secret: 'body-secret' } },
  };
  const logger = createRequestLogger({ forceEnabled: true });
  logger.logRequest(config);
  logger.logError({ config, request: {}, response: { status: 500, headers: { 'set-cookie': 'server-cookie-secret' }, data: { message: 'response-secret' } } });
  const output = JSON.stringify([log.mock.calls, error.mock.calls]);
  for (const secret of ['url-user', 'url-secret', 'query-secret', 'fragment-secret', 'header-secret', 'cookie-secret', 'body-secret', 'server-cookie-secret', 'response-secret', 'forged-entry']) {
    expect(output).not.toContain(secret);
  }
});
