'use strict';
const { expect } = require('@playwright/test');
const { normalizeName, normalizeNumber } = require('../../Backend/utils/validator');
const { captureReview } = require('./manifest');

function control(page, field) {
  const scope = field.accordion ? page.getByRole('button', { name: field.accordion, exact: true }).locator('..') : page;
  if (field.type === 'checkbox' && field.label) {
    return scope.getByRole(field.type, { name: field.label, exact: true }).filter({ visible: true });
  }
  let locator = scope.locator(field.tag);
  if (field.placeholder) locator = scope.getByPlaceholder(field.placeholder, { exact: true });
  else if (field.name) locator = scope.locator(`${field.tag}[name=${JSON.stringify(field.name)}]`);
  else if (field.type && field.tag === 'input') locator = scope.locator(`${field.tag}[type=${JSON.stringify(field.type)}]`);
  if (['checkbox', 'radio'].includes(field.type) && field.name) locator = locator.locator(`xpath=self::*[@value=${JSON.stringify(field.value)}]`);
  return locator.filter({ visible: true }).nth(field.index || 0);
}

function replaceValue(value, from, to) {
  if (Array.isArray(value)) return value.map(item => replaceValue(item, from, to));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceValue(item, from, to)]));
  if (value === from) return to;
  if (/^\d{4}-\d{2}$/.test(String(from)) && value === `${from}-01`) return `${to}-01`;
  return value;
}

async function exposeInputs(page) {
  // Expand existing form accordion buttons; leave navigation and action buttons alone.
  const titles = ['Immunization & Vaccines', 'Immunization History', 'History of Allergies', 'Allergies',
    'History of Hospitalizations', 'Hospitalizations', 'History of Operation', 'Surgeries', 'Medications', 'Current Medications',
    'Lifestyle', 'Visual Acuity', 'Dentist Visits', 'Intraoral Appliances', 'Dental Procedures', 'Dental Photos'];
  for (const title of titles) {
    const button = page.getByRole('button', { name: title, exact: true });
    if (await button.count() === 1 && await button.isVisible()) {
      const closed = button.locator('..').locator(':scope > div.max-h-0');
      if (await closed.count()) await button.click();
    }
  }
}

async function revise(page, manifest, instruction, evidence) {
  await page.goto(`${manifest.url}/`);
  await expect(page.getByText(instruction, { exact: false }).first()).toBeVisible();
  if (manifest.kind === 'update') {
    const continueRevision = page.getByRole('button', { name: /Continue.*Revision/ });
    if (await continueRevision.isVisible()) await continueRevision.click();
    else await page.goto(`${manifest.url}/record-update`);
    const both = page.getByRole('button', { name: /Both Update/ });
    if (await both.isVisible()) await both.click();
  }
  const revised = structuredClone(manifest);
  const edited = new Set();
  const contactPrefill = new Map();
  for (const section of manifest.controls) {
    if (section.section === 'history') await page.getByRole('button', { name: 'Family', exact: true }).click();
    await exposeInputs(page);
    // Compare every captured original active input before making edits.
    for (const field of section.fields) {
      if (field.type === 'file' || field.label?.includes('certify')) continue;
      if (field.accordion) {
        const button = page.getByRole('button', { name: field.accordion, exact: true });
        if (await button.locator('..').locator(':scope > div.max-h-0').count()) await button.click();
      }
      const input = control(page, field);
      await expect(input, `${section.section}: ${field.label || field.name || field.placeholder} must retain its value`).toBeVisible();
      if (['checkbox', 'radio'].includes(field.type)) {
        if (field.checked) await expect(input).toBeChecked();
        else await expect(input).not.toBeChecked();
      } else {
        const normalize = section.section === 'personal' && ({
          'Contact Name': normalizeName,
          'Contact Number': normalizeNumber,
        }[field.placeholder]);
        const expected = normalize && field.value ? normalize(field.value) : field.value;
        if (expected !== field.value) contactPrefill.set(field.value, expected);
        await expect(input).toHaveValue(expected);
      }
    }
    let field;
    if (section.section === 'personal') field = section.fields.find(row => row.placeholder === 'Contact Name' && row.value);
    if (section.section === 'background') field = section.fields.find(row => row.tag === 'textarea' && row.value);
    if (section.section === 'dental') field = section.fields.find(row => row.type === 'month' && row.value);
    if (field && !edited.has(section.section)) {
      const prefilled = contactPrefill.get(field.value) ?? field.value;
      const value = field.type === 'month' ? (field.value === '2025-07' ? '2025-08' : '2025-07') : `${prefilled} Revised QA`;
      if (field.accordion) {
        const button = page.getByRole('button', { name: field.accordion, exact: true });
        if (await button.locator('..').locator(':scope > div.max-h-0').count()) await button.click();
      }
      await control(page, field).fill(value);
      revised.record = replaceValue(revised.record, field.value, value);
      edited.add(section.section);
      evidence.revisionChanges.push({ section: section.section, before: prefilled, after: value });
    }
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  expect([...edited].sort(), 'Revision must exercise personal, medical, and dental fields').toEqual(['background', 'dental', 'personal']);
  // Review all original visible scalar fields, substituting only deliberate edits.
  const current = await captureReview(page);
  for (const [field, arch] of [['upperTeeth', 'Upper'], ['lowerTeeth', 'Lower']]) {
    if (!manifest.record.dentalPhotoRecord?.[field]) continue;
    const photo = page.getByRole('img', { name: new RegExp(`^${arch} teeth(?: preview)?$`, 'i') });
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  for (const row of manifest.review) {
    if (!row.value || row.value === 'Not provided') continue;
    // A saved photo is shown with a generated caption on the revision form.
    if (/^(?:Upper|Lower) Teeth Photo$/i.test(row.label)) continue;
    let expected = row.value;
    if (/^(?:Name|Contact Number|Name of Contact Person|Person\/s to be Contacted|Contact Number During Emergency|Emergency Contact [12])$/.test(row.label)) {
      for (const [before, after] of contactPrefill) expected = expected.replaceAll(before, after);
    }
    for (const change of evidence.revisionChanges) expected = expected.replaceAll(change.before, change.after);
    for (const change of evidence.revisionChanges.filter(item => /^\d{4}-\d{2}$/.test(item.before))) {
      for (const options of [{ month: 'long', year: 'numeric' }, { month: 'short', year: 'numeric' }, { month: 'long', day: 'numeric', year: 'numeric' }, { month: 'short', day: 'numeric', year: 'numeric' }]) {
        const format = value => new Date(value + '-01T00:00:00Z').toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
        expected = expected.replaceAll(format(change.before), format(change.after));
      }
    }
    const candidates = current.filter(item => item.label === row.label);
    expect(candidates.some(item => item.value === expected), `Patient revision review: ${row.label}`).toBe(true);
  }
  await certifyRevision(page, manifest.kind);
  return revised;
}

async function certifyRevision(page, kind) {
  const certification = page.locator('input[type="checkbox"]').filter({ visible: true });
  await expect(certification).toHaveCount(kind === 'initial' ? 1 : 0);
  if (kind === 'initial') await certification.check();
}
module.exports = { control, replaceValue, revise, certifyRevision };
