jest.mock('../../services/certificate-document-service', () => ({
  generateMedicalCertificate: jest.fn(),
  downloadDocumentBlob: jest.fn(),
  previewMedicalCertificate: jest.fn(),
}));

import * as sharedService from '../../services/certificate-document-service';
import {
  downloadDocumentBlob,
  generateMedicalCertificate,
  previewMedicalCertificate,
} from './certificate-document-service';

describe('health-chat certificate document adapter', () => {
  it('re-exports the shared certificate document API without wrapping it', () => {
    expect(generateMedicalCertificate).toBe(sharedService.generateMedicalCertificate);
    expect(downloadDocumentBlob).toBe(sharedService.downloadDocumentBlob);
    expect(previewMedicalCertificate).toBe(sharedService.previewMedicalCertificate);
  });
});
