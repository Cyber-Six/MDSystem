'use strict';
const { expect } = require('@playwright/test');
const catalogFields = {
  conditionId: '', allergenCatalogId: 'allergen:', medicineId: '', vaccineTypeId: '', tagId: '', procedureTypeId: '', procedureId: '', programId: '',
};
const sectionTitles = {
  personalInfo: 'Personal Information', profile: 'Personal Information', emergencyContact: 'Emergency Contacts',
  medicalHistory: 'Medical History', allergyProfile: 'Medical Background', hospitalizationProfile: 'Medical Background',
  operationProfile: 'Medical Background', medicationProfile: 'Medical Background', immunizationProfile: 'Medical Background',
  lifestyle: 'Medical Background', visualAcuityProfile: 'Medical Background', dentalHistory: 'Dental History',
  dentalProcedureProfile: 'Dental History', oralApplianceProfile: 'Dental History', dentalPhotoRecord: 'Dental History', obgynHistory: 'OB-GYNE History',
};
const labels = {
  first_name: 'First Name', middle_name: 'Middle Name', last_name: 'Last Name', suffix: 'Suffix', date_of_birth: 'Birthday',
  sex: 'Sex', civil_status: 'Civil Status', nationality: 'Nationality', religion: 'Religion', contactNumber: 'Contact Number',
  present_address: 'Present Address', province_address: 'Province Address', branch: 'Branch', identifier: 'Identifier', department: 'Department', role: 'Role', position: 'Position',
  employmentCategoryOther: 'Employment Category Description', programId: 'Program', year: 'Year Level', contactName: 'Name', relationship: 'Relationship', address: 'Address',
  smoker: 'Smoker', numberOfCigarettesPerDay: 'Cigarettes/Day', yearsSmoked: 'Years Smoked', alcoholConsumer: 'Alcohol Consumer',
  frequencyOfAlcoholConsumption: 'Alcohol Frequency', vapeUser: 'Vaper', vapeType: 'Vape Type', vapeFrequency: 'Vape Frequency', yearsVaping: 'Years Vaping',
  seenByDentist: 'Seen by Dentist', lastDentalCleaning: 'Last Dental Cleaning', purpose: 'Purpose', lastVisitDate: 'Last Visit Date',
  otherDescription: 'Other Appliance Description', otherArch: 'Other Appliance Location', lastMenstrualPeriod: 'Last Menstrual Period', hasDysmenorrhea: 'Dysmenorrhea',
};
const skipKeys = new Set(['id', 'acuityId', 'program', 'scope', 'email', '__typename', 'created_at', 'status']);

function applicable(section, manifest) {
  if (['personalInfo', 'profile'].includes(section)) return true;
  if (section === 'obgynHistory') return manifest.scope !== 'Dental' && manifest.record.personalInfo.sex === 'Female';
  const dental = section.startsWith('dental') || section === 'oralApplianceProfile';
  return manifest.scope === 'Both' || (dental ? manifest.scope === 'Dental' : manifest.scope === 'Medical');
}

function valuesFor(manifest) {
  const result = [];
  for (const [section, value] of Object.entries(manifest.record)) {
    if (!applicable(section, manifest)) continue;
    const walk = (node, path = [], parent = null) => {
      if (node == null || node === '') return;
      if (Array.isArray(node)) { node.forEach((child, index) => walk(child, [...path, index], node)); return; }
      if (typeof node === 'object') { Object.entries(node).forEach(([key, child]) => walk(child, [...path, key], node)); return; }
      const key = path.at(-1);
      if (skipKeys.has(key) && !(key === 'status' && ['allergyProfile', 'oralApplianceProfile'].includes(section))) return;
      // Exclude abandoned conditional lifestyle detail fields.
      if (section === 'lifestyle' && ((!value.smoker && ['numberOfCigarettesPerDay', 'yearsSmoked'].includes(key))
        || (!value.vapeUser && ['vapeType', 'vapeFrequency', 'yearsVaping'].includes(key))
        || (!value.alcoholConsumer && key === 'frequencyOfAlcoholConsumption'))) return;
      const isCatalog = Object.hasOwn(catalogFields, key);
      let display = isCatalog ? (manifest.labels[`${section}:${node}`] || manifest.labels[`${catalogFields[key]}${node}`]) : node;
      if (isCatalog && !display) throw new Error(`Original input has an unresolved catalog label: ${section}.${path.join('.')}`);
      if (typeof display === 'boolean') display = display ? 'Yes' : 'No';
      if (key === 'lastDentalCleaning') display = ({ '0-6': '0-6 months', '7-12': '7-12 months', '12-24': '12-24 months', '>24': '>24 months' })[display] || display;
      if (key === 'role') display = ({ teaching: 'Teaching', teaching_officer: 'Teaching (Officer)', non_teaching: 'Non-Teaching', non_teaching_officer: 'Non-Teaching (Officer)' })[display] || display;
      result.push({ section, title: sectionTitles[section], path, label: labels[key], value: node, display: String(display), catalog: isCatalog,
        photo: section === 'dentalPhotoRecord' && ['upperTeeth', 'lowerTeeth'].includes(key) });
    };
    walk(value);
  }
  return result;
}

function actualValue(snapshot, field) {
  let root = field.section === 'personalInfo' ? snapshot.personal.logs?.[0] ?? snapshot.personal.approved : snapshot.record[field.section];
  for (const key of field.path) {
    const mapped = key === 'date_identified' ? 'dateIdentified' : key;
    root = root?.[mapped];
  }
  return root;
}

function compareSaved(manifest, snapshot, comparisons) {
  for (const field of valuesFor(manifest)) {
    if (field.path.at(-1) === 'programId') {
      expect(snapshot.record.profile?.program, 'Student program label').toBe(field.display);
      continue;
    }
    let actual = actualValue(snapshot, field), expected = field.value;
    if (/^\d{4}-\d{2}-\d{2}/.test(String(expected))) actual = actual?.slice(0, 10);
    if (field.catalog) { actual = actual == null ? actual : String(actual); expected = String(expected); }
    comparisons.push({ field: `${field.section}.${field.path.join('.')}`, expected, actual });
    expect(actual, `${field.section}.${field.path.join('.')}`).toEqual(expected);
  }
  for (const [section, row] of Object.entries(snapshot.record)) {
    if (manifest.record[section] && applicable(section, manifest)) expect(String(row?.id), `${section} ticket ownership`).toBe(String(manifest.ticketId));
  }
}

async function assertFullRecord(page, manifest, comparisons = []) {
  const dialog = page.getByRole('dialog', { name: 'Record Review', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('data-ticket-id', String(manifest.ticketId));
  for (const field of valuesFor(manifest)) {
    const section = dialog.locator('[data-review-section]').filter({ has: page.getByRole('heading', { name: field.title, exact: true }) });
    await expect(section, field.title).toHaveCount(1);
    const entry = typeof field.path[1] === 'number' ? section.locator('[data-review-entry="' + field.section + ':' + field.path[1] + '"]') : null;
    const fieldContainer = entry && await entry.count() ? entry : section;
    if (field.photo) {
      const image = section.getByRole('img', { name: field.path[0] === 'upperTeeth' ? 'Upper teeth photo' : 'Lower teeth photo', exact: true });
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
    } else if (/^\d{4}-\d{2}-\d{2}/.test(field.display)) {
      const date = new Date(`${field.display.slice(0, 10)}T00:00:00Z`);
      const short = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      const text = await fieldContainer.innerText();
      expect(text.includes(short) || text.includes(field.display.slice(0, 10)), `${field.title}: ${field.path.join('.')} date`).toBe(true);
    } else {
      // Match inside the correct section and associate named fields with their row.
      const container = field.section === 'emergencyContact' ? section.locator(`[data-review-contact="${field.path[0]}"]`) : fieldContainer;
      const row = field.label ? container.locator('dt').filter({ hasText: new RegExp(`^${escape(field.label)}$`) }).locator('..') : null;
      const scope = row && await row.count() ? row.first() : container;
      await expect(scope).toContainText(field.display, { useInnerText: true });
    }
    comparisons.push({ field: `${field.title}.${field.path.join('.')}`, expected: field.display, visible: true });
  }
  await expect(dialog).not.toContainText(/\bundefined\b|Unresolved choice|(?:Condition|Allergen|Vaccine|Medicine|Procedure|Tag) #\d+/);
}
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
module.exports = { valuesFor, compareSaved, assertFullRecord, applicable, actualValue };
