const fs = require('node:fs');
const path = require('node:path');
const { redact } = require('./evidence');

class ErrorReporter {
  constructor() { this.results = []; }
  onTestEnd(testCase, result) {
    const attachment = result.attachments.find(item => item.name === 'custom-choice-evidence.json');
    let evidence;
    try { evidence = JSON.parse(attachment.body ? attachment.body.toString() : fs.readFileSync(attachment.path, 'utf8')); } catch {}
    this.results.push(redact({ test: testCase.title, file: path.basename(testCase.location.file), recordedAt: new Date().toISOString(), status: result.status,
      errors: result.errors.map(error => ({ message: this.clean(error.message), stack: this.clean(error.stack) })), evidence }));
  }
  clean(value = '') {
    let clean = value.replace(/\u001b\[[0-9;]*m/g, '');
    for (const account of require('./account-registry').read()) {
      if (account.password) clean = clean.split(account.password).join('[redacted]');
    }
    for (const [key, secret] of Object.entries(process.env)) {
      if (/E2E_.*(PASSWORD|TOKEN|OTP|SECRET)/i.test(key) && secret) clean = clean.split(secret).join('[redacted]');
    }
    return clean;
  }
  onEnd() {
    if (!this.results.length) return;
    const directory = path.resolve('e2e-results/custom-choices');
    fs.mkdirSync(directory, { recursive: true });
    // Individual-file runs update that workflow's entry without discarding the
    // prerequisite failures or evidence from the other three workflows.
    const filename = path.join(directory, 'results.json');
    const previous = fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : [];
    const merged = new Map(previous.map(result => [result.file, result]));
    this.results.forEach(result => merged.set(result.file, result));
    this.results = [...merged.values()];
    fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify(this.results, null, 2));
    const lines = ['# Custom-choice test results', '', `Recorded: ${new Date().toISOString()}`, '',
      'These results describe the attempted workflows. A failed or unconfigured workflow does not prove saved-record coverage.', ''];
    for (const result of this.results) {
      lines.push(`## ${result.test}`, '', `Status: ${result.status}`, '',
        `Workflow recorded: ${result.recordedAt || 'Earlier run'}`, '',
        `Reproduce: \`E2E_CUSTOM_CHOICES_ENABLED=1 npm run test:e2e:custom-choices -- ${result.file} --headed\``, '',
        `Last step: ${result.evidence?.failedStep || 'Preflight / unavailable'}`, '');
      for (const error of result.errors) lines.push('```text', error.message, '```', '');
      lines.push('Saved-value comparisons:', '', '```json', JSON.stringify(result.evidence?.comparisons || [], null, 2), '```', '',
        'Captured requests and responses (credentials omitted):', '', '```json',
        JSON.stringify(result.evidence?.network || [], null, 2), '```', '');
    }
    fs.writeFileSync(path.join(directory, 'errors.md'), lines.join('\n'));
    console.log(`Custom-choice report: ${path.join(directory, 'errors.md')}`);
  }
}
module.exports = ErrorReporter;
