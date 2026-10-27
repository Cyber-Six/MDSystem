const { test } = require('@playwright/test');
const { secretValues } = require('./evidence');

async function sanitizeSensitivePage(page) {
  const secrets = secretValues();
  await page.evaluate(values => {
    const scrub = value => {
      let clean = String(value || '');
      for (const secret of values) clean = clean.split(secret).join('[REDACTED]');
      return clean.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL REDACTED]');
    };
    document.querySelectorAll('input, textarea').forEach(field => {
      if (field.type === 'password' || field.type === 'email' || /username|current-password|one-time-code/i.test(field.autocomplete || '')) {
        field.value = '';
        field.removeAttribute('value');
      } else if (field.value) {
        field.value = scrub(field.value);
        field.setAttribute('value', field.value);
      }
    });
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) walker.currentNode.textContent = scrub(walker.currentNode.textContent);
    document.querySelectorAll('*').forEach(element => {
      for (const attribute of [...element.attributes]) {
        const clean = scrub(attribute.value);
        if (clean !== attribute.value) element.setAttribute(attribute.name, clean);
      }
    });
  }, secrets);
}

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  try { await sanitizeSensitivePage(page); } catch {
    // A closed page may prevent sanitizing the failure snapshot.
  }
});

module.exports = { sanitizeSensitivePage };
