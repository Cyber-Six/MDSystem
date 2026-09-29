import { axiosRequest } from '../../packages-core-adapter';
import { getAvailableMedicine, issuePrescription } from './prescription-service';

jest.mock('../../packages-core-adapter', () => ({ axiosRequest: { post: jest.fn() } }));

describe('health-chat prescription service', () => {
  beforeEach(() => jest.resetAllMocks());

  it('gets available medicine with default and supplied pagination', async () => {
    axiosRequest.post.mockResolvedValue({ data: { data: { getAvailableMedicine: [{ id: 'm1' }] } } });
    await expect(getAvailableMedicine()).resolves.toEqual([{ id: 'm1' }]);
    expect(axiosRequest.post).toHaveBeenCalledWith('/medical-inventory/prescription/medical', {
      query: expect.stringContaining('GetAvailableMedicine'),
      variables: { location: null, offset: 0, limit: 200 },
    });

    await getAvailableMedicine('Casal', 5, 10);
    expect(axiosRequest.post.mock.calls[1][1].variables).toEqual({ location: 'Casal', offset: 5, limit: 10 });
  });

  it('issues a prescription through the medical inventory endpoint', async () => {
    const prescription = { id: 'p1' };
    axiosRequest.post.mockResolvedValue({ data: { data: { issuePrescription: prescription } } });
    await expect(issuePrescription({ patientId: 'patient-1', quantity: 2 })).resolves.toBe(prescription);
    expect(axiosRequest.post).toHaveBeenCalledWith('/medical-inventory/prescription/medical', {
      query: expect.stringContaining('IssuePrescription'),
      variables: { input: { patientId: 'patient-1', quantity: 2 } },
    });
  });

  it('preserves GraphQL error details', async () => {
    const errors = [{ message: 'No stock' }];
    axiosRequest.post.mockResolvedValue({ data: { errors } });
    await expect(issuePrescription({})).rejects.toMatchObject({ message: 'No stock', graphQLErrors: errors });
  });
});
