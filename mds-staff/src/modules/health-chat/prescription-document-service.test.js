jest.mock('../../services/prescription-document-service', () => ({
  generatePrescription: jest.fn(),
  downloadDocumentBlob: jest.fn(),
  previewPrescription: jest.fn(),
}));

import * as sharedService from '../../services/prescription-document-service';
import { downloadDocumentBlob, generatePrescription, previewPrescription } from './prescription-document-service';

describe('health-chat prescription document adapter', () => {
  it('re-exports the shared prescription document API without wrapping it', () => {
    expect(generatePrescription).toBe(sharedService.generatePrescription);
    expect(downloadDocumentBlob).toBe(sharedService.downloadDocumentBlob);
    expect(previewPrescription).toBe(sharedService.previewPrescription);
  });
});
