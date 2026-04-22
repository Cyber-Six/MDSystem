const express = require('express');
const request = require('supertest');

const mockDbQuery = jest.fn();
const mockGetStaffBranch = jest.fn();
const mockIsMedicalPermitted = jest.fn();

jest.mock('../../../config/middleware/jwtProtect.js', () => ({
  jwtProtect: () => (req, _res, next) => {
    req.user = {
      id: Number(req.headers['x-test-user-id'] || 901),
      role: 'medical',
    };
    next();
  },
}));

jest.mock('../../../config/query.js', () => ({
  query: (...args) => mockDbQuery(...args),
}));

jest.mock('../../../services/permit.js', () => ({
  getStaffBranch: (...args) => mockGetStaffBranch(...args),
  isMedicalPermitted: (...args) => mockIsMedicalPermitted(...args),
  permissions: {
    profile_allow_view: 'ALLOW_TO_VIEW_PROFILE',
  },
}));

jest.mock('../../../utils/logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../notifications.js', () => {
  const express = require('express');
  return express.Router();
});

const router = require('../profile.js');

describe('staff profile patient-search security', () => {
  let app;

  beforeEach(() => {
    mockDbQuery.mockReset();
    mockGetStaffBranch.mockReset().mockResolvedValue('Both');
    mockIsMedicalPermitted.mockReset().mockResolvedValue({ permitted: true, branch: 'Both' });

    app = express();
    app.use(express.json());
    app.use('/staff', router);
  });

  test('returns 403 when profile permission is missing', async () => {
    mockIsMedicalPermitted.mockResolvedValueOnce({ permitted: false, branch: null });

    const response = await request(app)
      .get('/staff/id/search')
      .query({ query: 'ana', branch: 'Manila' });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('FORBIDDEN');
    expect(mockDbQuery).not.toHaveBeenCalled();
  });

  test('returns 403 when permission branch does not cover requested branch', async () => {
    mockIsMedicalPermitted.mockResolvedValueOnce({ permitted: true, branch: 'Manila' });

    const response = await request(app)
      .get('/staff/id/search')
      .query({ query: 'ana', branch: 'QuezonCity' });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('FORBIDDEN');
    expect(mockDbQuery).not.toHaveBeenCalled();
  });

  test('returns 400 for invalid branch values', async () => {
    const response = await request(app)
      .get('/staff/id/search')
      .query({ query: 'ana', branch: 'North' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('INVALID_BRANCH');
    expect(mockDbQuery).not.toHaveBeenCalled();
  });

  test('search trims query before DB search and returns mapped fields', async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        {
          userId: 101,
          email: 'sample@tip.edu.ph',
          first_name: 'Ana',
          middle_name: null,
          last_name: 'Santos',
          identifier: '2024-001',
          profile_type: 'Student',
          program: 'BSIT',
          year: '3',
          department: null,
          role: null,
        },
      ],
    });

    const response = await request(app)
      .get('/staff/id/search')
      .query({ query: '  ana  ', branch: 'Manila' });

    expect(response.status).toBe(200);
    expect(response.body.users).toEqual([
      {
        id: 101,
        email: 'sample@tip.edu.ph',
        firstName: 'Ana',
        middleName: null,
        lastName: 'Santos',
        identifier: '2024-001',
        profile_type: 'Student',
        program: 'BSIT',
        year: '3',
        department: null,
        role: null,
      },
    ]);

    expect(mockDbQuery).toHaveBeenCalledTimes(1);
    expect(mockDbQuery.mock.calls[0][1]).toEqual(['%ana%', 'Manila']);
  });

  test('applies permission check to email search endpoint', async () => {
    mockIsMedicalPermitted.mockResolvedValueOnce({ permitted: false, branch: null });

    const response = await request(app)
      .get('/staff/id/email')
      .query({ email: 'staff@tip.edu.ph', branch: 'Manila' });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('FORBIDDEN');
    expect(mockDbQuery).not.toHaveBeenCalled();
  });
});
