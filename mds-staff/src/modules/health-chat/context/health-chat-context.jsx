import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  getPendingTickets,
  getActiveTickets,
  getArchivedTickets,
  getMessages,
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
 */
export function HealthChatProvider({ children }) {
  // Tickets state
  const [tickets, setTickets] = useState([]);
  const [ticketsTotal, setTicketsTotal] = useState(0);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Selected chat state
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Typing indicators (chatId -> { userId, isTyping })
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
   * Refresh messages for current chat (manual refresh via HTTP)
   */
  const refreshMessages = useCallback(async () => {
    if (!selectedChatId) return;

    try {
      setMessagesLoading(true);
      setError(null);
      const fetchedMessages = await getMessages(selectedChatId);
      setMessages(fetchedMessages || []);
    } catch (err) {
      console.error('[HealthChatContext] Failed to refresh messages:', err);
      setError(err.message || 'Failed to refresh messages');
    } finally {
      setMessagesLoading(false);
    }
  }, [selectedChatId]);

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
   * Load tickets from multiple selected filters and merge results
   */
  const refreshMultipleFilters = useCallback(async (filters) => {
    if (!filters || filters.length === 0) {
      setTickets([]);
      setTicketsTotal(0);
      return;
    }

    try {
      setTicketsLoading(true);
      setError(null);

      const allTickets = [];
      let totalCount = 0;

      // Fetch tickets from each selected filter
      for (const filterType of filters) {
        let result;
        switch (filterType) {
          case 'pending':
            result = await getPendingTickets(0, 100);
            break;
          case 'archive':
            result = await getArchivedTickets(0, 100);
            break;
          case 'active':
            result = await getActiveTickets(0, 100);
            break;
          default:
            continue;
        }

        if (result?.chats) {
          allTickets.push(...result.chats);
        }
        totalCount += result?.total || 0;
      }

      // Remove duplicates based on ID (in case of any overlap)
      const uniqueTickets = Array.from(
        new Map(allTickets.map(ticket => [ticket.id, ticket])).values()
      );

      setTickets(uniqueTickets);
      setTicketsTotal(totalCount);
    } catch (err) {
      console.error('[HealthChatContext] Failed to load tickets:', err);
      setError(err.message || 'Failed to load tickets');
    } finally {
      setTicketsLoading(false);
    }
  }, []);

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

  // Keep selectedTicket in sync with tickets list (e.g., after refresh)
  // This ensures the ticket data stays fresh when the list updates
  useEffect(() => {
    if (selectedChatId && tickets.length > 0) {
      const updatedTicket = tickets.find(t => String(t.id) === String(selectedChatId));
      if (updatedTicket) {
        // Update selectedTicket with fresh data from list
        setSelectedTicket(updatedTicket);
      }
      // Note: If ticket is not in list (e.g., wrong filter), we keep the existing selectedTicket
      // This allows viewing a chat even when it's not in the current filter
    }
  }, [tickets, selectedChatId]);

  /**
   * Select a chat and load its messages
   */
  const selectChat = useCallback(async (chatId) => {
    if (chatId === selectedChatId) return;

    setSelectedChatId(chatId);
    setMessages([]);

    if (!chatId) {
      setSelectedTicket(null);
      return;
    }

    // Find ticket in current list
    const ticket = tickets.find(t => String(t.id) === String(chatId));
    setSelectedTicket(ticket || null);

    // Load messages
    try {
      setMessagesLoading(true);
      const fetchedMessages = await getMessages(chatId);
      setMessages(fetchedMessages || []);
    } catch (err) {
      console.error('[HealthChatContext] Failed to load messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  }, [selectedChatId, tickets]);

  /**
   * Add a new message to the current chat
   */
  const addMessage = useCallback((chatId, message) => {
    console.log('[HealthChatContext] addMessage called:', {
      chatId,
      messageId: message?.id,
      selectedChatId,
      match: String(chatId) === String(selectedChatId)
    });
    if (String(chatId) === String(selectedChatId)) {
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
  }, [selectedChatId]);

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
    // Tickets
    tickets: filteredTickets,
    ticketsTotal,
    ticketsLoading,
    refreshTickets,

    // Selected chat
    selectedChatId,
    selectedTicket,
    messages,
    messagesLoading,
    selectChat,
    refreshMessages,

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
