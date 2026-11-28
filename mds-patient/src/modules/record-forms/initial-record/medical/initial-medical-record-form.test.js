import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import InitialMedicalRecordForm from './initial-medical-record-form';
import InitialEmployeeRecordForm from '../employee/initial-employee-record-form';
import InitialRecordModal from '../initial-record-modal';
import { saveRecordFormDraft } from '../../record-form-draft-storage';
import { fetchAllCatalogs } from '@core/services/emr-service';
import { sendGraphQLRequest } from '../../../../utils/graphql-client';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('@core/services/emr-service', () => ({
  ...jest.requireActual('../../../../services/emr-service'),
  fetchAllCatalogs: jest.fn(async () => ({})),
}), { virtual: true });
jest.mock('../../../../packages-core-adapter', () => ({ axiosRequest: {} }));
jest.mock('../../../../utils/graphql-client', () => ({ sendGraphQLRequest: jest.fn() }));
jest.mock('@core/utils/data-transformer', () => ({}), { virtual: true });
jest.mock('@core/components/modals/validation-warning-modal', () => () => null, { virtual: true });
jest.mock('./personal-info', () => ({ data }) => <div data-testid="personal-info-name">{data.firstName}</div>);

it.each([
  ['student initial', InitialMedicalRecordForm, false],
  ['employee initial', InitialEmployeeRecordForm, false],
  ['student revision', InitialMedicalRecordForm, true],
  ['employee revision', InitialEmployeeRecordForm, true],
])('renders the shared header progress through the %s modal entry point', async (_, Form, isRevision) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement('div'));
  sendGraphQLRequest.mockResolvedValue({ getUpdateTicket: null });
  try {
    await act(async () => root.render(
      <InitialRecordModal isOpen isRevision={isRevision}>
        <Form isModal isRevision={isRevision} />
      </InitialRecordModal>
    ));
    const modal = document.querySelector('[role="dialog"]');
    expect(modal.querySelector('h1').textContent).toBe(isRevision ? 'Revise Your Medical Record' : 'Complete Your Medical Record');
    expect(modal.querySelectorAll('nav[aria-label="Record progress"]')).toHaveLength(1);
    expect(modal.querySelector('.record-form-header .record-progress-track')).not.toBeNull();
    expect(modal.querySelectorAll('.record-progress-track')).toHaveLength(5);
    const next = [...modal.querySelectorAll('button')].find(button => button.textContent.trim() === 'Next');
    await act(async () => next.click());
    expect(modal.querySelector('[aria-current="step"]').textContent).toContain('Medical History');
    expect(modal.querySelector('[role="tablist"]')).not.toBeNull();
  } finally {
    act(() => root.unmount());
    sessionStorage.clear();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

it('reopens a fresh Student form after rejection without starting another ticket', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement('div'));
  sendGraphQLRequest.mockResolvedValue({ getUpdateTicket: { id: '1', status: 'Rejected' } });
  try {
    await act(async () => root.render(<InitialMedicalRecordForm isModal isRevision={false} />));
    expect(fetchAllCatalogs).toHaveBeenCalled();
    const operations = sendGraphQLRequest.mock.calls.map(([query]) => query);
    expect(operations.filter(query => /\bmutation\b/.test(query))).toEqual([]);
  } finally {
    act(() => root.unmount());
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

it('restores a saved student draft after a page reload and asks for omitted uploads again', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem('patient_refreshToken', 'synthetic-student:device:token');
  saveRecordFormDraft('initial-student', {
    currentStep: 0,
    requiresPhotoReupload: true,
    formData: { personalInfo: { firstName: 'Synthetic patient' }, dentalHistory: { upperTeethPhoto: null, lowerTeethPhoto: null } },
  });
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => root.render(<InitialMedicalRecordForm isModal isRevision={false} />));
    expect(container.querySelector('[data-testid="personal-info-name"]').textContent).toBe('Synthetic patient');
    expect(container.textContent).toContain('Saved draft restored.');
    expect(container.textContent).toContain('upload your dental photos again');
  } finally {
    act(() => root.unmount());
    localStorage.clear();
    sessionStorage.clear();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
