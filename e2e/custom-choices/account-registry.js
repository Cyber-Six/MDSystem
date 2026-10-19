const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const filename = path.resolve(__dirname, '../../.e2e-private/custom-choice-accounts.json');
const normalizeUrl = url => new URL(url).href.replace(/\/+$/, '');
const isPlaceholder = value => /^(?:actual-|your-|placeholder\b|<|\.\.\.|example\b)/i.test(String(value || '').trim()) || /@example\.(?:com|test)$/i.test(String(value || '').trim());
function read(file = filename) {
  if (!fs.existsSync(file)) return [];
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(rows)) throw new Error('Invalid local QA account registry; restore its JSON array before running tests.');
  return rows;
}
function save(account, file = filename) {
  const rows = read(file);
  const url = normalizeUrl(account.url);
  const index = rows.findIndex(row => row.email === account.email && row.url === url);
  const row = { ...(index >= 0 ? rows[index] : { createdAt: new Date().toISOString(), ready: false }), ...account, url };
  if (index >= 0) rows[index] = row; else rows.push(row);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(rows, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, file);
    if (process.platform !== 'win32') fs.chmodSync(file, 0o600);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  return row;
}
function candidates(role, url, env = process.env, file = filename) {
  const prefix = `E2E_CUSTOM_${role.toUpperCase()}`;
  const email = env[`${prefix}_EMAIL`];
  const password = env[`${prefix}_PASSWORD`];
  if (email && password) {
    if (isPlaceholder(email) && isPlaceholder(password)) {
      // Documentation examples in .env.e2e should not mask usable saved QA accounts.
    } else if (isPlaceholder(email) || isPlaceholder(password)) {
      throw new Error(`Only one of ${prefix}_EMAIL and ${prefix}_PASSWORD contains a sample value. Replace both with real patient QA credentials, or remove both to use saved accounts.`);
    } else {
      return [{ role, email, password, url: normalizeUrl(url) }];
    }
  }
  if ((email && !isPlaceholder(email)) || (password && !isPlaceholder(password))) {
    throw new Error(`Configure both ${prefix}_EMAIL and ${prefix}_PASSWORD, or remove both to use saved QA accounts.`);
  }
  return read(file).filter(row => row.role === role && row.url === normalizeUrl(url) && row.ready && row.email && row.password && !isPlaceholder(row.email) && !isPlaceholder(row.password))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function eligibility(role, personal, emr) {
  const reasons = [];
  if (personal.getCredentialStatus !== 'Active') reasons.push('account must be Active');
  if (!personal.getPersonalRecord?.id) reasons.push('approved personal information is missing');
  if (emr.getPatientBasicInfo?.profile_type !== role) reasons.push('patient role does not match');
  if (emr.getUpdateTicket?.status !== 'Approved') reasons.push(`staff approval required; ticket status is ${emr.getUpdateTicket?.status || 'missing'}`);
  if (!['Approved', 'Cancelled', null].includes(personal.getPersonalRecordLogStatus)) reasons.push('personal record draft or update is active');
  return reasons;
}
module.exports = { read, save, candidates, eligibility, isPlaceholder };
