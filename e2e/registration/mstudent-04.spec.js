const { test } = require('@playwright/test');
const { configureAccountTests, registerAndOpenRecord, fillAndSubmitRecord } = require('./registration-helpers');

configureAccountTests();

const profile = { role: 'Student', gender: 'Male', branch: 'q', name: 'Luca', surname: 'Dela Pena' };

test(profile.role + ': fills and submits complete record for ' + profile.name + ' ' + profile.surname, async ({ page }) => {
  const account = await registerAndOpenRecord(page, profile, 3);
  await fillAndSubmitRecord(page, profile, 3, account);
});
