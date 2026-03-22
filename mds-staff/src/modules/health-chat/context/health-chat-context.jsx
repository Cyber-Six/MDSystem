import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  getPendingTickets,
  getActiveTickets,
  getArchivedTickets,
  getMessages,
  getPatientConversations,
  getPatientMessages,
  approveTicket as approveTicketService,
  rejectTicket as rejectTicketService,
  sendMessage as sendMessageService,
  closeTicket as closeTicketService,
  deleteArchivedTicket as deleteArchivedTicketService
} from '../health-chat-service';

const HealthChatContext = createContext(null);

/**
 * Health Chat Provider
 * Manages state for the staff health chat interface
 * Uses patient-grouped conversations (1 patient = 1 row in the list)
 */
export function HealthChatProvider({ children }) {
  // Conversations state (patient-grouped)
  const [conversations, setConversations] = useState([]);
  const [conversationsTotal, setConversationsTotal] = useState(0);
  const [conversationsLoading, setConversationsLoading] = useState(false);

  // Legacy tickets state (for backward compatibility)
  const [tickets, setTickets] = useState([]);
  const [ticketsTotal, setTicketsTotal] = useState(0);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Selected patient/chat state
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [selectedChatId, setSelectedChatId] = useState(null); // Legacy for compatibility
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [activeTicketId, setActiveTicketId] = useState(null); // Actual ticket ID for sending messages
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Read timestamps tracking (patientId -> timestamp when staff last viewed)
  const [readTimestamps, setReadTimestamps] = useState(() => {
    try {
      const saved = localStorage.getItem('health-chat-read-timestamps');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Typing indicators (patientId -> { userId, isTyping })
  const [typingUsers, setTypingUsers] = useState({});

  // Filter state
  const [filter, setFilter] = useState('active'); // 'active' | 'pending' | 'archive' (kept for backward compatibility)
  const [searchTerm, setSearchTerm] = useState('');

  // Multiple filter selection state (persisted in localStorage)
  const [selectedFilters, setSelectedFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('health-chat-selected-filters');
      return saved ? JSON.parse(saved) : ['active', 'pending'];
    } catch {
      return ['active', 'pending'];
    }
  });

  // Error state
  const [error, setError] = useState(null);
  const [socketError, setSocketError] = useState(false);

  /**
   * Refresh messages for current patient (manual refresh via HTTP)
   */
  const refreshMessages = useCallback(async () => {
    if (!selectedPatientId) return;

    try {
      setMessagesLoading(true);
      setError(null);
      const fetchedMessages = await getPatientMessages(Number(selectedPatientId));
      setMessages(fetchedMessages || []);
    } catch (err) {
      console.error('[HealthChatContext] Failed to refresh messages:', err);
      setError(err.message || 'Failed to refresh messages');
    } finally {
      setMessagesLoading(false);
    }
  }, [selectedPatientId]);

  /**
   * Load tickets based on current filter
   */
  const refreshTickets = useCallback(async () => {
    try {
      setTicketsLoading(true);
      setError(null);

      let result;
      switch (filter) {
        case 'pending':
          result = await getPendingTickets(0, 100);
          break;
        case 'archive':
          result = await getArchivedTickets(0, 100);
          break;
        case 'active':
        default:
          result = await getActiveTickets(0, 100);
          break;
      }

      setTickets(result.chats || []);
      setTicketsTotal(result.total || 0);
    } catch (err) {
      console.error('[HealthChatContext] Failed to load tickets:', err);
      setError(err.message || 'Failed to load tickets');
    } finally {
      setTicketsLoading(false);
    }
  }, [filter]);

  /**
   * Load patient conversations from multiple selected filters
   * Uses getPatientConversations to group by patient (1 patient = 1 row)
   */
  const refreshMultipleFilters = useCallback(async (filters) => {
    if (!filters || filters.length === 0) {
      setConversations([]);
      setConversationsTotal(0);
      setTickets([]); // Legacy
      setTicketsTotal(0);
      return;
    }

    try {
      setConversationsLoading(true);
      setTicketsLoading(true);
      setError(null);

      // Map filter names to status values for the backend
      const statusMap = {
        'active': ['Ongoing'],
        'pending': ['Open'],
        'archive': ['Closed', 'Expired']
      };

      // Collect all statuses from selected filters
      const allStatuses = filters.flatMap(f => statusMap[f] || []);

      // Fetch patient conversations with combined statuses
      const result = await getPatientConversations(allStatuses, 0, 100);

      if (result?.conversations) {
        // Apply local read timestamps to compute effective unread count
        const conversationsWithReadState = result.conversations.map(conv => {
          const readTimestamp = readTimestamps[conv.patientId];
          let effectiveUnreadCount = conv.unreadCount || 0;

          // If we have a read timestamp and lastMessageAt is before it, no unread
          if (readTimestamp && conv.lastMessageAt) {
            const readTime = new Date(readTimestamp);
            const lastMsgTime = new Date(conv.lastMessageAt);
            if (lastMsgTime <= readTime) {
              effectiveUnreadCount = 0;
            }
          }

          return {
            ...conv,
            unreadCount: effectiveUnreadCount
          };
        });

        // Sort by lastMessageAt DESC (newest first)
        conversationsWithReadState.sort((a, b) => {
          const aTime = new Date(a.lastMessageAt || a.latestTicket?.session_start || 0);
          const bTime = new Date(b.lastMessageAt || b.latestTicket?.session_start || 0);
          return bTime - aTime;
        });

        setConversations(conversationsWithReadState);
        setConversationsTotal(result.total || 0);

        // Also populate legacy tickets array for backward compatibility
        // Transform conversations to ticket-like objects
        const ticketLikeItems = conversationsWithReadState.map(conv => ({
          id: conv.patientId, // Use patientId as the ID for selection
          patientId: conv.patientId,
          patient: conv.patient,
          purpose: conv.latestTicket?.purpose,
          status: conv.latestTicket?.status,
          session_start: conv.latestTicket?.session_start,
          session_end: conv.latestTicket?.session_end,
          archived_at: conv.latestTicket?.archived_at,
          closedBy: conv.latestTicket?.closedBy,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt,
          unreadCount: conv.unreadCount,
          activeTicketCount: conv.activeTicketCount,
          totalTicketCount: conv.totalTicketCount,
          tickets: conv.tickets, // Array of all tickets for this patient
          _isConversation: true // Flag to identify this is a patient conversation
        }));

        setTickets(ticketLikeItems);
        setTicketsTotal(result.total || 0);
      }
    } catch (err) {
      console.error('[HealthChatContext] Failed to load patient conversations:', err);
      setError(err.message || 'Failed to load conversations');
    } finally {
      setConversationsLoading(false);
      setTicketsLoading(false);
    }
  }, [readTimestamps]);

  /**
   * Update selected filters and persist to localStorage
   */
  const updateSelectedFilters = useCallback((newFilters) => {
    setSelectedFilters(newFilters);
    localStorage.setItem('health-chat-selected-filters', JSON.stringify(newFilters));
    refreshMultipleFilters(newFilters);
  }, [refreshMultipleFilters]);

  // Load tickets when selectedFilters changes
  useEffect(() => {
    refreshMultipleFilters(selectedFilters);
  }, [selectedFilters, refreshMultipleFilters]);

  // Keep selectedTicket/selectedConversation in sync with data (e.g., after refresh)
  useEffect(() => {
    if (selectedPatientId && tickets.length > 0) {
      const updatedTicket = tickets.find(t =>
        String(t.patientId) === String(selectedPatientId) ||
        String(t.id) === String(selectedPatientId)
      );
      if (updatedTicket) {
        setSelectedTicket(updatedTicket);

        // Also update activeTicketId
        if (updatedTicket.tickets && updatedTicket.tickets.length > 0) {
          const ongoingTicket = updatedTicket.tickets.find(t => t.status === 'Ongoing');
          const pendingTicket = updatedTicket.tickets.find(t => t.status === 'Open');
          const sortedTickets = [...updatedTicket.tickets].sort((a, b) => {
            const aTime = new Date(a.session_start || 0);
            const bTime = new Date(b.session_start || 0);
            return bTime - aTime;
          });
          setActiveTicketId(ongoingTicket?.id || pendingTicket?.id || sortedTickets[0]?.id);
        }
      }
    }
    if (selectedPatientId && conversations.length > 0) {
      const updatedConv = conversations.find(c =>
        String(c.patientId) === String(selectedPatientId)
      );
      if (updatedConv) {
        setSelectedConversation(updatedConv);
      }
    }
  }, [tickets, conversations, selectedPatientId]);

  /**
   * Mark a patient conversation as read
   */
  const markConversationAsRead = useCallback((patientId) => {
    const now = new Date().toISOString();
    setReadTimestamps(prev => {
      const updated = { ...prev, [patientId]: now };
      localStorage.setItem('health-chat-read-timestamps', JSON.stringify(updated));
      return updated;
    });

    // Also update the unreadCount in conversations and tickets
    setConversations(prev => prev.map(conv =>
      conv.patientId === patientId ? { ...conv, unreadCount: 0 } : conv
    ));
    setTickets(prev => prev.map(t =>
      t.patientId === patientId ? { ...t, unreadCount: 0 } : t
    ));
  }, []);

  /**
   * Select a patient conversation and load all their messages
   */
  const selectChat = useCallback(async (idOrPatientId) => {
    // Handle both legacy chatId and new patientId
    const item = tickets.find(t =>
      String(t.id) === String(idOrPatientId) ||
      String(t.patientId) === String(idOrPatientId)
    );

    const patientId = item?.patientId || idOrPatientId;

    if (patientId === selectedPatientId) return;

    setSelectedPatientId(patientId);
    setSelectedChatId(patientId); // Legacy compatibility
    setMessages([]);

    if (!patientId) {
      setSelectedConversation(null);
      setSelectedTicket(null);
      setActiveTicketId(null);
      return;
    }

    // Find conversation in current list
    const conversation = conversations.find(c => String(c.patientId) === String(patientId));
    setSelectedConversation(conversation || null);
    setSelectedTicket(item || null);

    // Determine the active ticket ID (for sending messages/actions)
    // Priority: Ongoing > Open > latest closed ticket
    let ticketId = null;
    if (item?.tickets && item.tickets.length > 0) {
      const ongoingTicket = item.tickets.find(t => t.status === 'Ongoing');
      const pendingTicket = item.tickets.find(t => t.status === 'Open');
      // Find the latest ticket overall
      const sortedTickets = [...item.tickets].sort((a, b) => {
        const aTime = new Date(a.session_start || 0);
        const bTime = new Date(b.session_start || 0);
        return bTime - aTime;
      });
      ticketId = ongoingTicket?.id || pendingTicket?.id || sortedTickets[0]?.id;
    } else if (conversation?.latestTicket) {
      ticketId = conversation.latestTicket.id;
    }
    setActiveTicketId(ticketId);

    // Mark as read immediately when opening
    markConversationAsRead(patientId);

    // Load ALL messages for this patient (across all their tickets)
    try {
      setMessagesLoading(true);
      const fetchedMessages = await getPatientMessages(Number(patientId));
      setMessages(fetchedMessages || []);
    } catch (err) {
      console.error('[HealthChatContext] Failed to load patient messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  }, [selectedPatientId, tickets, conversations, markConversationAsRead]);

  /**
   * Add a new message to the current conversation
   * Works with both chatId and patientId for socket events
   */
  const addMessage = useCallback((chatIdOrPatientId, message) => {
    console.log('[HealthChatContext] addMessage called:', {
      chatIdOrPatientId,
      messageId: message?.id,
      selectedPatientId,
      selectedChatId
    });

    // Check if this message belongs to the currently selected patient
    // Socket may send chatId, but we now organize by patientId
    const ticket = tickets.find(t =>
      String(t.id) === String(chatIdOrPatientId) ||
      t.tickets?.some(sub => String(sub.id) === String(chatIdOrPatientId))
    );

    const isCurrentPatient = ticket &&
      (String(ticket.patientId) === String(selectedPatientId) ||
       String(chatIdOrPatientId) === String(selectedPatientId));

    if (isCurrentPatient) {
      setMessages(prev => {
        // Check if message already exists in array
        if (prev.some(m => String(m.id) === String(message.id))) {
          console.log('[HealthChatContext] ⚠️ Message already exists in state, skipping:', message.id);
          return prev;
        }
        console.log('[HealthChatContext] ✅ Adding message to state:', message.id);
        return [...prev, message];
      });
    }
  }, [selectedPatientId, selectedChatId, tickets]);

  /**
   * Update a ticket's status
   */
  const updateTicketStatus = useCallback((chatId, newStatus) => {
    setTickets(prev => prev.map(t =>
      String(t.id) === String(chatId) ? { ...t, status: newStatus } : t
    ));
    if (String(chatId) === String(selectedChatId)) {
      setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
    }
  }, [selectedChatId]);

  /**
   * Add a new ticket (from socket event)
   */
  const addTicket = useCallback((ticket) => {
    if (filter === 'pending' && ticket.status === 'Open') {
      setTickets(prev => [ticket, ...prev]);
      setTicketsTotal(prev => prev + 1);
    } else if (filter === 'active' && ticket.status === 'Ongoing') {
      setTickets(prev => [ticket, ...prev]);
      setTicketsTotal(prev => prev + 1);
    }
  }, [filter]);

  /**
   * Remove a ticket from list (e.g., when approved moves from pending to active)
   */
  const removeTicket = useCallback((chatId) => {
    setTickets(prev => prev.filter(t => String(t.id) !== String(chatId)));
    setTicketsTotal(prev => Math.max(0, prev - 1));
    if (String(chatId) === String(selectedChatId)) {
      setSelectedChatId(null);
      setSelectedTicket(null);
      setMessages([]);
    }
  }, [selectedChatId]);

  /**
   * Update typing indicator
   */
  const setUserTyping = useCallback((chatId, userId, isTyping) => {
    setTypingUsers(prev => ({
      ...prev,
      [chatId]: isTyping ? { userId, isTyping: true } : null
    }));
  }, []);

  /**
   * Approve a ticket
   */
  const approveTicket = useCallback(async (chatId, notes = null) => {
    try {
      const result = await approveTicketService(chatId, notes);
      if (result.success && result.chat) {
        // Get the approved chat data
        const approvedChat = result.chat;

        // Always select the approved chat and load its messages
        // This ensures staff enters the chat after approval
        setSelectedChatId(approvedChat.id);
        setSelectedTicket(approvedChat);

        // Reload messages to show system approval message
        const fetchedMessages = await getMessages(chatId);
        setMessages(fetchedMessages || []);

        // Switch to active filter - this will trigger refreshTickets
        // which will fetch fresh data from backend including our approved ticket
        setFilter('active');

        // Manually add the approved ticket to ensure it appears immediately
        // This prevents a brief moment where the ticket isn't visible
        setTickets(prev => {
          const exists = prev.some(t => String(t.id) === String(approvedChat.id));
          if (exists) {
            return prev.map(t =>
              String(t.id) === String(approvedChat.id) ? approvedChat : t
            );
          }
          return [approvedChat, ...prev];
        });
      }
      return result;
    } catch (err) {
      console.error('[HealthChatContext] Failed to approve ticket:', err);
      throw err;
    }
  }, []);

  /**
   * Reject a ticket
   */
  const rejectTicket = useCallback(async (chatId, reason = null) => {
    try {
      const result = await rejectTicketService(chatId, reason);
      if (result.success) {
        removeTicket(chatId);
      }
      return result;
    } catch (err) {
      console.error('[HealthChatContext] Failed to reject ticket:', err);
      throw err;
    }
  }, [removeTicket]);

  /**
   * Send a message
   */
  const sendMessage = useCallback(async (chatId, text, filename = null, promptType = 'text') => {
    try {
      const result = await sendMessageService(chatId, text, filename, promptType);
      if (result.success && result.message) {
        addMessage(chatId, result.message);
      }
      return result;
    } catch (err) {
      console.error('[HealthChatContext] Failed to send message:', err);
      throw err;
    }
  }, [addMessage]);

  /**
   * Close a ticket
   */
  const closeTicket = useCallback(async (chatId, notes = null) => {
    try {
      const result = await closeTicketService(chatId, notes);
      if (result.success) {
        updateTicketStatus(chatId, 'Closed');
        // If on active tab, remove it
        if (filter === 'active') {
          removeTicket(chatId);
        }
        // Reload messages to show system message
        if (String(chatId) === String(selectedChatId)) {
          const fetchedMessages = await getMessages(chatId);
          setMessages(fetchedMessages || []);
        }
      }
      return result;
    } catch (err) {
      console.error('[HealthChatContext] Failed to close ticket:', err);
      throw err;
    }
  }, [updateTicketStatus, filter, removeTicket, selectedChatId]);

  /**
   * Delete an archived ticket (admin only)
   */
  const deleteTicket = useCallback(async (chatId) => {
    try {
      const result = await deleteArchivedTicketService(chatId);
      if (result.success) {
        // Remove from list
        removeTicket(chatId);
        // Deselect if it was selected
        if (String(chatId) === String(selectedChatId)) {
          setSelectedChatId(null);
          setSelectedTicket(null);
          setMessages([]);
        }
      }
      return result;
    } catch (err) {
      console.error('[HealthChatContext] Failed to delete ticket:', err);
      throw err;
    }
  }, [removeTicket, selectedChatId]);

  /**
   * Get filtered tickets by search term
   */
  const filteredTickets = searchTerm
    ? tickets.filter(t => {
        const name = `${t.patient?.firstName || ''} ${t.patient?.lastName || ''}`.toLowerCase();
        const purpose = (t.purpose || '').toLowerCase();
        const term = searchTerm.toLowerCase();
        return name.includes(term) || purpose.includes(term);
      })
    : tickets;

  const value = {
    // Patient Conversations (new patient-grouped approach)
    conversations,
    conversationsTotal,
    conversationsLoading,

    // Tickets (legacy compatibility - now contains patient-grouped data)
    tickets: filteredTickets,
    ticketsTotal,
    ticketsLoading,
    refreshTickets,

    // Selected patient/chat
    selectedPatientId,
    selectedConversation,
    selectedChatId, // Legacy
    selectedTicket,
    activeTicketId, // Actual ticket ID for sending messages/actions
    messages,
    messagesLoading,
    selectChat,
    refreshMessages,
    markConversationAsRead,

    // Typing
    typingUsers,
    setUserTyping,

    // Actions
    addMessage,
    addTicket,
    removeTicket,
    updateTicketStatus,
    approveTicket,
    rejectTicket,
    sendMessage,
    closeTicket,
    deleteTicket,

    // Filter
    filter,
    setFilter,
    selectedFilters,
    updateSelectedFilters,
    searchTerm,
    setSearchTerm,

    // Error & Socket
    error,
    setError,
    socketError,
    setSocketError
  };

  return (
    <HealthChatContext.Provider value={value}>
      {children}
    </HealthChatContext.Provider>
  );
}

/**
 * Hook to use health chat context
 */
export function useHealthChat() {
  const context = useContext(HealthChatContext);
  if (!context) {
    throw new Error('useHealthChat must be used within a HealthChatProvider');
  }
  return context;
}

export default HealthChatContext;
