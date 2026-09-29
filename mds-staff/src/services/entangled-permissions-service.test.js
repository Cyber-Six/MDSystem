import { TokenStorage, axiosRequest } from '../packages-core-adapter';
import {
  deriveEntangledPermissionsFromModules,
  fetchEntangledPermissions,
  isEntangledPermissionAllowed,
  mergeEntangledPermissionMaps,
} from './entangled-permissions-service';

jest.mock('../packages-core-adapter', () => ({
  TokenStorage: { getAccessToken: jest.fn() },
  axiosRequest: { post: jest.fn() },
}));

const tokenFor = (payload) => `header.${btoa(JSON.stringify(payload))}.signature`;

describe('entangled permissions service', () => {
  beforeEach(() => jest.resetAllMocks());

  it('derives module permissions and lets server results override them', () => {
    const derived = deriveEntangledPermissionsFromModules({ patientSearch: true });
    expect(derived).toEqual({ SEARCH_PATIENT: { code: 'SEARCH_PATIENT', enabled: true, hardBlocked: false } });
    expect(mergeEntangledPermissionMaps(derived, {
      SEARCH_PATIENT: { code: 'SEARCH_PATIENT', enabled: false, hardBlocked: true },
    }).SEARCH_PATIENT).toEqual({ code: 'SEARCH_PATIENT', enabled: false, hardBlocked: true });
  });

  it.each([
    [null, false],
    [{ enabled: false }, false],
    [{ enabled: true, hardBlocked: true }, false],
    [{ enabled: true, hardBlocked: false }, true],
  ])('evaluates permission record %p as %p', (record, expected) => {
    expect(isEntangledPermissionAllowed(record)).toBe(expected);
  });

  it('does not request permissions for a non-admin or missing identity', async () => {
    TokenStorage.getAccessToken.mockReturnValue(null);
    await expect(fetchEntangledPermissions()).resolves.toEqual({});
    await expect(fetchEntangledPermissions({ isAdmin: true })).resolves.toEqual({});
    expect(axiosRequest.post).not.toHaveBeenCalled();
  });

  it('normalizes server permissions and caches them for the signed-in user', async () => {
    TokenStorage.getAccessToken.mockReturnValue(tokenFor({ id: 7 }));
    axiosRequest.post.mockResolvedValue({ data: { data: { getStaffPermissions: { permissions: [
      { code: ' SEARCH_PATIENT ', enabled: 1 }, { code: '', enabled: true }, null,
    ] } } } });

    const first = await fetchEntangledPermissions({ isAdmin: true, force: true });
    const second = await fetchEntangledPermissions({ isAdmin: true });
    expect(first).toEqual({ SEARCH_PATIENT: { code: 'SEARCH_PATIENT', enabled: true, hardBlocked: false } });
    expect(second).toBe(first);
    expect(axiosRequest.post).toHaveBeenCalledTimes(1);
    expect(axiosRequest.post).toHaveBeenCalledWith('/rolemanagement/admin', expect.objectContaining({
      variables: { userId: '7' },
    }));
  });

  it('returns an empty map for authorization failures', async () => {
    TokenStorage.getAccessToken.mockReturnValue(tokenFor({ id: 8 }));
    axiosRequest.post.mockResolvedValue({ data: { errors: [{ message: 'Forbidden' }] } });
    await expect(fetchEntangledPermissions({ isAdmin: true, force: true })).resolves.toEqual({});
  });

  it('propagates non-authorization request failures', async () => {
    TokenStorage.getAccessToken.mockReturnValue(tokenFor({ id: 9 }));
    axiosRequest.post.mockRejectedValue({ message: 'Network down' });
    await expect(fetchEntangledPermissions({ isAdmin: true, force: true })).rejects.toThrow('Network down');
  });
});
