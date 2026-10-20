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
