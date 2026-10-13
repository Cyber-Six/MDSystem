const { test } = require('@playwright/test');
const { configureAccountTests, registerAndOpenRecord, fillAndSubmitRecord } = require('./registration-helpers');

configureAccountTests();

const profile = { role: 'Student', gender: 'Female', branch: 'm', name: 'Zoey', surname: 'Dela Cruz' };

test(profile.role + ': fills and submits complete record for ' + profile.name + ' ' + profile.surname, async ({ page }) => {
  const account = await registerAndOpenRecord(page, profile, 0);
  await fillAndSubmitRecord(page, profile, 0, account);
});
