import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveRecaptchaEnabled,
  resolveGoogleOauthEnabled,
  shouldBlockForCaptcha,
} from '../login-feature-flags.js';

// ── resolveRecaptchaEnabled ───────────────────────────────────────────────────

describe('resolveRecaptchaEnabled', () => {
  test('returns false when site key is empty string', () => {
    assert.equal(resolveRecaptchaEnabled(''), false);
  });

  test('returns false when site key is undefined', () => {
    assert.equal(resolveRecaptchaEnabled(undefined), false);
  });

  test('returns false when site key is null', () => {
    assert.equal(resolveRecaptchaEnabled(null), false);
  });

  test('returns true when a non-empty site key is provided', () => {
    assert.equal(resolveRecaptchaEnabled('6Lc_fake_key'), true);
  });
});

// ── resolveGoogleOauthEnabled ─────────────────────────────────────────────────

describe('resolveGoogleOauthEnabled', () => {
  test('returns false when client ID is empty even if flag is true', () => {
    assert.equal(resolveGoogleOauthEnabled(true, ''), false);
    assert.equal(resolveGoogleOauthEnabled('true', ''), false);
  });

  test('returns false when flag is explicitly false', () => {
    assert.equal(resolveGoogleOauthEnabled(false, '123456.apps.googleusercontent.com'), false);
    assert.equal(resolveGoogleOauthEnabled('false', '123456.apps.googleusercontent.com'), false);
  });

  test('returns false when both flag is false and client ID is empty', () => {
    assert.equal(resolveGoogleOauthEnabled(false, ''), false);
    assert.equal(resolveGoogleOauthEnabled('false', ''), false);
  });

  test('returns true when flag is truthy and client ID is present', () => {
    assert.equal(resolveGoogleOauthEnabled(true, '123456.apps.googleusercontent.com'), true);
    assert.equal(resolveGoogleOauthEnabled('true', '123456.apps.googleusercontent.com'), true);
  });

  test('returns true when flag is absent (undefined) and client ID is present', () => {
    // undefined !== 'false' and !== false, so enabled by default if key present
    assert.equal(resolveGoogleOauthEnabled(undefined, '123456.apps.googleusercontent.com'), true);
  });
});

// ── shouldBlockForCaptcha ─────────────────────────────────────────────────────

describe('shouldBlockForCaptcha', () => {
  test('does not block when captcha is not required', () => {
    assert.equal(
      shouldBlockForCaptcha({ captchaRequired: false, recaptchaEnabled: true, recaptchaToken: '' }),
      false,
    );
  });

  test('does not block when recaptcha is disabled even if captcha is required', () => {
    assert.equal(
      shouldBlockForCaptcha({ captchaRequired: true, recaptchaEnabled: false, recaptchaToken: '' }),
      false,
    );
  });

  test('blocks when captcha is required, enabled, and token is missing', () => {
    assert.equal(
      shouldBlockForCaptcha({ captchaRequired: true, recaptchaEnabled: true, recaptchaToken: '' }),
      true,
    );
  });

  test('does not block when captcha is required, enabled, and token is present', () => {
    assert.equal(
      shouldBlockForCaptcha({ captchaRequired: true, recaptchaEnabled: true, recaptchaToken: 'token123' }),
      false,
    );
  });
});
