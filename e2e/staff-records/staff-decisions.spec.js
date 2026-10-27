const { test } = require('@playwright/test');
const { runWorkflow } = require('./workflow');
for (const role of ['Student', 'Employee']) {
  for (const kind of ['initial', 'update']) {
    for (const action of ['approve', 'reject', 'revise']) {
      const scenario = { role, kind, action, id: `${role.toLowerCase()}-${kind}-${action}` };
      test(`${role} ${kind}: full record and ${action}`, async ({ browser }) => runWorkflow(browser, scenario));
    }
  }
}
