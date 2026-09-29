jest.mock('../packages-core-adapter', () => ({ axiosRequest: { get: jest.fn(), post: jest.fn() } }));

import { axiosRequest } from '../packages-core-adapter';
import { downloadMyDocument, getMyDocuments, getRequestedDocuments, uploadRequestedDocument } from './documents-service';

const pdfBlob = (type = 'application/pdf') => ({
  type,
  size: 8,
  slice: jest.fn(() => ({ arrayBuffer: async () => Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]).buffer })),
});

describe('patient document service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('lists patient and requested documents, including API failures', async () => {
    axiosRequest.get.mockResolvedValueOnce({ data: { success: true, documents: [{ id: 1 }] } });
    await expect(getMyDocuments()).resolves.toEqual([{ id: 1 }]);
    expect(axiosRequest.get).toHaveBeenLastCalledWith('/documents/my');

    axiosRequest.get.mockResolvedValueOnce({ data: { success: true, documents: [{ id: 2 }] } });
    await expect(getRequestedDocuments()).resolves.toEqual([{ id: 2 }]);
    expect(axiosRequest.get).toHaveBeenLastCalledWith('/documents/requests');

    axiosRequest.get.mockResolvedValueOnce({ data: { success: false, error: 'unavailable' } });
    await expect(getMyDocuments()).rejects.toThrow('unavailable');
  });

  test('downloads valid PDF responses using supported document route variants', async () => {
    const prescription = pdfBlob();
    const certificate = pdfBlob();
    axiosRequest.get.mockResolvedValueOnce({ data: prescription, headers: { 'content-type': 'application/pdf' } });
    await expect(downloadMyDocument({ id: 'rx-1', templateType: 'prescription' }, { mode: 'view' })).resolves.toBe(prescription);
    expect(axiosRequest.get).toHaveBeenLastCalledWith('/documents/prescription/view/rx-1', expect.any(Object));

    axiosRequest.get.mockResolvedValueOnce({ data: certificate, headers: {} });
    await expect(downloadMyDocument('mc-1', 'medical certificate')).resolves.toBe(certificate);
    expect(axiosRequest.get).toHaveBeenLastCalledWith('/documents/medical-certificate/download/mc-1', expect.any(Object));
    await expect(downloadMyDocument()).rejects.toThrow('documentId is required');
  });

  test('rejects non-PDF server responses with a useful typed error', async () => {
    const responseBlob = { type: 'application/json', text: async () => JSON.stringify({ message: 'Document unavailable' }) };
    axiosRequest.get.mockResolvedValue({ data: responseBlob, headers: { 'content-type': 'application/json' } });

    await expect(downloadMyDocument('bad-1')).rejects.toMatchObject({
      message: 'Document unavailable', code: 'INVALID_PDF_RESPONSE', path: '/documents/my/download/bad-1',
    });
  });

  test('uploads requested documents and rethrows server failures', async () => {
    axiosRequest.post.mockResolvedValueOnce({ data: { success: true, submissionId: 9 } });
    await expect(uploadRequestedDocument('request-1', 'file-1')).resolves.toEqual({ success: true, submissionId: 9 });
    expect(axiosRequest.post).toHaveBeenCalledWith('/documents/requests/request-1', { file: 'file-1' });
    axiosRequest.post.mockResolvedValueOnce({ data: { success: false, error: 'upload rejected' } });
    await expect(uploadRequestedDocument('request-1', 'file-1')).rejects.toThrow('upload rejected');
  });
});
