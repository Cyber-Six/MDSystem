jest.mock('../packages-core-adapter', () => ({ axiosRequest: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));

import { axiosRequest } from '../packages-core-adapter';
import {
  approveDocument, archiveDocument, cancelDocument, downloadGeneratedDocumentBlob,
  getGeneratedDocuments, getRequiredDocuments, recordDocument, rejectDocument,
  requestDocument, viewDocumentFile, viewGeneratedDocumentBlob,
} from './document-service';

describe('staff document service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('gets required/generated documents and surfaces failed responses', async () => {
    axiosRequest.get.mockResolvedValueOnce({ data: { success: true, documents: [{ id: 'required' }] } });
    await expect(getRequiredDocuments('patient-1')).resolves.toEqual([{ id: 'required' }]);
    expect(axiosRequest.get).toHaveBeenLastCalledWith('/documents/required', { params: { patientId: 'patient-1' } });
    axiosRequest.get.mockResolvedValueOnce({ data: { success: true, documents: [{ id: 'generated' }] } });
    await expect(getGeneratedDocuments('patient-1')).resolves.toEqual([{ id: 'generated' }]);
    axiosRequest.get.mockResolvedValueOnce({ data: { success: false, error: 'forbidden' } });
    await expect(getRequiredDocuments('patient-1')).rejects.toThrow('forbidden');
  });

  test.each([
    ['request', requestDocument, '/documents/required/tag-1/request'],
    ['approve', approveDocument, '/documents/required/tag-1/approve'],
    ['reject', rejectDocument, '/documents/required/tag-1/reject'],
    ['archive', archiveDocument, '/documents/required/tag-1/archive'],
  ])('%s performs its document action', async (_name, action, path) => {
    axiosRequest.post.mockResolvedValue({ data: { success: true, submissionId: 1 } });
    await expect(action('tag-1', 'patient-1', 'note')).resolves.toEqual({ success: true, submissionId: 1 });
    expect(axiosRequest.post).toHaveBeenLastCalledWith(path, { patientId: 'patient-1', notes: 'note' });
  });

  test('records and cancels a document, including API error responses', async () => {
    axiosRequest.post.mockResolvedValueOnce({ data: { success: true, submissionId: 2 } });
    await expect(recordDocument('tag-1', 'patient-1', 'file-1')).resolves.toMatchObject({ submissionId: 2 });
    expect(axiosRequest.post).toHaveBeenLastCalledWith('/documents/required/tag-1', { patientId: 'patient-1', file: 'file-1' });
    axiosRequest.delete.mockResolvedValueOnce({ data: { success: true } });
    await expect(cancelDocument('tag-1', 'patient-1')).resolves.toEqual({ success: true });
    expect(axiosRequest.delete).toHaveBeenLastCalledWith('/documents/required/tag-1/cancel', { params: { patientId: 'patient-1' } });
    axiosRequest.post.mockResolvedValueOnce({ data: { success: false, error: 'not allowed' } });
    await expect(recordDocument('tag-1', 'patient-1')).rejects.toThrow('not allowed');
  });

  test('retrieves uploaded files and resolves generated document paths with fallback', async () => {
    const fileBlob = { name: 'file' };
    axiosRequest.get.mockResolvedValueOnce({ data: fileBlob });
    await expect(viewDocumentFile('file-1')).resolves.toBe(fileBlob);
    expect(axiosRequest.get).toHaveBeenLastCalledWith('/media/record/documents/file-1', { responseType: 'blob' });

    const generated = { name: 'generated' };
    axiosRequest.get.mockClear();
    axiosRequest.get.mockRejectedValueOnce(new Error('template unavailable')).mockResolvedValueOnce({ data: generated });
    await expect(downloadGeneratedDocumentBlob({ id: 'rx-1', templateType: 'prescription' })).resolves.toBe(generated);
    expect(axiosRequest.get).toHaveBeenNthCalledWith(1, '/documents/prescription/download/rx-1', { responseType: 'blob' });
    expect(axiosRequest.get).toHaveBeenNthCalledWith(2, '/documents/generated/download/rx-1', { responseType: 'blob' });

    axiosRequest.get.mockResolvedValueOnce({ data: generated });
    await expect(viewGeneratedDocumentBlob('mc-1', 'medical certificate')).resolves.toBe(generated);
    expect(axiosRequest.get).toHaveBeenLastCalledWith('/documents/medical-certificate/view/mc-1', { responseType: 'blob' });
  });
});
