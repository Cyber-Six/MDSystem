const express = require('express');
const request = require('supertest');

const mockDbQuery = jest.fn();
const mockIsMedicalPermittedPatientBased = jest.fn();

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

jest.mock('../../../../config/sockets', () => ({
  emitToRoom: jest.fn(),
  notifyUser: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../../routes/health-chat/resolvers/wrapper/helper.js', () => ({
  formatMessage: jest.fn((payload) => payload),
}));

jest.mock('../../../../config/middleware/jwtProtect.js', () => ({
  jwtProtect: () => (req, _res, next) => {
    req.user = { id: 900 };
    next();
  },
}));

jest.mock('../../../../utils/logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../../services/permit.js', () => ({
  permissions: {
    document_allow_view: 'document_allow_view',
    document_allow_generate: 'document_allow_generate',
  },
  isMedicalPermittedPatientBased: (...args) => mockIsMedicalPermittedPatientBased(...args),
  isMedicalPermitted: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('../../../../services/doc-generate-module/index.js', () => ({
  generateDocumentBuffer: jest.fn(),
  shouldPersist: jest.fn(() => true),
  getTemplate: jest.fn(() => null),
}));

jest.mock('../../../../services/doc-generate-module/prescription-normalized.js', () => ({
  PRESCRIPTION_TEMPLATE_NAME: 'Prescription',
  PRESCRIPTION_DOC_TYPE: 'prescription',
  PRESCRIPTION_REQUIRED_TAGS: [
    'complaints',
    'diagnosis',
    'medications',
    'instructions',
    'follow_up',
    'doctor_signature',
    'ptr_number',
    'license_number',
  ],
  GENERIC_BINARY_TAG: 'payload',
  normalizeTag: (value = '') => String(value).trim().toLowerCase(),
  assertPdfBuffer: jest.fn(),
  createPdfAuditRecord: jest.fn(() => ({ sha256: 'hash', byteLength: 0 })),
  buildPrescriptionRequirementValues: jest.fn(() => ({
    requirementValues: {},
    normalizedPrescription: {},
    normalizedPhysician: {},
  })),
  parsePrescriptionRequirementRows: jest.fn(() => ({ diagnosis: 'Test diagnosis' })),
}));

jest.mock('../../../../services/doc-generate-module/medical-certificate-normalized.js', () => ({
  MEDICAL_CERTIFICATE_TEMPLATE_NAME: 'medical-certificate',
  MEDICAL_CERTIFICATE_DOC_TYPE: 'medical-certificate',
  MEDICAL_CERTIFICATE_REQUIRED_TAGS: [
    'purpose',
    'diagnosis',
    'recommendations',
    'valid_from',
    'valid_until',
    'restrictions',
    'remarks',
    'doctor_signature',
    'ptr_number',
    'license_number',
  ],
  assertPdfBuffer: jest.fn(),
  createPdfAuditRecord: jest.fn(() => ({ sha256: 'hash', byteLength: 0 })),
  buildMedicalCertificateRequirementValues: jest.fn(() => ({
    requirementValues: {},
    normalizedCertificate: {},
    normalizedPhysician: {},
  })),
  parseMedicalCertificateRequirementRows: jest.fn(() => ({ diagnosis: 'Test diagnosis' })),
}));

const router = require('../document-staff.js');

const binaryParser = (res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

const seedStaffTemplatePdfFallback = ({ documentId, templateType }) => {
  const pdfBase64 = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF').toString('base64');

  mockDbQuery
    .mockResolvedValueOnce({
      rows: [
        {
          id: documentId,
          patientId: 101,
          issuedBy: 900,
          created_at: '2026-04-19T02:33:00.000Z',
          templateType,
        },
      ],
    })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ data: pdfBase64 }] });
};

describe('Staff generated document PDF routes', () => {
  let app;

  beforeEach(() => {
    mockDbQuery.mockReset();
    mockIsMedicalPermittedPatientBased.mockReset();
    mockIsMedicalPermittedPatientBased.mockResolvedValue(true);

    app = express();
    app.use('/documents', router);
  });

  test('GET /documents/prescription/view/:id returns a valid inline PDF stream', async () => {
    seedStaffTemplatePdfFallback({ documentId: 55, templateType: 'prescription' });

    const response = await request(app)
      .get('/documents/prescription/view/55')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/i);
    expect(response.headers['content-disposition']).toMatch(/inline/i);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('GET /documents/prescription/download/:id returns a valid PDF stream', async () => {
    seedStaffTemplatePdfFallback({ documentId: 55, templateType: 'prescription' });

    const response = await request(app)
      .get('/documents/prescription/download/55')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/i);
    expect(response.headers['content-disposition']).toMatch(/attachment/i);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('GET /documents/medical-certificate/view/:id returns a valid inline PDF stream', async () => {
    seedStaffTemplatePdfFallback({ documentId: 77, templateType: 'medical-certificate' });

    const response = await request(app)
      .get('/documents/medical-certificate/view/77')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/i);
    expect(response.headers['content-disposition']).toMatch(/inline/i);
    expect(response.body.length).toBeGreaterThan(0);
  });

  test('GET /documents/medical-certificate/download/:id returns a valid PDF stream', async () => {
    seedStaffTemplatePdfFallback({ documentId: 77, templateType: 'medical-certificate' });

    const response = await request(app)
      .get('/documents/medical-certificate/download/77')
      .buffer(true)
      .parse(binaryParser);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/pdf/i);
    expect(response.headers['content-disposition']).toMatch(/attachment/i);
    expect(response.body.length).toBeGreaterThan(0);
  });
});
