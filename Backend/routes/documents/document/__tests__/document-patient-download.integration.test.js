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
  createPdfAuditRecord: jest.fn((buffer, context = {}) => ({
    templateType: context.templateType || 'prescription',
    storagePath: context.storagePath || null,
    filePath: context.filePath || context.storagePath || null,
    sha256: 'mock-prescription-sha256',
    byteLength: Buffer.isBuffer(buffer) ? buffer.length : 0,
  })),
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
  createPdfAuditRecord: jest.fn((buffer, context = {}) => ({
    templateType: context.templateType || 'medical-certificate',
    storagePath: context.storagePath || null,
    filePath: context.filePath || context.storagePath || null,
    sha256: 'mock-medical-certificate-sha256',
    byteLength: Buffer.isBuffer(buffer) ? buffer.length : 0,
  })),
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

  const setupPrescriptionRegenerationMocks = () => {
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
  };

  const setupMedicalCertificateRegenerationMocks = () => {
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
  };

  test('GET /documents/patient/prescription/view/:id returns a valid inline PDF stream', async () => {
    setupPrescriptionRegenerationMocks();

    const response = await request(app)
      .get('/documents/patient/prescription/view/55')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/i);
    expect(response.headers['content-disposition']).toMatch(/inline/i);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('GET /documents/patient/prescription/:id/view returns a valid inline PDF stream', async () => {
    setupPrescriptionRegenerationMocks();

    const response = await request(app)
      .get('/documents/patient/prescription/55/view')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/i);
    expect(response.headers['content-disposition']).toMatch(/inline/i);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('GET /documents/patient/prescription/download/:id returns a valid attachment PDF stream', async () => {
    setupPrescriptionRegenerationMocks();

    const response = await request(app)
      .get('/documents/patient/prescription/download/55')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/i);
    expect(response.headers['content-disposition']).toMatch(/attachment/i);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('GET /documents/patient/prescription/:id/download returns a valid attachment PDF stream', async () => {
    setupPrescriptionRegenerationMocks();

    const response = await request(app)
      .get('/documents/patient/prescription/55/download')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/i);
    expect(response.headers['content-disposition']).toMatch(/attachment/i);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('GET /documents/patient/medical-certificate/view/:id returns a valid inline PDF stream', async () => {
    setupMedicalCertificateRegenerationMocks();

    const response = await request(app)
      .get('/documents/patient/medical-certificate/view/77')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/i);
    expect(response.headers['content-disposition']).toMatch(/inline/i);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('GET /documents/patient/medical-certificate/:id/view returns a valid inline PDF stream', async () => {
    setupMedicalCertificateRegenerationMocks();

    const response = await request(app)
      .get('/documents/patient/medical-certificate/77/view')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/i);
    expect(response.headers['content-disposition']).toMatch(/inline/i);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('GET /documents/patient/medical-certificate/download/:id returns a valid attachment PDF stream', async () => {
    setupMedicalCertificateRegenerationMocks();

    const response = await request(app)
      .get('/documents/patient/medical-certificate/download/77')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/i);
    expect(response.headers['content-disposition']).toMatch(/attachment/i);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('GET /documents/patient/medical-certificate/:id/download returns a valid attachment PDF stream', async () => {
    setupMedicalCertificateRegenerationMocks();

    const response = await request(app)
      .get('/documents/patient/medical-certificate/77/download')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/i);
    expect(response.headers['content-disposition']).toMatch(/attachment/i);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('returns 403 when patient attempts to access another patient\'s document', async () => {
    mockDbQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 55,
          patientId: 999,
          issuedBy: 900,
          created_at: '2026-04-19T02:34:00.000Z',
          templateType: 'prescription',
          description: 'Prescription document template',
        },
      ],
    });

    const response = await request(app)
      .get('/documents/patient/prescription/view/55');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('FORBIDDEN');
  });

  test('returns 404 when document does not exist', async () => {
    mockDbQuery.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .get('/documents/patient/prescription/view/9999');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('DOCUMENT_NOT_FOUND');
  });

  test('returns 500 when stored payload is not a valid PDF buffer', async () => {
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
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ data: Buffer.from('not-a-pdf').toString('base64') }] });

    const response = await request(app)
      .get('/documents/patient/prescription/view/55');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('INVALID_PDF_BUFFER');
  });
});
