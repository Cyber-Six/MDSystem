/**
 * Health Chat Service - Staff Side
 *
 * Handles all GraphQL queries and mutations for the staff health chat feature.
 * Endpoint: /healthchat/medical
 */

import { axiosRequest } from '../../packages-core-adapter';

const ENDPOINT = '/healthchat/medical';

/**
 * Send a GraphQL request to the health chat endpoint
 */
const sendGraphQL = async (query, variables = {}) => {
  const response = await axiosRequest.post(ENDPOINT, {
    query,
    variables
  });

  if (response.data.errors) {
    const firstError = response.data.errors[0];
    const error = new Error(firstError?.message || 'GraphQL error occurred');
    error.graphQLErrors = response.data.errors;
    if (response.data.data) {
      error.data = response.data.data;
    }
    throw error;
  }

  return response.data.data;
};

// ==================== QUERIES ====================

/**
 * Get pending tickets (awaiting approval)
 */
export const getPendingTickets = async (offset = 0, limit = 50) => {
  const query = `
    query GetPendingTickets($offset: Int, $limit: Int) {
      getPendingTickets(offset: $offset, limit: $limit) {
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
          expiresAt
          patient {
            id
            firstName
            lastName
            email
            identifier
            branch
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

  const data = await sendGraphQL(query, { offset, limit });
  return data.getPendingTickets;
};

/**
 * Get active tickets (ongoing chats)
 */
export const getActiveTickets = async (offset = 0, limit = 50) => {
  const query = `
    query GetActiveTickets($offset: Int, $limit: Int) {
      getActiveTickets(offset: $offset, limit: $limit) {
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
          expiresAt
          patient {
            id
            firstName
            lastName
            email
            identifier
            branch
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

  const data = await sendGraphQL(query, { offset, limit });
  return data.getActiveTickets;
};

/**
 * Get all tickets with optional status filter
 */
export const getAllTickets = async (status = null, offset = 0, limit = 50) => {
  const query = `
    query GetAllTickets($status: ChatStatus, $offset: Int, $limit: Int) {
      getAllTickets(status: $status, offset: $offset, limit: $limit) {
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
          expiresAt
          patient {
            id
            firstName
            lastName
            email
            identifier
            branch
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

  const data = await sendGraphQL(query, { status, offset, limit });
  return data.getAllTickets;
};

/**
 * Get archived tickets (closed or expired)
 */
export const getArchivedTickets = async (offset = 0, limit = 50) => {
  // Get both closed and expired tickets
  const closedResult = await getAllTickets('Closed', offset, limit / 2);
  const expiredResult = await getAllTickets('Expired', offset, limit / 2);

  const allChats = [...closedResult.chats, ...expiredResult.chats]
    .sort((a, b) => new Date(b.session_end || b.archived_at) - new Date(a.session_end || a.archived_at));

  return {
    chats: allChats.slice(0, limit),
    total: closedResult.total + expiredResult.total
  };
};

/**
 * Get a specific ticket by ID
 */
export const getTicket = async (chatId) => {
  const query = `
    query GetTicket($chatId: ID!) {
      getTicket(chatId: $chatId) {
        id
        patientId
        medicalId
        purpose
        notes
        status
        session_start
        session_end
        archived_at
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

  const data = await sendGraphQL(query, { chatId });
  return data.getTicket;
};

/**
 * Get messages for a ticket
 */
export const getMessages = async (chatId, offset = 0, limit = 100) => {
  const query = `
    query GetMessages($chatId: ID!, $offset: Int, $limit: Int) {
      getMessages(chatId: $chatId, offset: $offset, limit: $limit) {
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

  const data = await sendGraphQL(query, { chatId, offset, limit });
  return data.getMessages;
};

// ==================== MUTATIONS ====================

/**
 * Approve a pending ticket
 */
export const approveTicket = async (chatId, notes = null) => {
  const mutation = `
    mutation ApproveTicket($input: ApproveTicketInput!) {
      approveTicket(input: $input) {
        success
        message
        chat {
          id
          status
        }
      }
    }
  `;

  const data = await sendGraphQL(mutation, {
    input: { chatId, notes }
  });
  return data.approveTicket;
};

/**
 * Reject a pending ticket
 */
export const rejectTicket = async (chatId, reason = null) => {
  const mutation = `
    mutation RejectTicket($chatId: ID!, $reason: String) {
      rejectTicket(chatId: $chatId, reason: $reason) {
        success
        message
        chat {
          id
          status
        }
      }
    }
  `;

  const data = await sendGraphQL(mutation, { chatId, reason });
  return data.rejectTicket;
};

/**
 * Send a message as staff
 */
export const sendMessage = async (chatId, text = null, filename = null, promptType = 'text') => {
  const mutation = `
    mutation SendMedicalMessage($input: SendMessageInput!) {
      sendMedicalMessage(input: $input) {
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

  const data = await sendGraphQL(mutation, {
    input: { chatId, text, filename, promptType }
  });
  return data.sendMedicalMessage;
};

/**
 * Close a ticket
 */
export const closeTicket = async (chatId, notes = null) => {
  const mutation = `
    mutation CloseTicket($input: CloseTicketInput!) {
      closeTicket(input: $input) {
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

  const data = await sendGraphQL(mutation, {
    input: { chatId, notes }
  });
  return data.closeTicket;
};

/**
 * Delete an archived ticket (admin only)
 */
export const deleteArchivedTicket = async (chatId) => {
  const mutation = `
    mutation DeleteArchivedTicket($chatId: ID!) {
      deleteArchivedTicket(chatId: $chatId) {
        success
        message
      }
    }
  `;

  const data = await sendGraphQL(mutation, { chatId });
  return data.deleteArchivedTicket;
};

// ==================== FILE HANDLING ====================

/**
 * Upload a file to staging area
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
 * Remove a staged file
 */
export const unstageFile = async (fileId) => {
  await axiosRequest.delete(`/media/unstage/${fileId}`);
};

/**
 * Get the URL for a file
 */
export const getFileUrl = (fileId) => {
  return `/media/record/eConsultation/${fileId}`;
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Format patient name
 */
export const formatPatientName = (patient) => {
  if (!patient) return 'Unknown';
  const { firstName, lastName } = patient;
  if (!lastName && !firstName) return 'Unknown';
  return `${firstName || ''} ${lastName || ''}`.trim();
};

/**
 * Get patient initials
 */
export const getPatientInitials = (patient) => {
  if (!patient) return '?';
  const f = patient.firstName?.[0] || '';
  const l = patient.lastName?.[0] || '';
  return (f + l).toUpperCase() || '?';
};

/**
 * Get status badge class
 */
export const getStatusBadgeClass = (status) => {
  const map = {
    Open: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    Ongoing: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    Closed: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
    Expired: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
  };
  return map[status] || 'bg-neutral-100 text-neutral-600';
};

/**
 * Format relative time
 */
export const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};
