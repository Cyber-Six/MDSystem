const express = require('express');
const request = require('supertest');

const mockDbQuery = jest.fn();
const mockGetUserUpdateTicket = jest.fn();
const mockAutoExpireTickets = jest.fn();

jest.mock('../../../config/query.js', () => ({
  query: (...args) => mockDbQuery(...args),
}));

jest.mock('../../../config/middleware/ratelimiter.js', () => ({
  ipRateLimiter: () => (_req, _res, next) => next(),
}));

jest.mock('../../../config/middleware/jwtProtect.js', () => ({
  jwtProtect: () => (req, _res, next) => {
    req.user = { id: 101 };
    next();
  },
}));

jest.mock('../../../services/permit.js', () => ({
  isMedicalPermitted: jest.fn(async () => ({ permitted: true })),
}));

jest.mock('../../emr/wrapper/query.js', () => ({
  _getUserUpdateTicket: (...args) => mockGetUserUpdateTicket(...args),
}));

jest.mock('../../health-chat/resolvers/wrapper/helper.js', () => ({
  autoExpireTickets: (...args) => mockAutoExpireTickets(...args),
}));

jest.mock('../../../utils/logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { initPatientDashboardGraphQL } = require('../graphql.js');

describe('Patient dashboard GraphQL endpoint', () => {
  let app;

  beforeEach(() => {
    mockDbQuery.mockReset();
    mockGetUserUpdateTicket.mockReset();
    mockAutoExpireTickets.mockReset();

    app = express();
    app.use(express.json());
    initPatientDashboardGraphQL(app);
  });

  test('POST /dashboard/patient returns patient dashboard payload', async () => {
    mockDbQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: '2001',
            status: 'Scheduled',
            session: 'Morning',
            purpose: 'General checkup',
            schedulerLabel: 'Medical',
            scheduledDate: '2026-04-20',
            created_at: '2026-04-19T07:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '3001',
            status: 'Pending',
            purpose: 'Pain relief',
            created_at: '2026-04-19T07:10:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '9001',
            status: 'Open',
            purpose: 'Follow-up concern',
            session_start: '2026-04-19T07:20:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });

    mockGetUserUpdateTicket.mockResolvedValueOnce({
      id: '4001',
      status: 'Pending',
      scope: 'Medical',
      notes: 'Update pending review',
      created_at: '2026-04-19T07:30:00.000Z',
    });

    mockAutoExpireTickets.mockResolvedValueOnce();

    const response = await request(app)
      .post('/dashboard/patient')
      .send({
        query: `
          query GetPatientDashboardData {
            getPatientDashboardData {
              appointment {
                id
                status
                session
                purpose
                schedulerLabel
                scheduledDate
                created_at
              }
              medicineReqs {
                id
                status
                purpose
                created_at
              }
              updateTicket {
                id
                status
                scope
                notes
                created_at
              }
              chatData {
                total
                chats {
                  id
                  status
                  purpose
                  session_start
                }
              }
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();

    const payload = response.body.data?.getPatientDashboardData;
    expect(payload).toBeTruthy();

    expect(payload).toEqual({
      appointment: {
        id: '2001',
        status: 'Scheduled',
        session: 'Morning',
        purpose: 'General checkup',
        schedulerLabel: 'Medical',
        scheduledDate: '2026-04-20',
        created_at: '2026-04-19T07:00:00.000Z',
      },
      medicineReqs: [
        {
          id: '3001',
          status: 'Pending',
          purpose: 'Pain relief',
          created_at: '2026-04-19T07:10:00.000Z',
        },
      ],
      updateTicket: {
        id: '4001',
        status: 'Pending',
        scope: 'Medical',
        notes: 'Update pending review',
        created_at: '2026-04-19T07:30:00.000Z',
      },
      chatData: {
        total: 1,
        chats: [
          {
            id: '9001',
            status: 'Open',
            purpose: 'Follow-up concern',
            session_start: '2026-04-19T07:20:00.000Z',
          },
        ],
      },
    });

    expect(mockDbQuery).toHaveBeenCalledTimes(4);
    expect(mockGetUserUpdateTicket).toHaveBeenCalledTimes(1);
    expect(mockAutoExpireTickets).toHaveBeenCalledWith(101);
  });

  test('POST /dashboard/patient without GraphQL query returns JSON summary payload', async () => {
    mockDbQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: '2001',
            status: 'Scheduled',
            session: 'Morning',
            purpose: 'General checkup',
            schedulerLabel: 'Medical',
            scheduledDate: '2026-04-20',
            created_at: '2026-04-19T07:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '3001',
            status: 'Pending',
            purpose: 'Pain relief',
            created_at: '2026-04-19T07:10:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '9001',
            status: 'Open',
            purpose: 'Follow-up concern',
            session_start: '2026-04-19T07:20:00.000Z',
          },
          {
            id: '9002',
            status: 'Closed',
            purpose: 'Closed session',
            session_start: '2026-04-18T07:20:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: 2 }] })
      .mockResolvedValueOnce({ rows: [{ credentials_status: 'Active' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '5001',
            templateType: 'prescription',
            created_at: '2026-04-18T07:20:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: 4 }] })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });

    mockGetUserUpdateTicket.mockResolvedValueOnce({
      id: '4001',
      status: 'Pending',
      scope: 'Medical',
      notes: 'Update pending review',
      created_at: '2026-04-19T07:30:00.000Z',
    });

    mockAutoExpireTickets.mockResolvedValueOnce();

    const response = await request(app)
      .post('/dashboard/patient')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.pending).toEqual({
      total: 4,
      appointments: 1,
      medRequests: 1,
      healthChats: 1,
      documents: 1,
    });

    expect(response.body.patientStatus).toEqual({
      credentials: 'Active',
      hasPendingUpdate: true,
    });

    expect(response.body.appointments).toEqual({
      latest: {
        id: '2001',
        status: 'Scheduled',
        session: 'Morning',
        purpose: 'General checkup',
        schedulerLabel: 'Medical',
        scheduledDate: '2026-04-20',
        created_at: '2026-04-19T07:00:00.000Z',
      },
      total: 1,
      active: 1,
    });

    expect(response.body.medRequests.total).toBe(1);
    expect(response.body.healthChats.total).toBe(2);
    expect(response.body.documents.total).toBe(4);
    expect(response.body.documents.recent).toHaveLength(1);
    expect(response.body.appointment?.id).toBe('2001');
    expect(response.body.medicineReqs).toHaveLength(1);
    expect(response.body.chatData?.total).toBe(2);

    expect(mockDbQuery).toHaveBeenCalledTimes(8);
    expect(mockGetUserUpdateTicket).toHaveBeenCalledTimes(1);
    expect(mockAutoExpireTickets).toHaveBeenCalledWith(101);
  });
});
