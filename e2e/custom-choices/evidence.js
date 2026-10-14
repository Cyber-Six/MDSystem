const { test, expect } = require('@playwright/test');

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/password|token|authorization|cookie|otp|secret/i.test(key))
    .map(([key, item]) => [key, redact(item)]));
  if (typeof value === 'string') return value.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted token]');
  return value;
}

function observe(page, state) {
  state.network = [];
  state.comparisons = [];
  state.created = {};
  state.pending = new Set();
  state.headers = {};
  const responseListener = response => {
    const request = response.request();
    if (request.method() !== 'POST' || !/\/(emr|profile)\/patient$/.test(response.url())) return;
    const task = (async () => {
      const headers = await request.allHeaders();
      if (headers.authorization) state.headers = Object.fromEntries(Object.entries(headers)
        .filter(([key]) => ['authorization', 'content-type', 'x-csrf-token', 'x-xsrf-token', 'x-portal'].includes(key)));
      const body = request.postDataJSON();
      const result = await response.json();
      state.network.push(redact({ endpoint: new URL(response.url()).pathname, request: body, response: result, status: response.status() }));
    })().catch(error => { state.network.push({ observationError: error.message }); });
    state.pending.add(task);
    task.finally(() => state.pending.delete(task));
  };
  page.on('response', responseListener);
  state.stopObserving = () => page.off('response', responseListener);
}

async function query(page, state, endpoint, document, variables = {}) {
  expect(state.headers.authorization, 'An authenticated patient request is required before readback').toBeTruthy();
  const response = await page.request.post(`${state.url}${endpoint}`, {
    headers: state.headers, data: { query: document, variables },
  });
  const body = await response.json();
  state.network.push(redact({ endpoint, request: { query: document, variables }, response: body, status: response.status() }));
  const errors = (body.errors || []).map(error => error.message).join('; ');
  expect(response.ok(), `Read ${endpoint} failed with HTTP ${response.status()}${errors ? `: ${errors}` : ''}`).toBeTruthy();
  expect(body.errors || [], `Read ${endpoint}: GraphQL errors`).toEqual([]);
  return body.data;
}

function compare(state, field, expected, actual) {
  state.comparisons.push(redact({ field, expected, actual: actual ?? null }));
  expect.soft(actual, field).toEqual(expected);
}

async function attach(state) {
  state.stopObserving?.();
  await Promise.allSettled([...state.pending]);
  const evidence = redact({ role: state.role, mode: state.mode, generated: state.data, created: state.created,
    ticket: state.ticket, baseline: state.baseline, comparisons: state.comparisons, network: state.network,
    failedStep: state.currentStep });
  await test.info().attach('custom-choice-evidence.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
}

module.exports = { redact, observe, query, compare, attach };
