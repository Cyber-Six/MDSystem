jest.mock('../../../config/query.js', () => ({ query: jest.fn(), isUserValidated: jest.fn(), setExpiredUpdateTickets: jest.fn() }));
jest.mock('../../../utils/graphql-helper.js', () => ({ throwGraphQLError: jest.fn(() => { const c = { message: jest.fn(), status: jest.fn(), throw: jest.fn() }; c.message.mockReturnValue(c); c.status.mockReturnValue(c); c.throw.mockImplementation(() => { throw new Error(`${c.status.mock.lastCall[0]}:${c.message.mock.lastCall[0]}`); }); return c; }) }));
jest.mock('../../../utils/logger.js', () => ({ debug: jest.fn(), error: jest.fn(), info: jest.fn() }));
jest.mock('dotenv', () => ({ config: jest.fn() }));

const db = require('../../../config/query.js');
const Query = require('./query.js');

beforeEach(() => jest.clearAllMocks());

test('gets the most recent update ticket and adds patient ID', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: 4, status: 'Pending', scope: 'Both' }] });
  await expect(Query._getUserUpdateTicket(null, { userId: 7 }, { user: { id: 7 }, res: {} })).resolves.toMatchObject({ id: 4, patientId: 7 });
  expect(db.query.mock.calls[0][1]).toEqual([7]);
});

test('rejects missing IDs and expires an old validated in-progress ticket', async () => {
  await expect(Query._getUserUpdateTicket(null, { userId: null }, { user: null, res: {} })).rejects.toThrow('401:Unauthorized');
  db.query.mockResolvedValueOnce({ rows: [{ id: 5, status: 'InProgress', created_at: new Date('2000-01-01') }] });
  db.isUserValidated.mockResolvedValueOnce(true);
  await expect(Query._getUserUpdateTicket(null, { userId: 7 }, { user: { id: 7 }, res: {} })).resolves.toMatchObject({ id: 5, patientId: 7, status: 'Expired' });
  expect(db.setExpiredUpdateTickets).toHaveBeenCalledWith(5);
});
