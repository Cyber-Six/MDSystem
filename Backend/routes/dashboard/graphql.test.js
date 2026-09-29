const mockRouter = { use: jest.fn(), post: jest.fn() };
jest.mock('express', () => ({ Router: () => mockRouter }));
jest.mock('express-graphql', () => ({ graphqlHTTP: jest.fn(options => ({ graphql: true, options })) }));
jest.mock('@graphql-tools/schema', () => ({ makeExecutableSchema: jest.fn(options => options) }));
jest.mock('fs', () => ({ readFileSync: jest.fn(() => 'type Query { dashboard: String }') }));
jest.mock('../../config/query.js', () => ({ query: jest.fn() }));
jest.mock('../../config/middleware/ratelimiter.js', () => ({ ipRateLimiter: jest.fn(() => 'limiter') }));
jest.mock('../../config/middleware/jwtProtect.js', () => ({ jwtProtect: jest.fn(role => `jwt:${role}`) }));
jest.mock('../../utils/logger.js', () => ({ error: jest.fn() }));
jest.mock('./resolvers/dashboard-resolver.js', () => ({ Query: { getPatientDashboardData: jest.fn() } }));
const api = require('./graphql'); const db = require('../../config/query.js'); const resolver = require('./resolvers/dashboard-resolver.js'); const { graphqlHTTP } = require('express-graphql');
const response = () => ({ statusCode: 200, status: jest.fn(function(code){ this.statusCode = code; return this; }), json: jest.fn(function(data){ this.body = data; return this; }) });
beforeEach(() => { jest.clearAllMocks(); mockRouter.use.mockClear(); mockRouter.post.mockClear(); });

test('registers staff and patient endpoints with their guards and validates GraphQL body', () => {
  const app = { use: jest.fn() };
  api.initDashboardGraphQL(app); api.initPatientDashboardGraphQL(app);
  expect(app.use).toHaveBeenCalledWith('/dashboard', 'limiter', 'jwt:medical', expect.objectContaining({ graphql: true }));
  expect(app.use).toHaveBeenCalledWith('/dashboard/patient', mockRouter);
  expect(mockRouter.use).toHaveBeenCalledWith('limiter', 'jwt:patient');
  const staffOptions = graphqlHTTP.mock.calls[0][0];
  expect(staffOptions({ body: { query: 'query{}' }, user: { id: 1 }, res: 'response' }).context).toEqual({ user: { id: 1 }, res: 'response' });
  expect(staffOptions({ body: { query: 'query{}' }, res: 'response' }).context).toEqual({ user: null, res: 'response' });
  expect(() => staffOptions({ body: {} })).toThrow('Empty GraphQL request');
  const patientOptions = graphqlHTTP.mock.calls[1][0];
  expect(() => patientOptions({})).toThrow('Empty GraphQL request');
  expect(patientOptions({ body: { query: '{ dashboard }' }, user: null, res: 'patient-res' })).toMatchObject({ schema: expect.any(Object), context: { user: null, res: 'patient-res' } });
});

test('passes GraphQL requests through and assembles REST data with active counts and compatibility fields', async () => {
  api.initPatientDashboardGraphQL({ use: jest.fn() });
  const post = mockRouter.post.mock.calls[0][1]; const next = jest.fn();
  await post({ body: { query: ' { dashboard } ' } }, response(), next);
  expect(next).toHaveBeenCalled();
  resolver.Query.getPatientDashboardData.mockResolvedValue({ appointment: { status: 'Pending' }, medicineReqs: [{ status: 'Pending' }, { status: 'Rejected' }], updateTicket: { status: 'Revision' }, chatData: { chats: [{ status: 'Open' }], total: 4 } });
  db.query.mockResolvedValueOnce({ rows: [{ credentials_status: 'Verified' }] }).mockResolvedValueOnce({ rows: [{ id: 'd1', templateType: 'medical-certificate' }] }).mockResolvedValueOnce({ rows: [{ total: 5 }] }).mockResolvedValueOnce({ rows: [{ total: 2 }] });
  const res = response();
  await post({ body: {}, user: { id: 8 } }, res, next);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.body).toMatchObject({ success: true, pending: { total: 5, appointments: 1, medRequests: 1, healthChats: 1, documents: 2 }, documents: { total: 5 }, patientStatus: { credentials: 'Verified', hasPendingUpdate: true }, appointment: { status: 'Pending' }, chatData: { total: 4 } });
  expect(db.query).toHaveBeenCalledTimes(4);
});

test('handles empty data, malformed subobjects, and REST database failures', async () => {
  api.initPatientDashboardGraphQL({ use: jest.fn() }); const post = mockRouter.post.mock.calls.at(-1)[1];
  resolver.Query.getPatientDashboardData.mockResolvedValue({ appointment: null, medicineReqs: [], updateTicket: null, chatData: null });
  db.query.mockResolvedValue({ rows: [] });
  const res = response(); await post({ body: {}, user: { id: 8 } }, res, jest.fn());
  expect(res.body).toMatchObject({ pending: { total: 0 }, healthChats: { total: 0 }, patientStatus: { credentials: 'Unknown', hasPendingUpdate: false } });
  resolver.Query.getPatientDashboardData.mockRejectedValue(new Error('resolver unavailable'));
  const failed = response(); await post({ body: {}, user: { id: 8 } }, failed, jest.fn());
  expect(failed.status).toHaveBeenCalledWith(500);
  expect(failed.body).toMatchObject({ success: false, error: 'DASHBOARD_FETCH_FAILED', message: 'resolver unavailable' });
});

test('uses REST fallbacks when optional user and query fields are absent', async () => {
  api.initPatientDashboardGraphQL({ use: jest.fn() });
  const post = mockRouter.post.mock.calls.at(-1)[1];
  const noUserResponse = response();
  noUserResponse.statusCode = 400;
  resolver.Query.getPatientDashboardData.mockRejectedValue({});
  await post({ body: {}, headers: {} }, noUserResponse, jest.fn());
  expect(noUserResponse.body).toMatchObject({ success: false, message: 'Failed to fetch patient dashboard data.' });
  expect(noUserResponse.status).toHaveBeenCalledWith(400);

  resolver.Query.getPatientDashboardData.mockResolvedValue({});
  db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
  const noRows = response();
  await post({ body: {}, user: { id: 9 } }, noRows, jest.fn());
  expect(noRows.body).toMatchObject({ success: true, documents: { total: 0, recent: [] } });
});

test('builds REST dashboard payloads for defaults, inactive records, and invalid aggregates', () => {
  expect(api.buildPatientDashboardRestPayload()).toMatchObject({
    pending: { total: 0 }, appointments: { latest: null, total: 0 },
    healthChats: { total: 0 }, documents: { total: 0, recent: [] },
    patientStatus: { credentials: 'Unknown', hasPendingUpdate: false },
  });
  const inactive = api.buildPatientDashboardRestPayload({
    appointment: { status: 'Cancelled' }, medicineReqs: 'not-an-array',
    updateTicket: { status: 'Completed' }, chatData: { chats: 'not-an-array', total: 'unknown' },
  }, { pendingDocuments: 'bad', documents: 'bad', documentsTotal: 0 });
  expect(inactive).toMatchObject({
    pending: { total: 0 }, medRequests: { total: 0 }, healthChats: { items: [], total: 0 },
    documents: { total: 0, recent: [] }, patientStatus: { credentials: 'Unknown', hasPendingUpdate: false },
  });
  const active = api.buildPatientDashboardRestPayload({
    appointment: { status: 'Scheduled' }, medicineReqs: [{ status: 'RevisionSubmitted' }],
    updateTicket: { status: 'Revision' }, chatData: { chats: [{ status: 'Ongoing' }], total: '3' },
  }, { pendingDocuments: 2, documents: [{ id: 'd' }], documentsTotal: 4, credentialsStatus: 'Active' });
  expect(active).toMatchObject({ pending: { total: 5 }, healthChats: { total: 3 }, documents: { total: 4 }, patientStatus: { credentials: 'Active', hasPendingUpdate: true } });
});
