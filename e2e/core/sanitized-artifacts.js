const path = require('node:path');
const { test } = require('@playwright/test');

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  try {
    await page.evaluate(() => {
      document.querySelectorAll('input, textarea').forEach(field => { field.value = ''; });
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        walker.currentNode.textContent = walker.currentNode.textContent
          .replace(/[A-Za-z0-9._+-]+@tip\.edu\.ph/gi, '[EMAIL REDACTED]')
          .replace(/\b\d{6}\b/g, '[OTP REDACTED]');
      }
    });
    const screenshot = path.join(testInfo.outputDir, 'failure-sanitized.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach('failure-sanitized-screenshot', { path: screenshot, contentType: 'image/png' });
  } catch {
    // A closed page may prevent a screenshot; the HTML report still captures the assertion failure.
  }
});
