import { axiosRequest } from '../../../../packages-core-adapter';
import { updateEmployeeProfile, updatePersonalInfo } from '../personal-info-service';

jest.mock('../../../../packages-core-adapter', () => ({ axiosRequest: { post: jest.fn() } }));

describe('updateEmployeeProfile', () => {
  beforeEach(() => axiosRequest.post.mockReset());

  it('submits employee profile fields through the Employee mutation', async () => {
    axiosRequest.post.mockResolvedValue({ data: { data: { createEmployeeProfile: { id: '7' } } } });
    await updateEmployeeProfile({
      employeeDepartment: 'Facilities',
      employeeRole: 'Non-Teaching',
      employeePosition: 'Consultant',
    });

    const [, request] = axiosRequest.post.mock.calls[0];
    expect(request.query).toContain('createEmployeeProfile');
    expect(request.variables.input).toEqual({
      department: 'Facilities', role: 'Non-Teaching', position: 'Consultant', employmentCategoryOther: null,
    });
  });

  it('preserves a custom Other employment category in the mutation input', async () => {
    axiosRequest.post.mockResolvedValue({ data: { data: { createEmployeeProfile: { id: '8' } } } });
    await updateEmployeeProfile({
      employeeDepartment: 'Facilities',
      employeeRole: 'Other',
      employeeCategoryOther: 'Research officer',
    });

    expect(axiosRequest.post.mock.calls[0][1].variables.input).toMatchObject({
      role: 'Other', employmentCategoryOther: 'Research officer',
    });
  });

  it('routes Employee personal updates through the employee profile mutation', async () => {
    axiosRequest.post
      .mockResolvedValueOnce({ data: { data: { createEmployeeProfile: { id: '9' } } } })
      .mockResolvedValueOnce({ data: { data: { createEmergencyContact: { id: '9' } } } });
    await updatePersonalInfo({
      profileType: 'Employee', employeeDepartment: 'Facilities', employeeRole: 'Non-Teaching', employeePosition: 'Consultant',
      emergencyContact1Name: 'QA Contact One', emergencyContact1Relationship: 'Parent', emergencyContact1Number: '09180000001',
      emergencyContact2Name: 'QA Contact Two', emergencyContact2Relationship: 'Sibling', emergencyContact2Number: '09180000002',
    });

    expect(axiosRequest.post.mock.calls[0][1].query).toContain('createEmployeeProfile');
    expect(axiosRequest.post.mock.calls[0][1].query).not.toContain('createStudentProfile');
    expect(axiosRequest.post.mock.calls[1][1].query).toContain('createEmergencyContact');
  });

  it('rejects an empty custom Other category before sending a request', async () => {
    await expect(updateEmployeeProfile({ employeeDepartment: 'Facilities', employeeRole: 'Other' }))
      .rejects.toThrow('Specify the employment category');
    expect(axiosRequest.post).not.toHaveBeenCalled();
  });
});
