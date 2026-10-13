const { test } = require('@playwright/test');
const { configureAccountTests, registerAndOpenRecord, fillAndSubmitRecord } = require('./registration-helpers');

configureAccountTests();

const profile = { role: 'Employee', gender: 'Male', name: 'Noah', surname: 'Garcia' };

test(profile.role + ': fills and submits complete record for ' + profile.name + ' ' + profile.surname, async ({ page }) => {
  const account = await registerAndOpenRecord(page, profile, 8);
  await fillAndSubmitRecord(page, profile, 8, account);
});
