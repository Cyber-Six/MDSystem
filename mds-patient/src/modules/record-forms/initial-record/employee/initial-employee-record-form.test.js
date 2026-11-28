import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import InitialEmployeeRecordForm from './initial-employee-record-form';
import { saveRecordFormDraft } from '../../record-form-draft-storage';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('@core/services/emr-service', () => ({ fetchAllCatalogs: jest.fn(async () => ({})) }), { virtual: true });
jest.mock('@core/utils/data-transformer', () => ({}), { virtual: true });
jest.mock('@core/components/modals/validation-warning-modal', () => () => null, { virtual: true });
jest.mock('./personal-info', () => ({ data }) => <div data-testid="employee-name">{data.firstName}</div>);

it('restores an employee initial-record draft in the same browser session', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem('patient_refreshToken', 'synthetic-employee:device:token');
  saveRecordFormDraft('initial-employee', {
    currentStep: 0,
    formData: { personalInfo: { firstName: 'Synthetic employee' } },
  });
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => root.render(<InitialEmployeeRecordForm isModal />));
    expect(container.querySelector('[data-testid="employee-name"]').textContent).toBe('Synthetic employee');
    expect(container.textContent).toContain('Saved draft restored.');
  } finally {
    act(() => root.unmount());
    localStorage.removeItem('patient_refreshToken');
    sessionStorage.clear();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
