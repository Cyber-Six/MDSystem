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
});
