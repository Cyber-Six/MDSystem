'use strict';
// The engine passes explicit artifacts; it never discovers accounts in registries.
const stageNames = scenario => scenario.kind === 'update'
  ? ['initialSubmission', 'baselineApproval', 'updateSubmission', 'decision'] : ['initialSubmission', 'decision'];

async function execute(run, scenario, driver, persist, step = async (_name, action) => action()) {
  const names = stageNames(scenario);
  const saveAccount = async account => { scenario.account = account; persist(run); };
  try {
    if (scenario.account) await step('Authenticate saved run account and reconcile current ticket', () => driver.reconcile(scenario));
    delete scenario.blocker;
    for (const name of names) {
      const previous = scenario.stages[name];
      if (previous?.status === 'passed') continue;
      if (previous) throw new Error(`Stage ${name} was interrupted or failed. Its write outcome is uncertain; inspect the authenticated ticket and private run manifest before recovery. No action was repeated.`);
      scenario.stages[name] = { status: 'running', startedAt: new Date().toISOString() };
      persist(run);
      try {
        const result = await step(name, () => driver[name](scenario, saveAccount));
        if (!result?.manifest?.verified || !result.account?.email || !result.account?.password) throw new Error(`${name} did not return verified record identity and credentials`);
        if (scenario.account && scenario.account.email !== result.account.email) throw new Error('Lifecycle stage attempted to change patients');
        if (result.manifest.role !== scenario.role || result.manifest.url !== run.targets.E2E_PATIENT_URL) throw new Error('Lifecycle artifact role or deployment mismatch');
        if (name !== 'initialSubmission' && String(result.manifest.patientId) !== String(scenario.stages.initialSubmission.result.manifest.patientId)) throw new Error('Lifecycle stage returned another patient');
        const expectedKind = ['initialSubmission', 'baselineApproval'].includes(name) ? 'initial' : scenario.kind;
        const expectedStatus = name === 'baselineApproval' ? 'Approved' : name === 'decision' ? (scenario.action === 'reject' ? 'Rejected' : 'Approved') : 'Pending';
        if (result.manifest.kind !== expectedKind || result.status !== expectedStatus) throw new Error('Lifecycle stage returned an unexpected record kind or ticket status');
        if (name === 'updateSubmission') {
          const baseline = scenario.stages.baselineApproval.result.manifest;
          if (String(result.manifest.ticketId) === String(baseline.ticketId) || String(result.manifest.baseline?.ticketId) !== String(baseline.ticketId)) {
            throw new Error('Update must have a new ticket and preserve the exact approved baseline');
          }
        }
        if (name === 'baselineApproval' || name === 'decision') {
          const input = scenario.stages[name === 'baselineApproval' || scenario.kind === 'initial' ? 'initialSubmission' : 'updateSubmission'].result.manifest;
          if (String(result.manifest.ticketId) !== String(input.ticketId)) throw new Error('Staff decision returned another ticket');
        }
        scenario.account = result.account;
        scenario.stages[name] = { ...scenario.stages[name], status: 'passed', result, completedAt: new Date().toISOString() };
        persist(run);
      } catch (error) {
        scenario.stages[name].status = 'failed';
        // Errors can contain request variables. Only sanitized reporters receive them.
        scenario.stages[name].reason = 'Stage failed; inspect sanitized lifecycle report';
        for (const next of names.slice(names.indexOf(name) + 1)) scenario.stages[next] ||= { status: 'blocked', reason: `Prerequisite ${name} failed` };
        persist(run);
        throw error;
      }
    }
    persist(run);
  } catch (error) {
    scenario.blocker = error.message;
    persist(run);
    throw error;
  }
}
module.exports = { stageNames, execute };
