import { axiosRequest } from '../packages-core-adapter';
import {
  downloadDocumentBlob,
  generateMedicalCertificate,
  previewMedicalCertificate,
} from './certificate-document-service';

jest.mock('../packages-core-adapter', () => ({
  axiosRequest: { get: jest.fn(), post: jest.fn() },
}));

describe('certificate document service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('generates a certificate with the optional chat context', async () => {
    const result = { success: true, documentId: 12 };
    axiosRequest.post.mockResolvedValue({ data: result });

    await expect(generateMedicalCertificate(5, { certificate: 'fit' }, { chatId: 9 })).resolves.toBe(result);
    expect(axiosRequest.post).toHaveBeenCalledWith('/documents/medical-certificate/generate', {
      patientId: 5, data: { certificate: 'fit' }, chatId: 9,
    });
  });

  it('rejects unsuccessful certificate generation', async () => {
    axiosRequest.post.mockResolvedValue({ data: { success: false, error: 'Missing patient' } });
    await expect(generateMedicalCertificate(5, {})).rejects.toThrow('Missing patient');
  });

  it('previews a certificate as a blob', async () => {
    const blob = new Blob(['PDF'], { type: 'application/pdf' });
    axiosRequest.post.mockResolvedValue({ data: blob });
    await expect(previewMedicalCertificate({ diagnosis: 'Healthy' })).resolves.toBe(blob);
    expect(axiosRequest.post).toHaveBeenCalledWith('/documents/medical-certificate/preview', {
      data: { diagnosis: 'Healthy' },
    }, { responseType: 'blob' });
  });

  it('downloads a typed PDF from the generated-document endpoint', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    axiosRequest.get.mockResolvedValue({ data: blob });
    await expect(downloadDocumentBlob(12)).resolves.toBe(blob);
    expect(axiosRequest.get).toHaveBeenCalledWith('/documents/generated/download/12', { responseType: 'blob' });
  });

  it('uses the fallback endpoint when the generated download fails', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    axiosRequest.get.mockRejectedValueOnce(new Error('Not found')).mockResolvedValueOnce({ data: blob });
    await expect(downloadDocumentBlob(12)).resolves.toBe(blob);
    expect(axiosRequest.get).toHaveBeenLastCalledWith('/documents/12', { responseType: 'blob' });
  });

  it('rejects non-PDF payloads after trying both download routes', async () => {
    axiosRequest.get.mockResolvedValue({ data: new Blob(['error'], { type: 'text/plain' }) });
    await expect(downloadDocumentBlob(12)).rejects.toThrow('Received non-PDF payload');
    expect(axiosRequest.get).toHaveBeenCalledTimes(2);
  });
});
