const fs = require('node:fs');
const path = require('node:path');
const { redact } = require('../custom-choices/evidence');
class StaffRecordReporter {
  constructor() { this.results = []; }
  onTestEnd(test, result) {
    const attachment = result.attachments.find(item => item.name === 'staff-record-evidence.json');
    let evidence;
    if (attachment) evidence = JSON.parse(attachment.body ? attachment.body.toString() : fs.readFileSync(attachment.path, 'utf8'));
    this.results.push(redact({ test: test.title, status: result.status, recordedAt: new Date().toISOString(), evidence,
      skips: [...(test.annotations || []), ...(result.annotations || [])].filter(item => item.type === 'skip').map(item => item.description),
      errors: result.errors.map(error => ({ message: error.message })) }));
  }
  onEnd() {
    const directory = path.resolve('e2e-results/staff-records');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify(this.results, null, 2));
    const lines = ['# Staff record workflow results', '', 'Skipped scenarios are not verified coverage.', ''];
    for (const result of this.results) {
      lines.push(`## ${result.test}`, '', `Status: ${result.status}`, '',
        `Reproduce: E2E_STAFF_RECORDS_ENABLED=1 npm run test:e2e:staff-records -- --grep "${result.test}" --headed`, '',
        ...result.skips.map(reason => `Skipped: ${reason}`), ...result.errors.map(error => error.message), '',
        '```json', JSON.stringify(result.evidence || {}, null, 2), '```', '');
    }
    fs.writeFileSync(path.join(directory, 'errors.md'), lines.join('\n'));
  }
}
module.exports = StaffRecordReporter;
