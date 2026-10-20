import { createRecaptchaService } from './recaptcha-service';

let callbacks;
beforeEach(() => {
  callbacks = [];
  document.body.innerHTML = '<div id="first"></div><div id="second"></div>';
  window.grecaptcha = {
    ready: jest.fn((callback) => callback()),
    render: jest.fn((container, config) => { callbacks.push(config); return callbacks.length + 9; }),
    getResponse: jest.fn(() => ''),
    reset: jest.fn(),
  };
});
afterEach(() => { delete window.grecaptcha; });

test('reuses a rendered widget across concurrent execution and reset', async () => {
  const service = createRecaptchaService({ siteKey: 'key' });
  const first = service.executeRecaptcha('first');
  const second = service.executeRecaptcha('first');
  expect(window.grecaptcha.render).toHaveBeenCalledTimes(1);
  callbacks[0].callback('token');
  await expect(first).resolves.toBe('token');
  await expect(second).resolves.toBe('token');
  service.reset();
  expect(window.grecaptcha.reset).toHaveBeenCalledWith(10);
  const retry = service.executeRecaptcha('first');
  callbacks[0].callback('retry-token');
  await expect(retry).resolves.toBe('retry-token');
  expect(window.grecaptcha.render).toHaveBeenCalledTimes(1);
});

test('resets only widgets belonging to this service and settles pending callers', async () => {
  const first = createRecaptchaService({ siteKey: 'first-key' });
  const second = createRecaptchaService({ siteKey: 'second-key' });
  const firstPending = first.executeRecaptcha('first');
  const secondPending = second.executeRecaptcha('second');
  const assertion = expect(secondPending).rejects.toThrow('reset');
  second.reset();
  await assertion;
  expect(window.grecaptcha.reset.mock.calls).toEqual([[11]]);
  callbacks[0].callback('first-token');
  await expect(firstPending).resolves.toBe('first-token');
});

test('returns an existing unexpired response without rendering again', async () => {
  const service = createRecaptchaService({ siteKey: 'key' });
  const pending = service.executeRecaptcha('first');
  callbacks[0].callback('token');
  await pending;
  window.grecaptcha.getResponse.mockReturnValue('token');
  await expect(service.executeRecaptcha('first')).resolves.toBe('token');
  expect(window.grecaptcha.render).toHaveBeenCalledTimes(1);
});

test('reset before library readiness prevents a late widget render', async () => {
  let ready;
  window.grecaptcha.ready.mockImplementation((callback) => { ready = callback; });
  const service = createRecaptchaService({ siteKey: 'key' });
  const pending = service.executeRecaptcha('first');
  const assertion = expect(pending).rejects.toThrow('reset');
  service.reset();
  ready();
  await assertion;
  expect(window.grecaptcha.render).not.toHaveBeenCalled();
});

test.each(['expired-callback', 'error-callback'])('%s rejects the current challenge', async (event) => {
  const service = createRecaptchaService({ siteKey: 'key' });
  const pending = service.executeRecaptcha('first');
  const assertion = expect(pending).rejects.toThrow('reCAPTCHA');
  callbacks[0][event]();
  await assertion;
});
