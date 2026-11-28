import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import InitialMedicalRecordForm from './initial-medical-record-form';
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
