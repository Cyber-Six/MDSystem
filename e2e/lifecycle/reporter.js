'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { redact } = require('../custom-choices/evidence');
const store = require('./store');
const { stageNames } = require('./engine');
function summarize(id, run, tests) {
  return redact({ runId: id, targets: run?.targets, preflight: run?.preflight, tests,
    scenarios: (run?.scenarios || store.scenarios).map(scenario => ({ id: scenario.id,
      stages: stageNames(scenario).map(name => {
        const stage = scenario.stages?.[name];
        return { name, status: stage?.status || 'blocked', reason: stage?.reason || (!stage ? 'Not reached; check preflight or test filter' : undefined),
          ticketId: stage?.result?.manifest?.ticketId, patientId: stage?.result?.manifest?.patientId, ticketStatus: stage?.result?.status };
      }), blocker: scenario.blocker })),
    reproduce: `E2E_LIFECYCLE_ENABLED=1 npm run test:e2e:lifecycle -- --run-id ${id} --headed`,
  });
}
class LifecycleReporter {
  constructor() { this.tests = []; }
  onTestEnd(test, result) {
    const evidence = result.attachments.filter(item => ['staff-record-evidence.json', 'custom-choice-evidence.json', 'lifecycle-reconciliation.json', 'qa-authentication.json'].includes(item.name))
      .map(item => {
        try { return { name: item.name, data: JSON.parse(item.body ? item.body.toString() : fs.readFileSync(item.path, 'utf8')) }; }
        catch { return { name: item.name, unavailable: true }; }
      });
    this.tests.push(redact({ test: test.title, status: result.status, errors: result.errors.map(error => error.message), evidence }));
  }
  onEnd() {
    if (!this.tests.length) return;
    const id = process.env.E2E_LIFECYCLE_RUN_ID;
    let run;
    try { run = store.read(id); } catch {}
    const report = summarize(id, run, this.tests);
    const directory = path.resolve('e2e-results/lifecycle', id);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify(report, null, 2));
    const lines = [`# Lifecycle ${id}`, '', report.reproduce, '',
      'Resume verifies authenticated state. Failed or interrupted write stages remain blocked and are never automatically repeated.', ''];
    for (const scenario of report.scenarios) {
      lines.push(`## ${scenario.id}`, '', ...scenario.stages.map(stage =>
        `- ${stage.name}: ${stage.status}${stage.ticketId ? `; ticket ${stage.ticketId} (${stage.ticketStatus})` : ''}${stage.reason ? `; ${stage.reason}` : ''}`),
      ...(scenario.blocker ? ['', scenario.blocker] : []), '');
    }
    for (const result of report.tests) lines.push(`## ${result.test}: ${result.status}`, '', ...result.errors, '',
      '```json', JSON.stringify(result.evidence, null, 2), '```', '');
    fs.writeFileSync(path.join(directory, 'errors.md'), lines.join('\n'));
    console.log(`Lifecycle report: ${path.join(directory, 'errors.md')}`);
  }
}
module.exports = LifecycleReporter;
module.exports.summarize = summarize;
