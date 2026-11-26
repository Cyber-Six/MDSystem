import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { axiosRequest } from '../../../../packages-core-adapter';
import RecordUpdateForm from '../record-update-form';

jest.mock('../../../../packages-core-adapter', () => ({ axiosRequest: Object.assign(jest.fn(), { post: jest.fn() }) }));
jest.mock('@core/services/emr-service', () => ({ searchStudentProgram: jest.fn() }), { virtual: true });
jest.mock('../../../notification/notification-context', () => {
  const subscribe = () => () => {};
  return { usePatientNotifications: () => ({ subscribe }) };
});
jest.mock('../update-record-service', () => ({ getUpdateRevisionStatus: async () => null }));
jest.mock('../medical-history-step', () => () => null);
jest.mock('../dental-history-step', () => () => null);

describe('approved patient opening an update', () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
    axiosRequest.mockResolvedValue({ data: { data: { getPersonalRecord: { sex: 'Female' } } } });
  });

  afterEach(() => {
    act(() => root.unmount());
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  const clickButton = (label) => {
    const button = [...container.querySelectorAll('button')].find(el => el.textContent.includes(label));
    act(() => button.click());
  };

  const employee = {
    __typename: 'EmployeeProfile', department: 'Facilities', role: 'Other',
    position: 'Consultant', employmentCategoryOther: 'Research officer',
  };

  it.each([
    [employee, 'Employment Information'],
    [{ __typename: 'StudentProfile', program: 'BS Computer Science', year: 'Freshman' }, 'School Information'],
  ])('keeps %s when choosing and changing scope', async (profile, heading) => {
    axiosRequest.post.mockResolvedValueOnce({ data: { data: { getMyProfile: profile } } });

    await act(async () => root.render(<RecordUpdateForm />));
    clickButton('Both Update');
    expect(container.textContent).toContain(heading);
    clickButton('Cancel');
    clickButton('Medical Update');
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
    axiosRequest.post.mockReturnValueOnce(new Promise(resolve => { resolveProfile = resolve; }));
    await act(async () => root.render(<RecordUpdateForm />));
    clickButton('Dental Update');
    expect(container.textContent).not.toContain('School Information');
    expect(container.querySelector('[role="status"]').textContent).toContain('Loading your profile');
    await act(async () => resolveProfile({ data: { data: { getMyProfile: employee } } }));
    expect(container.textContent).toContain('Employment Information');
  });
});
