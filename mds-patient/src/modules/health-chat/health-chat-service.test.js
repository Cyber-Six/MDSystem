jest.mock('../../packages-core-adapter', () => ({
  axiosRequest: { post: jest.fn(), delete: jest.fn() },
}));
jest.mock('../../utils/graphql-client', () => ({ sendGraphQLRequest: jest.fn() }));

import { axiosRequest } from '../../packages-core-adapter';
import { sendGraphQLRequest } from '../../utils/graphql-client';
import {
  closeTicket, createTicket, extendSession, getCurrentActiveTicket, getFileUrl,
  getMostRecentTicket, getMyPrescriptions, getMyTicket, getMyTickets,
  getTicketMessages, sendMessage, unstageFile, uploadFile,
} from './health-chat-service';

describe('patient health-chat service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('maps ticket, message, and mutation responses to their public values', async () => {
    sendGraphQLRequest
      .mockResolvedValueOnce({ getMyTickets: { chats: [{ id: 'ticket-1' }], total: 1 } })
      .mockResolvedValueOnce({ getMyTicket: { id: 'ticket-1' } })
      .mockResolvedValueOnce({ getTicketMessages: [{ id: 'message-1' }] })
      .mockResolvedValueOnce({ createTicket: { success: true } })
      .mockResolvedValueOnce({ sendPatientMessage: { success: true } })
      .mockResolvedValueOnce({ closeMyTicket: { success: true } })
      .mockResolvedValueOnce({ extendSession: { success: true } });

    await expect(getMyTickets('Open', 2, 3)).resolves.toEqual({ chats: [{ id: 'ticket-1' }], total: 1 });
    await expect(getMyTicket('ticket-1')).resolves.toEqual({ id: 'ticket-1' });
    await expect(getTicketMessages('ticket-1', 1, 2)).resolves.toEqual([{ id: 'message-1' }]);
    await expect(createTicket('Consultation', 'notes')).resolves.toEqual({ success: true });
    await expect(sendMessage('ticket-1', 'hello', 'file-1', 'file')).resolves.toEqual({ success: true });
    await expect(closeTicket('ticket-1')).resolves.toEqual({ success: true });
    await expect(extendSession('ticket-1')).resolves.toEqual({ success: true });
    expect(sendGraphQLRequest).toHaveBeenCalledWith(expect.stringContaining('GetMyTickets'), { status: 'Open', offset: 2, limit: 3 }, { endpoint: '/healthchat/patient' });
  });

  test('uploads, unstages, and resolves normal and generated document URLs', async () => {
    axiosRequest.post.mockResolvedValue({ data: { fileId: 'file-1' } });
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    await expect(uploadFile(file)).resolves.toBe('file-1');
    expect(axiosRequest.post).toHaveBeenCalledWith('/media/stage/', expect.any(FormData), expect.any(Object));
    await unstageFile('file-1');
    expect(axiosRequest.delete).toHaveBeenCalledWith('/media/unstage/file-1');
    expect(getFileUrl('file-1')).toBe('/media/record/eConsultation/file-1');
    expect(getFileUrl('document:prescription:rx-1')).toBe('/documents/prescription/view/rx-1');
    expect(getFileUrl('document:medical certificate:mc-1')).toBe('/documents/medical-certificate/view/mc-1');
    expect(getFileUrl('document:document-1')).toBe('/documents/my/download/document-1');
  });

  test('finds active/recent tickets and returns null after empty or failed queries', async () => {
    sendGraphQLRequest
      .mockResolvedValueOnce({ getMyTickets: { chats: [{ id: 'ongoing' }] } })
      .mockResolvedValueOnce({ getMyTickets: { chats: [] } })
      .mockResolvedValueOnce({ getMyTickets: { chats: [{ id: 'open' }] } })
      .mockResolvedValueOnce({ getMyTickets: { chats: [{ id: 'recent' }] } })
      .mockRejectedValueOnce(new Error('offline'));
    await expect(getCurrentActiveTicket()).resolves.toEqual({ id: 'ongoing' });
    await expect(getCurrentActiveTicket()).resolves.toEqual({ id: 'open' });
    await expect(getMostRecentTicket()).resolves.toEqual({ id: 'recent' });
    await expect(getMostRecentTicket()).resolves.toBeNull();
  });

  test('loads prescription history from its dedicated endpoint', async () => {
    sendGraphQLRequest.mockResolvedValue({ getMyPrescriptions: [{ id: 'rx-1' }] });
    await expect(getMyPrescriptions(4, 5)).resolves.toEqual([{ id: 'rx-1' }]);
    expect(sendGraphQLRequest).toHaveBeenLastCalledWith(
      expect.stringContaining('GetMyPrescriptions'), { offset: 4, limit: 5 },
      { endpoint: '/medical-inventory/prescription/patient' },
    );
  });
});
