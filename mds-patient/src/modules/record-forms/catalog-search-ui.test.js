import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import MedicalBackgroundForm from './initial-record/medical/medical-background';
import MedicalHistoryStep from './update-record/medical-history-step';
import { fetchAllMedicalCatalogs } from './update-record/medical-history-service';
import * as service from '@core/services/emr-service';

jest.mock('@core/services/emr-service', () => ({
  searchDomainCatalog: jest.fn(async () => [{ id: '13', name: 'Hepatitis' }]),
  createDomainCatalog: jest.fn(), searchImmunizationCatalog: jest.fn(async () => []),
  createImmunizationCatalog: jest.fn(), searchAllergenCatalogByName: jest.fn(async () => [{ id: '7', allergen: 'Bleach', type: 'Chemical' }]),
  createAllergenCatalogEntry: jest.fn(),
}), { virtual: true });
jest.mock('./update-record/medical-history-service', () => ({ fetchAllMedicalCatalogs: jest.fn() }));
jest.mock('../../context/use-banner.js', () => ({ useBanner: () => ({ clearAllBanners: jest.fn() }) }));

let root, container;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  fetchAllMedicalCatalogs.mockResolvedValue({ medicalConditions: [], hospitalizations: [{ id: '13', name: 'Hepatitis' }], operations: [], immunizations: [], visualAcuity: [], medications: [], allergens: [{ id: '7', allergen: 'Bleach', type: 'Chemical' }] });
});
afterEach(() => { act(() => root.unmount()); container.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
function Initial() {
  const [data, onChange] = useState({ hasAllergies: 'Yes', hasHospitalization: 'Yes', allergies: {} });
  const hospitalizations = [...Array.from({ length: 12 }, (_, i) => ({ id: String(100 + i), name: `Synthetic ${i}` })), { id: '13', name: 'Hepatitis' }];
  return <MedicalBackgroundForm data={data} onChange={onChange} hospitalizationCatalog={hospitalizations} allergenCatalog={[{ id: '7', allergen: 'Bleach', type: 'Chemical' }]} />;
}
function Update() {
  const [data, onChange] = useState({ hasAllergies: 'yes', selectedAllergies: [], selfConditions: {}, familyConditions: {} });
  return <MedicalHistoryStep formData={data} onChange={onChange} />;
}
const click = element => act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
function type(input, text) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  });
}

test.each([['initial/revision', Initial], ['update', Update]])('%s: existing allergen blocks Add, selects and deselects consistently', async (_, Component) => {
  await act(async () => root.render(<Component />));
  const allergyButton = [...container.querySelectorAll('button')].find(button => /^(History of Allergies|Allergies)$/.test(button.textContent.trim()));
  expect(allergyButton).toBeTruthy();
  click(allergyButton);
  const input = [...container.querySelectorAll('input[type="text"]')].find(input => input.parentElement.textContent.includes('Other Allergens') || input.parentElement.parentElement.textContent.includes('Other Allergens'));
  expect(input).toBeTruthy();
  type(input, 'Bleach');
  const add = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Already in the list'));
  expect(add).toBeTruthy();
  expect(add.disabled).toBe(true);
  const result = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Bleach') && button.textContent.includes('Chemical'));
  click(result);
  const checkbox = [...container.querySelectorAll('label')].find(label => label.textContent.trim() === 'Bleach')?.querySelector('input');
  expect(checkbox?.checked).toBe(true);
  expect(container.querySelector('summary').textContent).toContain('1 selected');
  click(checkbox);
  expect(container.querySelector('summary').textContent).toContain('0 selected');
  type(input, 'Bleach');
  expect([...container.querySelectorAll('button')].find(button => button.textContent.includes('Already in the list')).disabled).toBe(true);
  expect(service.createAllergenCatalogEntry).not.toHaveBeenCalled();
});

test('hospitalization search: existing result beyond the first 12 can be selected into the main list', async () => {
  await act(async () => root.render(<Initial />));
  const section = [...container.querySelectorAll('button')].find(button => /Hospitalization/.test(button.textContent));
  click(section);
  const input = [...container.querySelectorAll('input[type="text"]')].find(input => input.parentElement.textContent.includes('Other Hospitalizations') || input.parentElement.parentElement.textContent.includes('Other Hospitalizations'));
  expect(input).toBeTruthy();
  type(input, 'Hepatitis');
  const add = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Already in the list'));
  expect(add.disabled).toBe(true);
  const result = [...container.querySelectorAll('button')].find(button => button.textContent.trim() === 'Hepatitis');
  click(result);
  const checkbox = [...container.querySelectorAll('label')].find(label => label.textContent.trim() === 'Hepatitis')?.querySelector('input');
  expect(checkbox?.checked).toBe(true);
  expect(service.createDomainCatalog).not.toHaveBeenCalled();
});
