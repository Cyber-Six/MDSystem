import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import PendingRequests from '../PendingRequests';
import { getStatusUpdateTickets } from '../../modules/pending-requests/initial-record-service';
import { fetchPatientRecordForReview } from '../../modules/pending-requests/patient-record-service';

jest.mock('../../modules/pending-requests/components/requests.css', () => ({}));
jest.mock('../../modules/pending-requests/components/review-sections/record-review.css', () => ({}));

jest.mock('../../context/permissions-context', () => ({
  usePermissions: () => ({ branch: 'Manila', allowedBranches: () => ['Manila'] }),
}));

jest.mock('../../modules/notification/notification-context', () => {
  const subscribe = () => () => {};
  return { useStaffNotifications: () => ({ subscribe }) };
});

jest.mock('../../packages-core-adapter', () => ({
  axiosRequest: {
    post: jest.fn().mockResolvedValue({ data: { data: { u_101: 'Unverified' } } }),
  },
}));

jest.mock('../../modules/pending-requests/initial-record-service', () => ({
  ...jest.requireActual('../../modules/pending-requests/initial-record-service'),
  getStatusUpdateTickets: jest.fn(),
}));

jest.mock('../../modules/pending-requests/patient-record-service', () => ({
  fetchPatientRecordForReview: jest.fn(),
  submitStaffEdits: jest.fn(),
}));

const initialTicket = {
  id: '11', patientId: '101', first_name: 'Alex', last_name: 'Rivera',
  scope: 'Both', branch: 'Manila', status: 'Pending', sex: 'Male',
};
const updateTicket = {
  id: '22', patientId: '202', first_name: 'Sam', last_name: 'Cruz',
  scope: 'Medical', branch: 'Manila', status: 'Pending', sex: 'Male',
};

let container;
let root;
let previousActEnvironment;

beforeEach(() => {
  previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  getStatusUpdateTickets.mockReset();
  fetchPatientRecordForReview.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

const render = () => act(async () => root.render(<PendingRequests />));
const filters = () => container.querySelectorAll('select');

async function select(index, value) {
  const filter = filters()[index];
  await act(async () => {
    filter.value = value;
    filter.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function clickButton(label) {
  const button = Array.from(container.querySelectorAll('button'))
    .find((candidate) => candidate.textContent.trim() === label);
  expect(button).toBeDefined();
  await act(async () => button.click());
}

test('filters by record type and applies the shared status to both lists', async () => {
  const tickets = [initialTicket, updateTicket, {
    ...updateTicket, id: '33', patientId: '303', first_name: 'Ari', status: 'RevisionSubmitted',
  }];
  getStatusUpdateTickets.mockImplementation(async (statuses) =>
    tickets.filter((ticket) => statuses.includes(ticket.status)));

  await render();
  expect(container.querySelector('button[aria-pressed="true"]').textContent).toBe('Initial records');
  expect(container.querySelector('summary').getAttribute('aria-label')).toBe('Statuses: Pending, Revision submitted');
  expect(container.textContent).toContain('Alex Rivera');
  expect(container.textContent).not.toContain('Sam Cruz');

  await clickButton('Record updates');
  expect(container.textContent).toContain('Sam Cruz');
  expect(container.textContent).not.toContain('Alex Rivera');

  await clickButton('All requests');
  expect(container.textContent).toContain('Alex Rivera');
  expect(container.textContent).toContain('Sam Cruz');
  expect(container.textContent).toContain('Ari Cruz');

  getStatusUpdateTickets.mockClear();
  await act(async () => {
    const details = container.querySelector('details');
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
  });
  const pendingCheckbox = Array.from(container.querySelectorAll('.request-status-option'))
    .find((option) => option.textContent.trim() === 'Pending').querySelector('input');
  await act(async () => pendingCheckbox.click());
  expect(getStatusUpdateTickets.mock.calls).toEqual([
    [['RevisionSubmitted'], 'Manila', 0, 20, {}],
  ]);
  expect(container.textContent).toContain('Ari Cruz');
  expect(container.textContent).not.toContain('Sam Cruz');

  await clickButton('Initial records');
  expect(container.querySelector('summary').getAttribute('aria-label')).toBe('Statuses: Revision submitted');
  expect(container.textContent).not.toContain('Ari Cruz');
});

test('shows each list loading and then its own empty state', async () => {
  let finishLoading;
  const pending = new Promise((resolve) => { finishLoading = resolve; });
  getStatusUpdateTickets.mockReturnValue(pending);

  await render();
  expect(container.textContent).toContain('Loading submissions…');
  await clickButton('All requests');
  expect(container.textContent).toContain('Loading submissions…');
  expect(container.textContent).not.toContain('No submissions found');
  expect(container.textContent).not.toContain('No update requests found');

  await act(async () => finishLoading([]));
  expect(container.textContent).toContain('No submissions found');
  expect(container.textContent).not.toContain('Loading submissions…');
  expect(container.textContent).not.toContain('Loading requests…');
});

test.each([
  ['Initial Record', initialTicket],
  ['Record Update', updateTicket],
])('opens the full review for a ticket from %s', async (type, ticket) => {
  getStatusUpdateTickets.mockResolvedValue([initialTicket, updateTicket]);
  fetchPatientRecordForReview.mockReturnValue(new Promise(() => {}));

  await render();
  await clickButton(type === 'Initial Record' ? 'Initial records' : 'Record updates');
  await act(async () => container.querySelector(`tr[aria-label^="Review ticket #${ticket.id}"]`).click());
  expect(Array.from(container.querySelectorAll('h2'), (heading) => heading.textContent.trim()))
    .toContain(type === 'Initial Record' ? 'Initial Record Submission' : 'Record Update');
  expect(fetchPatientRecordForReview).toHaveBeenCalledTimes(1);
  expect(fetchPatientRecordForReview).toHaveBeenCalledWith(
    ticket.patientId, ticket.scope, ticket.sex, ticket.id, type === 'Initial Record',
  );
});

test.each(['Medical', 'Both'])('a %s update review shows medical background groups even when entries are missing', async (scope) => {
  const ticket = { ...updateTicket, scope };
  getStatusUpdateTickets.mockResolvedValue([initialTicket, ticket]);
  fetchPatientRecordForReview.mockResolvedValue({
    basicInfo: { sex: 'Male' },
    medicalHistory: { conditions: [] },
    lifestyle: { smoker: false },
    catalogs: {},
  });
  await render();
  await clickButton('Record updates');
  await act(async () => container.querySelector(`tr[aria-label^="Review ticket #${ticket.id}"]`).click());
  const review = container.querySelector('[aria-label="Record Review"]');
  expect(Array.from(review.querySelectorAll('h3'), (heading) => heading.textContent)).toEqual(['Medical Background']);
  expect(Array.from(review.querySelectorAll('h4'), (heading) => heading.textContent)).toEqual([
    'Immunizations', 'Allergies', 'Hospitalizations', 'Surgery and Operations', 'Medications', 'Daily Habits and Vision',
  ]);
  expect(review.textContent).toContain('No immunizations recorded for this ticket.');
  expect(review.textContent).toContain('No hospitalizations recorded for this ticket.');
  expect(review.querySelector('dt').textContent).toBe('Smoker');
  expect(review.querySelector('dd').textContent).toBe('No');
  expect(fetchPatientRecordForReview).toHaveBeenCalledWith(
    ticket.patientId, scope, ticket.sex, ticket.id, false,
  );
});

test('a Dental update review excludes medical background groups', async () => {
  const ticket = { ...updateTicket, scope: 'Dental' };
  getStatusUpdateTickets.mockResolvedValue([initialTicket, ticket]);
  fetchPatientRecordForReview.mockResolvedValue({
    basicInfo: { present_address: 'Unrelated account address' },
    profile: { __typename: 'StudentProfile', program: 'Submitted program' },
    emergencyContact: { firstContact: { contactName: 'Submitted contact' } },
    lifestyle: { smoker: false },
    dentalHistory: { seenByDentist: true },
    catalogs: {},
  });
  await render();
  await clickButton('Record updates');
  await act(async () => container.querySelector(`tr[aria-label^="Review ticket #${ticket.id}"]`).click());
  const review = container.querySelector('[aria-label="Record Review"]');
  expect(Array.from(review.querySelectorAll('h3'), (heading) => heading.textContent))
    .toEqual(['School Information', 'Emergency Contacts', 'Dental History']);
  expect(review.textContent).toContain('Submitted program');
  expect(review.textContent).toContain('Submitted contact');
  expect(review.textContent).not.toContain('Unrelated account address');
});

async function search(value) {
  const input = container.querySelector('input[type="search"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

test('searches both loaded lists by patient name or ticket ID without fetching again', async () => {
  getStatusUpdateTickets.mockResolvedValue([initialTicket, updateTicket]);
  await render();
  await clickButton('All requests');
  getStatusUpdateTickets.mockClear();
  await search('  RIVERA  ');
  expect(container.textContent).toContain('Alex Rivera');
  expect(container.textContent).not.toContain('Sam Cruz');
  await search('#22');
  expect(container.textContent).toContain('Sam Cruz');
  expect(container.textContent).not.toContain('Alex Rivera');
  expect(getStatusUpdateTickets).not.toHaveBeenCalled();
  await search('unknown patient');
  expect(container.querySelectorAll('.request-feedback h3')).toHaveLength(1);
  expect(container.textContent).toContain('No matching requests');
  await clickButton('Clear filters');
  expect(container.textContent).toContain('Alex Rivera');
  expect(container.textContent).toContain('Sam Cruz');
});

test('reports a load failure without a misleading empty state and supports retry', async () => {
  getStatusUpdateTickets.mockRejectedValueOnce(new Error('Service unavailable'));
  await render();
  expect(container.querySelector('[role="alert"]').textContent).toContain('Service unavailable');
  expect(container.textContent).not.toContain('No submissions found');
  getStatusUpdateTickets.mockResolvedValueOnce([initialTicket]);
  await clickButton('Try again');
  expect(getStatusUpdateTickets).toHaveBeenLastCalledWith(expect.any(Array), 'Manila', 0, 20, { force: true });
  expect(container.textContent).toContain('Alex Rivera');
  expect(container.querySelector('[role="alert"]')).toBeNull();
});
