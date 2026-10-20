import { createGoogleOAuthService } from './google-oauth-service';

afterEach(() => { delete window.google; });

test('uses the supported hosted-domain hint and initializes once', () => {
  const initialize = jest.fn();
  window.google = { accounts: { id: { initialize } } };
  const service = createGoogleOAuthService({ clientId: 'client', onSuccess: jest.fn(), onError: jest.fn() });
  service.initialize();
  service.initialize();
  expect(initialize).toHaveBeenCalledTimes(1);
  expect(initialize.mock.calls[0][0]).toMatchObject({ client_id: 'client', hd: 'tip.edu.ph' });
  expect(initialize.mock.calls[0][0]).not.toHaveProperty('hosted_domain');
});

test('reports missing or malformed credentials through onError', () => {
  const initialize = jest.fn();
  const onError = jest.fn();
  const onSuccess = jest.fn();
  window.google = { accounts: { id: { initialize } } };
  createGoogleOAuthService({ clientId: 'client', onSuccess, onError }).initialize();
  const { callback } = initialize.mock.calls[0][0];
  callback(undefined);
  callback({ credential: {} });
  expect(onError).toHaveBeenCalledTimes(2);
  expect(onSuccess).not.toHaveBeenCalled();
  callback({ credential: 'jwt' });
  expect(onSuccess).toHaveBeenCalledWith('jwt');
});

test('can initialize after a late GSI script load and renders into the requested container', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const service = createGoogleOAuthService({ clientId: 'client', onSuccess: jest.fn(), onError: jest.fn() });
  service.initialize();
  const initialize = jest.fn();
  const renderButton = jest.fn();
  window.google = { accounts: { id: { initialize, renderButton } } };
  document.body.innerHTML = '<div id="google-sign-in"></div>';
  service.renderButton('missing');
  expect(renderButton).not.toHaveBeenCalled();
  service.renderButton('google-sign-in', { width: 320, theme: 'filled_blue' });
  expect(initialize).toHaveBeenCalledTimes(1);
  expect(renderButton).toHaveBeenCalledWith(document.getElementById('google-sign-in'), expect.objectContaining({ width: 320, theme: 'filled_blue' }));
  warn.mockRestore();
});
