import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import PendingRequests from '../PendingRequests';
import { getStatusUpdateTickets } from '../../modules/pending-requests/initial-record-service';
import { fetchPatientRecordForReview } from '../../modules/pending-requests/patient-record-service';

jest.mock('../../modules/pending-requests/components/requests.css', () => ({}));

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
  expect(filters()[0].value).toBe('all');
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
  await select(0, 'RevisionSubmitted');
  expect(getStatusUpdateTickets.mock.calls).toEqual([
    [['RevisionSubmitted'], 'Manila', 0, 20, {}],
    [['RevisionSubmitted'], 'Manila', 0, 20, {}],
  ]);
  expect(container.textContent).toContain('Ari Cruz');
  expect(container.textContent).toContain('No submissions found');
  expect(container.textContent).not.toContain('Sam Cruz');

  await clickButton('Initial records');
  expect(filters()[0].value).toBe('RevisionSubmitted');
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
  expect(container.textContent).toContain('Loading requests…');
  expect(container.textContent).not.toContain('No submissions found');
  expect(container.textContent).not.toContain('No update requests found');

  await act(async () => finishLoading([]));
  expect(container.textContent).toContain('No submissions found');
  expect(container.textContent).toContain('No update requests found');
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
  await clickButton('Review');
  expect(container.textContent).toContain('Review Full Record');
  expect(fetchPatientRecordForReview).not.toHaveBeenCalled();

  await clickButton('Review Full Record');
  expect(Array.from(container.querySelectorAll('h2'), (heading) => heading.textContent.trim()))
    .toContain('Record Review');
  expect(fetchPatientRecordForReview).toHaveBeenCalledTimes(1);
  expect(fetchPatientRecordForReview).toHaveBeenCalledWith(
    ticket.patientId, ticket.scope, ticket.sex, ticket.id,
  );
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
