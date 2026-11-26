const { expect } = require('@playwright/test');

async function openLogin(page, baseUrl) {
  await page.goto(`${baseUrl}/auth/login`);
  const openLoginButton = page.getByRole('button', { name: 'Open login panel' });
  // Both portals start with a closed sliding panel. isVisible() is an immediate
  // snapshot and can skip opening it when the React UI has not rendered yet.
  await expect(openLoginButton).toBeVisible({ timeout: 15_000 });
  await openLoginButton.click();
  await expect(page.getByLabel('Email address')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
}

async function latestMessageId(email) {
  const url = `${process.env.MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`SMTP capture search failed (${response.status}).`);
  const result = await response.json();
  return result.messages?.[0]?.ID || null;
}

async function readLatestMailValue(email, previousMessageId, pattern) {
  let value;
  await expect.poll(async () => {
    const messageId = await latestMessageId(email);
    if (!messageId || messageId === previousMessageId) return false;
    // Read this specific message so polling and retrieval cannot select
    // different emails, or reuse an OTP from an earlier login.
    const response = await fetch(`${process.env.MAILPIT_URL}/view/${encodeURIComponent(messageId)}.txt`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return false;
    const body = await response.text();
    value = body.match(pattern)?.[0];
    return Boolean(value);
  }, {
    message: 'Wait for the expected value in a new Mailpit message',
    timeout: 20_000,
    intervals: [200, 400, 800, 1200],
  }).toBe(true);
  return value;
}

function readLatestOtp(email, previousMessageId) {
  return readLatestMailValue(email, previousMessageId, /\b\d{6}\b/);
}

async function prepareOtp(email, configuredOtp) {
  if (!process.env.MAILPIT_URL) return () => configuredOtp;
  const previousMessageId = await latestMessageId(email);
  return () => readLatestOtp(email, previousMessageId);
}

async function enterOtp(page, code) {
  const inputs = page.locator('input[inputmode="numeric"]');
  await expect(inputs).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) await inputs.nth(index).fill(code[index]);
}

async function signIn(page, baseUrl, email, {
  rejectOtpOnce = false, password = process.env.E2E_ACCOUNT_PASSWORD,
} = {}) {
  await openLogin(page, baseUrl);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const previousMessageId = await latestMessageId(email);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();

  const otp = await readLatestOtp(email, previousMessageId);
  if (rejectOtpOnce) {
    const invalidOtp = otp === '123456' ? '654321' : '123456';
    await enterOtp(page, invalidOtp);
    await page.getByRole('button', { name: 'Verify code' }).click();
    await expect(page.getByText(/Invalid OTP code/)).toBeVisible();
  }

  await enterOtp(page, otp);
  const completion = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/auth/login/complete' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Verify code' }).click();
  const response = await completion;
  expect(response.ok(), 'Login completion should succeed').toBe(true);
  const { accessToken } = await response.json();
  expect(typeof accessToken).toBe('string');
  await expect(page).not.toHaveURL(/\/auth\/login(?:$|\?)/, { timeout: 20_000 });
  return { accessToken, userId: JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url')).id };
}

module.exports = { openLogin, signIn, latestMessageId, readLatestMailValue, readLatestOtp, prepareOtp, enterOtp };
