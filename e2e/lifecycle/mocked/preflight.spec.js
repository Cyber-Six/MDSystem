const { test, expect } = require('@playwright/test');
const http = require('node:http');
const { preflight } = require('../driver');
let server, url, failure, registrations, logins;
const loginHtml = `<!doctype html><html><body>
<button onclick="document.querySelector('form').hidden=false">Open login panel</button>
<form hidden onsubmit="return false"><label>Email address<input id="email"></label><label>Password<input id="password" type="password"></label>
<button type="button" onclick="signIn()">Sign in</button></form><div id="otp"></div>
<script>
async function signIn(){const r=await fetch('/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:email.value,password:password.value})});const b=await r.json();if(b.ok)otp.innerHTML=Array.from({length:6},()=>'<input inputmode="numeric" maxlength="1">').join('')+'<button onclick="verify()">Verify code</button>';}
async function verify(){await fetch('/auth/login/complete',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});}
</script></body></html>`;
test.beforeAll(async () => {
  server = http.createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const json = (body, status = 200) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); };
    if (request.url === '/auth/login' && request.method === 'GET') { response.writeHead(200, { 'content-type': 'text/html' }); return response.end(loginHtml); }
    if (request.url.includes('register')) registrations++;
    if (request.url === '/auth/login') { logins++; return json(failure === 'authentication' ? { ok: false, error: 'INVALID_CREDENTIALS' } : { ok: true }, failure === 'authentication' ? 400 : 200); }
    if (request.url === '/auth/login/complete') {
      if (failure === 'consent') return json({ error: 'DATA_CONSENT_REQUIRED' }, 400);
      if (failure === 'outdatedConsent') return json({ error: 'OUTDATED_CONSENT' }, 400);
      if (failure === 'unverified2fa') return json({ error: '2FA_NOT_VERIFIED' }, 400);
      if (failure === 'missingToken') return json({ ok: true });
      return json({ ok: true, accessToken: 'qa-mocked-access' });
    }
    if (request.url === '/staff/me/profile') return json({ isActive: failure !== 'inactive' });
    if (request.url === '/staff/me/permissions') return json({ branch: failure === 'branch' ? 'QuezonCity' : 'Both',
      modules: ['pendingRequests', 'medicalRecords', 'dentalRecords'].map(moduleId => ({ moduleId, enabled: failure !== 'permission' })),
      searchPatientPermissions: { emr_allow_view: true, profile_allow_view: true } });
    if (request.url === '/emr/medical') {
      if (!request.headers.authorization) return json({ errors: [{ message: 'Unauthorized' }] }, 401);
      return json(failure === 'schema' ? { errors: [{ message: 'column ep.employmentCategoryOther does not exist' }] } : { data: { searchPatients: [] } }, failure === 'schema' ? 400 : 200);
    }
    return json({ error: 'Unexpected mock request' }, 404);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  process.env.E2E_REVIEW_STAFF_EMAIL = 'dedicated@qa.invalid';
  process.env.E2E_REVIEW_STAFF_PASSWORD = 'local-only-mock-credential';
  process.env.E2E_TEST_OTP = '111111';
});
test.beforeEach(() => { failure = null; registrations = 0; logins = 0; });
test.afterAll(async () => { await new Promise(resolve => server.close(resolve)); });
const run = () => ({ id: 'mock-preflight', targets: { E2E_PATIENT_URL: url, E2E_STAFF_URL: url } });
test('authenticates staff, checks permissions and SQL schema before any registration', async ({ browser }) => {
  const result = await preflight(browser, run());
  expect(result.schema).toBe('verified');
  expect(logins).toBe(1);
  expect(registrations).toBe(0);
});
for (const [type, message] of [['authentication', /INVALID_CREDENTIALS/], ['schema', /migrate-employee-category/],
  ['permission', /pendingRequests/], ['branch', /Manila/], ['inactive', /must be active/],
  ['consent', /HTTP 400, DATA_CONSENT_REQUIRED.*Sign in manually/], ['outdatedConsent', /OUTDATED_CONSENT/],
  ['unverified2fa', /2FA_NOT_VERIFIED/], ['missingToken', /HTTP 200, INVALID_COMPLETION_RESPONSE/]]) {
  test(`${type} failure prevents account creation`, async ({ browser }) => {
    failure = type;
    await expect(preflight(browser, run())).rejects.toThrow(message);
    expect(registrations).toBe(0);
  });
}
