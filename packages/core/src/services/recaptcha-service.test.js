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

test.each(['', null, undefined, {}, 123])('rejects invalid challenge response %p and permits a retry', async (value) => {
  const service = createRecaptchaService({ siteKey: 'key' });
  const pending = service.executeRecaptcha('first');
  const rejected = expect(pending).rejects.toThrow('empty token');
  callbacks[0].callback(value);
  await rejected;
  const retry = service.executeRecaptcha('first');
  callbacks[0].callback('valid-token');
  await expect(retry).resolves.toBe('valid-token');
});

test('a rendering failure does not cache a broken widget', async () => {
  window.grecaptcha.render.mockImplementationOnce(() => { throw new Error('Render failed'); });
  const service = createRecaptchaService({ siteKey: 'key' });
  await expect(service.executeRecaptcha('first')).rejects.toThrow('Render failed');
  const retry = service.executeRecaptcha('first');
  callbacks[0].callback('valid-token');
  await expect(retry).resolves.toBe('valid-token');
  expect(window.grecaptcha.render).toHaveBeenCalledTimes(2);
});

test('replacing a DOM container creates a new widget and isolates its callbacks', async () => {
  const service = createRecaptchaService({ siteKey: 'key' });
  const old = service.executeRecaptcha('first');
  callbacks[0].callback('old-token');
  await old;
  document.getElementById('first').remove();
  const replacement = document.createElement('div');
  replacement.id = 'first';
  document.body.appendChild(replacement);
  const current = service.executeRecaptcha('first');
  callbacks[0]['error-callback']();
  callbacks[1].callback('new-token');
  await expect(current).resolves.toBe('new-token');
  expect(window.grecaptcha.render).toHaveBeenCalledTimes(2);
});

test('a missing container or readiness failure permits a later valid execution', async () => {
  const service = createRecaptchaService({ siteKey: 'key' });
  await expect(service.executeRecaptcha('missing')).rejects.toThrow('not found');
  window.grecaptcha.ready.mockImplementationOnce(() => { throw new Error('Library unavailable'); });
  await expect(service.executeRecaptcha('first')).rejects.toThrow('Library unavailable');
  const pending = service.executeRecaptcha('first');
  callbacks[0].callback('valid-token');
  await expect(pending).resolves.toBe('valid-token');
});

test('reset settles all waiters even if the external widget reset throws', async () => {
  const service = createRecaptchaService({ siteKey: 'key' });
  const pending = Promise.allSettled([service.executeRecaptcha('first'), service.executeRecaptcha('second')]);
  window.grecaptcha.reset.mockImplementation(() => { throw new Error('Removed widget'); });
  expect(() => service.reset()).not.toThrow();
  expect((await pending).every((result) => result.status === 'rejected' && /reset/.test(result.reason.message))).toBe(true);
  expect(window.grecaptcha.reset).toHaveBeenCalledTimes(2);
});

test('rejects native execution explicitly and allows safe reset', async () => {
  const service = createRecaptchaService({ siteKey: 'key', platform: 'mobile' });
  await expect(service.executeRecaptcha()).rejects.toThrow('Inject a custom executor');
  expect(() => service.reset()).not.toThrow();
});
