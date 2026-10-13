const { test } = require('@playwright/test');
const { configureAccountTests, registerAndOpenRecord, fillAndSubmitRecord } = require('./registration-helpers');

configureAccountTests();

const profile = { role: 'Employee', gender: 'Female', name: 'Amara', surname: 'Santos-Reyes' };

test(profile.role + ': fills and submits complete record for ' + profile.name + ' ' + profile.surname, async ({ page }) => {
  const account = await registerAndOpenRecord(page, profile, 6);
  await fillAndSubmitRecord(page, profile, 6, account);
});
