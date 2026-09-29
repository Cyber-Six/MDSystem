jest.mock('../packages-core-adapter', () => ({ axiosRequest: { post: jest.fn() } }));
jest.mock('../utils/patient-year-level', () => ({
  formatStudentYearLevel: jest.fn(),
  getPatientYearLevelLabel: jest.fn(),
  getPatientProfileLabel: jest.fn(),
}));

import { axiosRequest } from '../packages-core-adapter';
import { getPatientProfileLabel } from '../utils/patient-year-level';
import { formatPatientName, getPatientInitials, getProfileLabel, searchPatients } from './patient-search-service';

describe('staff patient search service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('posts all search filters and returns patient results', async () => {
    axiosRequest.post.mockResolvedValue({ data: { data: { searchPatients: [{ id: 'p-1' }] } } });
    await expect(searchPatients('Jane', 5, 'Manila', ['Student'], true)).resolves.toEqual([{ id: 'p-1' }]);
    expect(axiosRequest.post).toHaveBeenCalledWith('/emr/medical', expect.objectContaining({
      variables: { searchTerm: 'Jane', limit: 5, branch: 'Manila', identities: ['Student'], includeLatestTicket: true },
    }));
  });

  test('returns empty results and reports GraphQL errors', async () => {
    axiosRequest.post.mockResolvedValueOnce({ data: { data: {} } });
    await expect(searchPatients('none')).resolves.toEqual([]);
    axiosRequest.post.mockResolvedValueOnce({ data: { errors: [{ message: 'Not allowed' }] } });
    await expect(searchPatients('none')).rejects.toThrow('Not allowed');
  });

  test('formats names, initials, and profile labels', () => {
    expect(formatPatientName({ last_name: 'Doe', first_name: 'Jane', middle_name: 'Quinn', suffix: 'Jr.' })).toBe('Doe, Jane Q. Jr.');
    expect(formatPatientName({ first_name: 'Jane' })).toBe('Jane');
    expect(formatPatientName({})).toBe('Unknown');
    expect(getPatientInitials({ first_name: 'Jane', last_name: 'Doe' })).toBe('JD');
    expect(getPatientInitials({})).toBe('?');
    getPatientProfileLabel.mockReturnValue('BSIT · Freshman');
    expect(getProfileLabel({ program: 'BSIT' })).toBe('BSIT · Freshman');
  });
});
