const express = require('express');
const request = require('supertest');

const mockDbQuery = jest.fn();
const mockGenerateDocumentBuffer = jest.fn();

jest.mock('../../../../config/db.js', () => ({
  query: (...args) => mockDbQuery(...args),
}));

jest.mock('../../../../config/query.js', () => ({
  connect: jest.fn(),
}));

jest.mock('../../../../config/multer.js', () => ({
  promoteFile: jest.fn(),
  deleteFile: jest.fn(),
}));

jest.mock('../../../../config/sockets/socket-emitter.js', () => ({
  notifyUser: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../../config/middleware/jwtProtect.js', () => ({
  jwtProtect: () => (req, _res, next) => {
    req.user = { id: 101 };
    next();
  },
}));

jest.mock('../../../../config/middleware/activeCredential.js', () => ({
  checkCredentialsStatus: (req, _res, next) => {
    if (!req.user) req.user = { id: 101 };
    next();
  },
}));

jest.mock('../../../../utils/logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../../services/doc-generate-module/index.js', () => ({
  generateDocumentBuffer: (...args) => mockGenerateDocumentBuffer(...args),
}));

jest.mock('../../../../services/doc-generate-module/prescription-normalized.js', () => ({
  PRESCRIPTION_DOC_TYPE: 'prescription',
  GENERIC_BINARY_TAG: 'payload',
  parsePrescriptionRequirementRows: jest.fn(() => ({
    diagnosis: 'Upper respiratory tract infection',
    chiefComplaints: 'Cough',
    peFindings: 'Clear breath sounds',
    medications: [],
    specialInstructions: '',
    advice: '',
    followUpDate: undefined,
    doctorSignature: null,
    ptrNumber: 'PTR-001',
    licenseNumber: 'LIC-001',
  })),
  assertPdfBuffer: jest.fn((buffer) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error('Invalid prescription PDF buffer');
    }
  }),
}));

jest.mock('../../../../services/doc-generate-module/medical-certificate-normalized.js', () => ({
  MEDICAL_CERTIFICATE_DOC_TYPE: 'medical-certificate',
  parseMedicalCertificateRequirementRows: jest.fn(() => ({
    purpose: 'Fitness to Work',
    diagnosis: 'Medically fit',
    recommendations: 'Cleared for work',
    validFrom: '2026-04-19',
    validUntil: '2026-05-19',
    restrictions: '',
    remarks: '',
    doctorSignature: null,
    ptrNumber: 'PTR-001',
    licenseNumber: 'LIC-001',
  })),
  assertPdfBuffer: jest.fn((buffer) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error('Invalid medical certificate PDF buffer');
    }
  }),
}));

const router = require('../document-patient.js');

const binaryParser = (res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

describe('Patient document PDF routes', () => {
  let app;

  beforeEach(() => {
    mockDbQuery.mockReset();
    mockGenerateDocumentBuffer.mockReset();

    app = express();
    app.use('/documents', router);
  });

  test('GET /documents/prescription/:id returns a valid PDF stream', async () => {
    mockDbQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 55,
            patientId: 101,
            issuedBy: 900,
            created_at: '2026-04-19T02:34:00.000Z',
            templateType: 'prescription',
            description: 'Prescription document template',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ vartag: 'diagnosis', data: 'URI' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockGenerateDocumentBuffer.mockResolvedValueOnce({
      buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF'),
      filename: 'prescription_55.pdf',
    });

    const response = await request(app)
      .get('/documents/prescription/55')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/i);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('GET /documents/medical-certificate/:id returns a valid PDF stream', async () => {
    mockDbQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: 77,
            patientId: 101,
            issuedBy: 900,
            created_at: '2026-04-19T02:33:00.000Z',
            templateType: 'medical-certificate',
            description: 'Medical certificate document template',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ vartag: 'purpose', data: 'Fitness to Work' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockGenerateDocumentBuffer.mockResolvedValueOnce({
      buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF'),
      filename: 'medical_certificate_77.pdf',
    });

    const response = await request(app)
      .get('/documents/medical-certificate/77')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/i);
    expect(response.body.length).toBeGreaterThan(0);
  });
});
