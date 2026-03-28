/**
 * Health Chat Service - Patient Side
 *
 * Handles all GraphQL queries and mutations for the patient health chat feature.
 * Endpoint: /healthchat/patient
 */

import { axiosRequest } from '../../packages-core-adapter';
import { sendGraphQLRequest } from '../../utils/graphql-client';

const ENDPOINT = '/healthchat/patient';

const sendHealthChatRequest = (query, variables = {}) => {
  return sendGraphQLRequest(query, variables, { endpoint: ENDPOINT });
};

// ==================== QUERIES ====================

/**
 * Get patient's tickets with optional status filter
 * @param {string|null} status - ChatStatus filter (Open, Ongoing, Closed, Expired)
 * @param {number} offset - Pagination offset
 * @param {number} limit - Pagination limit
 */
export const getMyTickets = async (status = null, offset = 0, limit = 10) => {
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
 * @param {string} chatId - The ticket/chat ID
 */
export const getMyTicket = async (chatId) => {
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
 * @param {string} chatId - The ticket/chat ID
 * @param {number} offset - Pagination offset
 * @param {number} limit - Pagination limit
 */
export const getTicketMessages = async (chatId, offset = 0, limit = 50) => {
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
 * @param {string} purpose - The reason for the consultation
 * @param {string|null} notes - Optional additional notes
 */
export const createTicket = async (purpose, notes = null) => {
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
    input: { purpose, notes }
  });
  return data.createTicket;
};

/**
 * Send a message as patient
 * @param {string} chatId - The ticket/chat ID
 * @param {string|null} text - Message text (for text messages)
 * @param {string|null} filename - File UUID (for file messages)
 * @param {string} promptType - Message type: 'text' or 'file'
 */
export const sendMessage = async (chatId, text = null, filename = null, promptType = 'text') => {
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
    input: { chatId, text, filename, promptType }
  });
  return data.sendPatientMessage;
};

/**
 * Close patient's own ticket
 * @param {string} chatId - The ticket/chat ID
 */
export const closeTicket = async (chatId) => {
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
 * Upload a file to staging area
 * @param {File} file - The file to upload
 * @returns {Promise<string>} The file ID (UUID)
 */
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axiosRequest.post('/media/stage/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

  return response.data.fileId;
};

/**
 * Remove a staged file (before it's sent)
 * @param {string} fileId - The file UUID to remove
 */
export const unstageFile = async (fileId) => {
  await axiosRequest.delete(`/media/unstage/${fileId}`);
};

/**
 * Get the URL for a file in a message
 * @param {string} fileId - The file UUID
 * @returns {string} The file URL
 */
export const getFileUrl = (fileId) => {
  return `/media/record/eConsultation/${fileId}`;
};

/**
 * Get the current active ticket (if any)
 * Returns the first active (Open or Ongoing) ticket, or null
 */
export const getCurrentActiveTicket = async () => {
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
 * Used to show conversation history
 */
export const getMostRecentTicket = async () => {
  try {
    const result = await getMyTickets(null, 0, 1);
    return result.chats.length > 0 ? result.chats[0] : null;
  } catch (error) {
    console.error('[Health Chat Service] Error fetching recent ticket:', error);
    return null;
  }
};

// ==================== PRESCRIPTIONS ====================

/**
 * Get the patient's own prescription history
 * Endpoint: /medical-inventory/prescription/patient
 */
export const getMyPrescriptions = async (offset = 0, limit = 50) => {
  const { sendGraphQLRequest } = await import('../../utils/graphql-client');
  const query = `
    query GetMyPrescriptions($offset: Int, $limit: Int) {
      getMyPrescriptions(offset: $offset, limit: $limit) {
        id
        action
        quantity
        issuedAt
        notes
      }
    }
  `;
  const data = await sendGraphQLRequest(query, { offset, limit }, {
    endpoint: '/medical-inventory/prescription/patient'
  });
  return data.getMyPrescriptions;
};
