import { axiosRequest } from '../packages-core-adapter';
import {
  downloadDocumentBlob,
  generatePrescription,
  previewPrescription,
} from './prescription-document-service';

jest.mock('../packages-core-adapter', () => ({
  axiosRequest: { get: jest.fn(), post: jest.fn() },
}));

describe('prescription document service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('generates a prescription and includes an optional chat id', async () => {
    const result = { success: true, documentId: 21 };
    axiosRequest.post.mockResolvedValue({ data: result });
    await expect(generatePrescription(7, { medicines: [] }, { chatId: 3 })).resolves.toBe(result);
    expect(axiosRequest.post).toHaveBeenCalledWith('/documents/prescription/generate', {
      patientId: 7, data: { medicines: [] }, chatId: 3,
    });
  });

  it('surfaces a generation error', async () => {
    axiosRequest.post.mockResolvedValue({ data: { success: false, error: 'No medicines' } });
    await expect(generatePrescription(7, {})).rejects.toThrow('No medicines');
  });

  it('returns the preview blob', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    axiosRequest.post.mockResolvedValue({ data: blob });
    await expect(previewPrescription({ medicines: [] })).resolves.toBe(blob);
    expect(axiosRequest.post).toHaveBeenCalledWith('/documents/prescription/preview', {
      data: { medicines: [] },
    }, { responseType: 'blob' });
  });

  it('downloads a PDF from the current route', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    axiosRequest.get.mockResolvedValue({ data: blob });
    await expect(downloadDocumentBlob(21)).resolves.toBe(blob);
    expect(axiosRequest.get).toHaveBeenCalledWith('/documents/generated/download/21', { responseType: 'blob' });
  });

  it('falls back to the legacy download route', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    axiosRequest.get.mockRejectedValueOnce(new Error('missing')).mockResolvedValueOnce({ data: blob });
    await expect(downloadDocumentBlob(21)).resolves.toBe(blob);
    expect(axiosRequest.get).toHaveBeenLastCalledWith('/documents/21', { responseType: 'blob' });
  });

  it('rejects invalid payloads after both routes are exhausted', async () => {
    axiosRequest.get.mockResolvedValue({ data: new Blob(['error'], { type: 'text/plain' }) });
    await expect(downloadDocumentBlob(21)).rejects.toThrow('Received non-PDF payload');
  });
});
