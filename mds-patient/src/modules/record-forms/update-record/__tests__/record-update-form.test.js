import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { axiosRequest } from '../../../../packages-core-adapter';
import RecordUpdateForm from '../record-update-form';
import { fetchUpdateRevisionPrefill, fetchUpdateRecordPrefill, getUpdateRevisionStatus, getUpdateTicketStatus } from '../update-record-service';
import { saveRecordFormDraft } from '../../record-form-draft-storage';

jest.mock('../../../../packages-core-adapter', () => ({ axiosRequest: Object.assign(jest.fn(), { post: jest.fn() }) }));
jest.mock('@core/services/emr-service', () => ({ searchStudentProgram: jest.fn() }), { virtual: true });
jest.mock('../../../notification/notification-context', () => {
  const subscribe = () => () => {};
  return { usePatientNotifications: () => ({ subscribe }) };
});
jest.mock('../update-record-service', () => ({
  getUpdateRevisionStatus: jest.fn().mockResolvedValue(null),
  getUpdateTicketStatus: jest.fn().mockResolvedValue(null),
  fetchUpdateRevisionPrefill: jest.fn(),
  fetchUpdateRecordPrefill: jest.fn(),
}));
jest.mock('../medical-history-step', () => () => null);
jest.mock('../dental-history-step', () => () => null);

describe('approved patient opening an update', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
    fetchUpdateRecordPrefill.mockReset().mockResolvedValue({ profileType: 'Employee', employeeDepartment: 'Facilities', employeeRole: 'Other', employeePosition: 'Consultant', employeeCategoryOther: 'Research officer' });
    getUpdateTicketStatus.mockReset().mockResolvedValue(null);
    axiosRequest.mockResolvedValue({ data: { data: { getPersonalRecord: { sex: 'Female' } } } });
  });

  afterEach(() => {
    act(() => root.unmount());
    localStorage.removeItem('patient_refreshToken');
    sessionStorage.clear();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  const clickButton = async (label) => {
    const button = [...container.querySelectorAll('button')].find(el => el.textContent.includes(label));
    await act(async () => button.click());
  };

  const employee = {
    __typename: 'EmployeeProfile', department: 'Facilities', role: 'Other',
    position: 'Consultant', employmentCategoryOther: 'Research officer',
  };

  it.each(['Pending', 'Revision', 'InProgress'])('shows the %s ticket and blocks new choices', async status => {
    getUpdateTicketStatus.mockResolvedValue({ id: '42', status, scope: 'Dental' });
    await act(async () => root.render(<RecordUpdateForm />));
    expect(container.textContent).toContain('Your dental update is');
    expect(container.querySelectorAll('button')).toBeTruthy();
    expect([...container.querySelectorAll('button')].some(button => button.textContent.includes('Medical Update'))).toBe(false);
    expect(fetchUpdateRecordPrefill).not.toHaveBeenCalled();
  });

  it('keeps choices unavailable when the ticket status cannot be checked', async () => {
    getUpdateTicketStatus.mockRejectedValue(new Error('Synthetic status failure'));
    await act(async () => root.render(<RecordUpdateForm />));
    expect(container.textContent).toContain('could not check your update request status');
    expect([...container.querySelectorAll('button')].some(button => button.textContent.includes('Medical Update'))).toBe(false);
  });

  it('allows a new choice after the previous ticket is approved', async () => {
    getUpdateTicketStatus.mockResolvedValue({ id: '41', status: 'Approved', scope: 'Medical' });
    await act(async () => root.render(<RecordUpdateForm />));
    await clickButton('Dental Update');
    expect(fetchUpdateRecordPrefill).toHaveBeenCalledWith('dental');
  });

  it('requests only the chosen scope and clears the form after another account signs in', async () => {
    localStorage.setItem('patient_refreshToken', 'patient-a:device:token');
    fetchUpdateRecordPrefill.mockResolvedValue({ profileType: 'Employee', employeeDepartment: 'Stored department', emergencyContact1Name: 'Stored private contact' });
    await act(async () => root.render(<RecordUpdateForm />));
    expect(fetchUpdateRecordPrefill).not.toHaveBeenCalled();
    await clickButton('Dental Update');
    expect(fetchUpdateRecordPrefill).toHaveBeenCalledTimes(1);
    expect(fetchUpdateRecordPrefill).toHaveBeenCalledWith('dental');
    expect(container.querySelector('[placeholder="Contact Name"]').value).toBe('Stored private contact');
    localStorage.setItem('patient_refreshToken', 'patient-b:device:token');
    await act(async () => window.dispatchEvent(new StorageEvent('storage', { key: 'patient_refreshToken' })));
    expect(container.querySelector('[role="alert"]').textContent).toContain('Your sign-in changed');
    expect(container.querySelector('[placeholder="Contact Name"]')).toBeNull();
    expect(sessionStorage.getItem('mds:patient-record-draft:v2:patient-b:record-update')).toBeNull();
  });

  it.each(['Student', 'Employee'].flatMap(profileType => ['medical', 'dental', 'both'].map(scope => [profileType, scope])))('prefills %s personal fields for %s scope', async (profileType, scope) => {
    fetchUpdateRecordPrefill.mockResolvedValue({
      profileType, programId: '4', program: 'Synthetic program', schoolYear: 'Junior',
      employeeDepartment: 'Science', employeeRole: 'Teaching', employeePosition: 'Faculty',
      emergencyContact1Name: 'Stored primary', emergencyContact1Number: '09170000000',
      emergencyContact2Name: 'Stored secondary', emergencyContact2Address: 'Synthetic address',
    });
    await act(async () => root.render(<RecordUpdateForm forceRecordType={scope} />));
    expect(fetchUpdateRecordPrefill).toHaveBeenCalledWith(scope);
    expect(container.querySelector('[placeholder="Contact Name"]').value).toBe('Stored primary');
    expect(container.querySelector('[placeholder="Contact\'s home address"]').value).toBe('');
    if (profileType === 'Student') {
      expect(container.querySelector('[placeholder="Type to search for your program..."]').value).toBe('Synthetic program');
      expect([...container.querySelectorAll('select')].some(select => select.value === 'Junior')).toBe(true);
    } else {
      expect(container.querySelector('[placeholder="Enter position"]').value).toBe('Faculty');
    }
  });

  it('blocks navigation after a failed load and supports retry', async () => {
    fetchUpdateRecordPrefill.mockRejectedValueOnce(new Error('Synthetic failure'));
    await act(async () => root.render(<RecordUpdateForm forceRecordType="both" />));
    expect(container.querySelector('[role="alert"]').textContent).toContain('could not be loaded');
    expect([...container.querySelectorAll('button')].find(button => button.textContent.includes('Next')).disabled).toBe(true);
    await clickButton('Try again');
    expect(container.textContent).toContain('Employment Information');
  });

  it('ignores a late response after the selected scope changes', async () => {
    let resolveMedical;
    fetchUpdateRecordPrefill.mockImplementation(scope => scope === 'medical'
      ? new Promise(resolve => { resolveMedical = resolve; })
      : Promise.resolve({ profileType: 'Student', program: 'Dental scope program', programId: '4' }));
    await act(async () => root.render(<RecordUpdateForm forceRecordType="medical" />));
    await act(async () => root.render(<RecordUpdateForm forceRecordType="dental" />));
    await act(async () => resolveMedical({ profileType: 'Employee', employeeDepartment: 'Old response' }));
    expect(container.textContent).toContain('School Information');
    expect(container.textContent).not.toContain('Employment Information');
  });

  it.each([
    [employee, 'Employment Information'],
    [{ __typename: 'StudentProfile', program: 'BS Computer Science', year: 'Freshman' }, 'School Information'],
  ])('keeps %s when choosing and changing scope', async (profile, heading) => {
    fetchUpdateRecordPrefill.mockResolvedValue(profile.__typename === 'EmployeeProfile' ? {
      profileType: 'Employee', employeeDepartment: profile.department, employeeRole: 'Other', employeePosition: profile.position, employeeCategoryOther: profile.employmentCategoryOther,
    } : { profileType: 'Student', program: profile.program, programId: '4', schoolYear: profile.year });

    await act(async () => root.render(<RecordUpdateForm />));
    await clickButton('Both Update');
    expect(container.textContent).toContain(heading);
    expect(container.querySelectorAll('.record-form-header nav[aria-label="Record progress"]')).toHaveLength(1);
    expect(container.querySelectorAll('.record-progress-track')).toHaveLength(4);
    await clickButton('Cancel');
    await clickButton('Medical Update');
    expect(container.textContent).toContain(heading);
    if (profile.__typename === 'EmployeeProfile') {
      expect(container.querySelector('[placeholder="Enter position"]').value).toBe('Consultant');
      expect(container.querySelector('[placeholder="Enter your employment category"]').value).toBe('Research officer');
    } else {
      const label = [...container.querySelectorAll('label')].find(el => el.textContent.startsWith('Student Category'));
      const category = label.control;
      expect(category.tagName).toBe('SELECT');
      expect(category.disabled).toBe(false);
      act(() => {
        category.value = 'Sophomore';
        category.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(category.value).toBe('Sophomore');
    }
  });

  it('waits for a delayed profile before offering category-specific fields', async () => {
    let resolveProfile;
    fetchUpdateRecordPrefill.mockReturnValue(new Promise(resolve => { resolveProfile = resolve; }));
    await act(async () => root.render(<RecordUpdateForm />));
    await clickButton('Dental Update');
    expect(container.textContent).not.toContain('School Information');
    expect(container.querySelector('[role="status"]').textContent).toContain('Loading your saved records');
    await act(async () => resolveProfile({ profileType: 'Employee', employeeDepartment: 'Facilities' }));
    expect(container.textContent).toContain('Employment Information');
  });

  it('waits for the update draft before starting a revision', async () => {
    const notes = 'Please update your emergency contact.';
    let resolvePrefill;
    getUpdateRevisionStatus.mockResolvedValueOnce({ id: '12', status: 'Revision', scope: 'Both', notes });
    fetchUpdateRevisionPrefill.mockReturnValueOnce(new Promise(resolve => { resolvePrefill = resolve; }));
    axiosRequest.post.mockResolvedValueOnce({ data: { data: { getMyProfile: employee } } });

    await act(async () => root.render(<RecordUpdateForm />));
    const start = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Start Revision'));
    expect(container.textContent).toContain(notes);
    expect(start.disabled).toBe(true);
    await act(async () => resolvePrefill({ emergencyContact1Name: 'Saved Contact' }));
    expect(start.disabled).toBe(false);
    await act(async () => start.click());
    expect(container.querySelector('[placeholder="Contact Name"]').value).toBe('Saved Contact');
  });

  it('restores an update draft and its selected record scope', async () => {
    localStorage.setItem('patient_refreshToken', 'synthetic-user:device:token');
    saveRecordFormDraft('record-update', {
      currentStep: 0,
      recordType: 'medical',
      formData: { emergencyContact1Name: 'Synthetic saved contact' },
    });
    axiosRequest.post.mockResolvedValueOnce({ data: { data: { getMyProfile: employee } } });

    await act(async () => root.render(<RecordUpdateForm />));
    expect(container.textContent).toContain('Saved draft restored.');
    expect(container.textContent).toContain('Update Medical Record');
    expect(container.querySelector('[placeholder="Contact Name"]').value).toBe('Synthetic saved contact');
  });

  it('restores a revision draft without replacing it with the older prefill', async () => {
    localStorage.setItem('patient_refreshToken', 'synthetic-user:device:token');
    getUpdateRevisionStatus.mockResolvedValueOnce({ id: '12', status: 'Revision', scope: 'Medical', notes: 'Please update your contact.' });
    fetchUpdateRevisionPrefill.mockResolvedValueOnce({ emergencyContact1Name: 'Old server contact' });
    saveRecordFormDraft('record-update-revision', {
      currentStep: 0,
      recordType: 'medical',
      formData: { emergencyContact1Name: 'Synthetic revised contact' },
    });
    axiosRequest.post.mockResolvedValueOnce({ data: { data: { getMyProfile: employee } } });

    await act(async () => root.render(<RecordUpdateForm />));
    const start = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Start Revision'));
    act(() => start.click());
    expect(container.querySelector('[placeholder="Contact Name"]').value).toBe('Synthetic revised contact');
    expect(container.textContent).toContain('Saved draft restored.');
  });
});
