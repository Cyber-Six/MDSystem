import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import InitialMedicalRecordForm from './initial-medical-record-form';
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
jest.mock('./personal-info', () => () => null);

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
