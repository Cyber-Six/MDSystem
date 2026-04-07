/**
 * Health Chat Service for React Native
 * Mirrors mds-patient/src/modules/health-chat/health-chat-service.js
 *
 * GraphQL-based ticket system for patient-to-staff health consultations.
 * Endpoint: /healthchat/patient
 */

import { sendGraphQLRequest } from './graphql-client';
import { axiosRequest } from '../core';

const ENDPOINT = '/healthchat/patient';

const sendHealthChatRequest = (query: string, variables: Record<string, any> = {}) => {
  return sendGraphQLRequest(query, variables, { endpoint: ENDPOINT });
};

// ==================== TYPES ====================

export type ChatStatus = 'Open' | 'Ongoing' | 'Closed' | 'Expired';

export interface TicketUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Ticket {
  id: string;
  patientId: string;
  medicalId?: string;
  purpose: string;
  notes?: string;
  status: ChatStatus;
  session_start?: string;
  session_end?: string;
  archived_at?: string;
  closedBy?: string;
  expiresAt?: string;
  patient?: TicketUser;
  medical?: TicketUser;
}

export interface TicketMessage {
  id: string;
  consultationVirtualId: string;
  text?: string;
  filename?: string;
  promptType: string;
  userId: string;
  userType: string;
  stamp: string;
  sender?: TicketUser;
}

// ==================== QUERIES ====================

/**
 * Get patient's tickets with optional status filter
 */
export const getMyTickets = async (
  status: ChatStatus | null = null,
  offset = 0,
  limit = 10
): Promise<{ chats: Ticket[]; total: number }> => {
  const query = `
    query GetMyTickets($status: ChatStatus, $offset: Int, $limit: Int) {
      getMyTickets(status: $status, offset: $offset, limit: $limit) {
        chats {
          id
          patientId
          medicalId
          purpose
          notes
          status
          session_start
          session_end
          archived_at
          closedBy
          expiresAt
          patient {
            id
            firstName
            lastName
            email
          }
          medical {
            id
            firstName
            lastName
            email
          }
        }
        total
      }
    }
  `;

  const data = await sendHealthChatRequest(query, { status, offset, limit });
  return data.getMyTickets;
};

/**
 * Get a specific ticket by ID
 */
export const getMyTicket = async (chatId: string): Promise<Ticket> => {
  const query = `
    query GetMyTicket($chatId: ID!) {
      getMyTicket(chatId: $chatId) {
        id
        patientId
        medicalId
        purpose
        notes
        status
        session_start
        session_end
        archived_at
        closedBy
        expiresAt
        patient {
          id
          firstName
          lastName
          email
        }
        medical {
          id
          firstName
          lastName
          email
        }
      }
    }
  `;

  const data = await sendHealthChatRequest(query, { chatId });
  return data.getMyTicket;
};

/**
 * Get messages for a ticket
 */
export const getTicketMessages = async (
  chatId: string,
  offset = 0,
  limit = 50
): Promise<TicketMessage[]> => {
  const query = `
    query GetTicketMessages($chatId: ID!, $offset: Int, $limit: Int) {
      getTicketMessages(chatId: $chatId, offset: $offset, limit: $limit) {
        id
        consultationVirtualId
        text
        filename
        promptType
        userId
        userType
        stamp
        sender {
          id
          firstName
          lastName
          email
        }
      }
    }
  `;

  const data = await sendHealthChatRequest(query, { chatId, offset, limit });
  return data.getTicketMessages;
};

// ==================== MUTATIONS ====================

/**
 * Create a new health chat ticket
 */
export const createTicket = async (
  purpose: string,
  notes: string | null = null
): Promise<{ success: boolean; message?: string; chat?: Ticket }> => {
  const mutation = `
    mutation CreateTicket($input: CreateTicketInput!) {
      createTicket(input: $input) {
        success
        message
        chat {
          id
          patientId
          purpose
          notes
          status
          session_start
          expiresAt
        }
      }
    }
  `;

  const data = await sendHealthChatRequest(mutation, {
    input: { purpose, notes },
  });
  return data.createTicket;
};

/**
 * Send a message as patient
 */
export const sendMessage = async (
  chatId: string,
  text: string | null = null,
  filename: string | null = null,
  promptType: string = 'text'
): Promise<{ success: boolean; message?: TicketMessage }> => {
  const mutation = `
    mutation SendPatientMessage($input: SendMessageInput!) {
      sendPatientMessage(input: $input) {
        success
        message {
          id
          consultationVirtualId
          text
          filename
          promptType
          userId
          userType
          stamp
          sender {
            id
            firstName
            lastName
            email
          }
        }
      }
    }
  `;

  const data = await sendHealthChatRequest(mutation, {
    input: { chatId, text, filename, promptType },
  });
  return data.sendPatientMessage;
};

/**
 * Close patient's own ticket
 */
export const closeTicket = async (
  chatId: string
): Promise<{ success: boolean; message?: string; chat?: Ticket }> => {
  const mutation = `
    mutation CloseMyTicket($chatId: ID!) {
      closeMyTicket(chatId: $chatId) {
        success
        message
        chat {
          id
          status
          session_end
        }
      }
    }
  `;

  const data = await sendHealthChatRequest(mutation, { chatId });
  return data.closeMyTicket;
};

// ==================== FILE HANDLING ====================

/**
 * Upload a file to staging area (React Native)
 */
export const uploadFile = async (
  uri: string,
  name: string,
  type: string
): Promise<string> => {
  const formData = new FormData();
  formData.append('file', { uri, name, type } as any);

  const response = await axiosRequest.post('/media/stage/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data.fileId;
};

/**
 * Remove a staged file
 */
export const unstageFile = async (fileId: string): Promise<void> => {
  await axiosRequest.delete(`/media/unstage/${fileId}`);
};

/**
 * Get the URL for a file in a message
 */
export const getFileUrl = (fileId: string): string => {
  return `/media/record/eConsultation/${fileId}`;
};

/**
 * Extend the active chat session by 1 day.
 * Mirrors mds-patient health-chat-service.js extendSession()
 */
export const extendSession = async (chatId: string): Promise<{
  success: boolean;
  message?: string;
  chat?: Partial<Ticket>;
}> => {
  const mutation = `
    mutation ExtendSession($chatId: ID!) {
      extendSession(chatId: $chatId) {
        success
        message
        chat {
          id
          status
          session_start
          expiresAt
        }
      }
    }
  `;
  const data = await sendHealthChatRequest(mutation, { chatId });
  return data.extendSession;
};

/**
 * Get the current active ticket (if any)
 */
export const getCurrentActiveTicket = async (): Promise<Ticket | null> => {
  try {
    // First check for Ongoing tickets
    const ongoingResult = await getMyTickets('Ongoing', 0, 1);
    if (ongoingResult.chats.length > 0) {
      return ongoingResult.chats[0];
    }

    // Then check for Open (pending) tickets
    const openResult = await getMyTickets('Open', 0, 1);
    if (openResult.chats.length > 0) {
      return openResult.chats[0];
    }

    return null;
  } catch (error) {
    console.error('[Health Chat Service] Error fetching active ticket:', error);
    return null;
  }
};

/**
 * Get the patient's most recent ticket (any status)
 */
export const getMostRecentTicket = async (): Promise<Ticket | null> => {
  try {
    const result = await getMyTickets(null, 0, 1);
    return result.chats.length > 0 ? result.chats[0] : null;
  } catch (error) {
    console.error('[Health Chat Service] Error fetching recent ticket:', error);
    return null;
  }
};
