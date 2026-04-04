import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
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
  deleteArchivedTicket as deleteArchivedTicketService,
  extendSession as extendSessionService,
  transferTicket as transferTicketService,
  takeoverOngoingTicket as takeoverOngoingTicketService
} from '../health-chat-service';
import { usePermissions } from '../../../context/permissions-context';

const HealthChatContext = createContext(null);

/**
 * Get the effective timestamp for chronological sorting based on ticket status.
 * Always returns the most recent relevant timestamp so items sort newest-first.
 * - Pending (Open): last message time or session start
 * - Active (Ongoing): last message activity time or session start
 * - Archive (Closed/Expired): close/archive time or last message time
 */
function getEffectiveSortTime(status, lastMessageAt, sessionStart, sessionEnd, archivedAt) {
  if (status === 'Open') return lastMessageAt || sessionStart || archivedAt;
  if (status === 'Closed' || status === 'Expired') return sessionEnd || archivedAt || lastMessageAt || sessionStart;
  return lastMessageAt || sessionStart;
}

/**
 * Health Chat Provider
 * Manages state for the staff health chat interface
 * Uses patient-grouped conversations (1 patient = 1 row in the list)
 */
export function HealthChatProvider({ children }) {
  // Admin status from permissions context
  const { isAdmin } = usePermissions();

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
  // Ref to avoid readTimestamps in useCallback dependencies (prevents API re-fetch on every chat open)
  const readTimestampsRef = useRef(readTimestamps);
  useEffect(() => { readTimestampsRef.current = readTimestamps; }, [readTimestamps]);

  // Ref that always mirrors tickets state — used by addTicket to detect existing patients
  // without capturing tickets as a closure dependency (would cause stale value issues)
  const ticketsRef = useRef([]);
  useEffect(() => { ticketsRef.current = tickets; }, [tickets]);

  // Typing indicators (patientId -> { userId, isTyping })
  const [typingUsers, setTypingUsers] = useState({});

  // Needs-reply tracking (patientId -> true when patient sent last msg and staff hasn't replied)
  const [needsReplyChats, setNeedsReplyChats] = useState(() => {
    try {
      const saved = localStorage.getItem('health-chat-needs-reply');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });



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
  const [isExtendingSession, setIsExtendingSession] = useState(false);

  /**
   * Refresh messages for current patient (manual refresh via HTTP)
   */
  const refreshMessages = useCallback(async () => {
    if (!selectedPatientId) return;

    try {
      setMessagesLoading(true);
      setError(null);
      const fetchedMessages = await getPatientMessages(Number(selectedPatientId), { limit: 50 });
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
        const currentReadTimestamps = readTimestampsRef.current;
        const conversationsWithReadState = result.conversations.map(conv => {
          const readTimestamp = currentReadTimestamps[conv.patientId];
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

        // Sort by effective time: pending uses creation time, active uses last message time
        conversationsWithReadState.sort((a, b) => {
          const aTime = getEffectiveSortTime(
            a.latestTicket?.status, a.lastMessageAt,
            a.latestTicket?.session_start, a.latestTicket?.session_end, a.latestTicket?.archived_at
          );
          const bTime = getEffectiveSortTime(
            b.latestTicket?.status, b.lastMessageAt,
            b.latestTicket?.session_start, b.latestTicket?.session_end, b.latestTicket?.archived_at
          );
          const aMs = aTime ? new Date(aTime).getTime() : 0;
          const bMs = bTime ? new Date(bTime).getTime() : 0;
          if (aMs !== bMs) return bMs - aMs;

          // Fallback: ticket ID desc (higher = newer)
          return Number(b.latestTicket?.id || 0) - Number(a.latestTicket?.id || 0);
        });

        setConversations(conversationsWithReadState);
        setConversationsTotal(result.total || 0);

        // Also populate legacy tickets array for backward compatibility
        // Transform conversations to ticket-like objects
        const now = Date.now();
        const ticketLikeItems = conversationsWithReadState.map(conv => {
          const rawStatus = conv.latestTicket?.status;
          // Treat as Expired client-side if expiresAt has passed even if DB hasn't flipped yet
          const effectiveStatus =
            rawStatus === 'Ongoing' && conv.latestTicket?.expiresAt && new Date(conv.latestTicket.expiresAt).getTime() < now
              ? 'Expired'
              : rawStatus;
          return {
            id: conv.patientId, // Use patientId as the ID for selection
            patientId: conv.patientId,
            patient: conv.patient,
            purpose: conv.latestTicket?.purpose,
            status: effectiveStatus,
            medicalId: conv.latestTicket?.medicalId,
            medical: conv.latestTicket?.medical,
            session_start: conv.latestTicket?.session_start,
            session_end: conv.latestTicket?.session_end,
            archived_at: conv.latestTicket?.archived_at,
            expiresAt: conv.latestTicket?.expiresAt,
            closedBy: conv.latestTicket?.closedBy,
            lastMessage: conv.lastMessage,
            lastMessageAt: conv.lastMessageAt,
            unreadCount: conv.unreadCount,
            activeTicketCount: conv.activeTicketCount,
            totalTicketCount: conv.totalTicketCount,
            tickets: conv.tickets, // Array of all tickets for this patient
            _isConversation: true // Flag to identify this is a patient conversation
          };
        });

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
  }, []); // No deps — uses readTimestampsRef for stable identity

  /**
   * Update selected filters and persist to localStorage
   */
  const updateSelectedFilters = useCallback((newFilters) => {
    setSelectedFilters(newFilters);
    localStorage.setItem('health-chat-selected-filters', JSON.stringify(newFilters));
    // Do NOT call refreshMultipleFilters here — the useEffect below handles it
    // to avoid a double-fetch race condition.
  }, []);

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
      } else if (!ticketsLoading) {
        // Ticket not found in the current filter set (e.g., archive unchecked while viewing
        // a closed ticket) — clear the selection so the panel doesn't show stale data.
        // Guard with !ticketsLoading to avoid clearing during a mid-refresh render cycle.
        setSelectedPatientId(null);
        setSelectedChatId(null);
        setSelectedTicket(null);
        setSelectedConversation(null);
        setActiveTicketId(null);
        setMessages([]);
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
    // Update the ref synchronously so any concurrent refreshMultipleFilters call
    // (e.g. triggered by a socket event in the same tick) sees the latest read time
    // rather than waiting for the useEffect to sync it after the next render.
    readTimestampsRef.current = { ...readTimestampsRef.current, [patientId]: now };
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
   * Mark a chat as needing a reply (patient sent last message, staff hasn't replied)
   */
  const markNeedsReply = useCallback((patientId, needs) => {
    setNeedsReplyChats(prev => {
      const updated = { ...prev };
      if (needs) {
        updated[patientId] = true;
      } else {
        delete updated[patientId];
      }
      localStorage.setItem('health-chat-needs-reply', JSON.stringify(updated));
      return updated;
    });
  }, []);

  /**
   * Mark a ticket as closed (updates status in-place, stays in list)
   */
  const markTicketClosed = useCallback((chatId, patientId, closedBy) => {
    // Update ticket status to Closed immediately
    setTickets(prev => prev.map(t => {
      if (String(t.patientId) === String(patientId) ||
          t.tickets?.some(sub => String(sub.id) === String(chatId))) {
        const updatedTickets = t.tickets?.map(sub =>
          String(sub.id) === String(chatId) ? { ...sub, status: 'Closed', closedBy } : sub
        );
        return { ...t, status: 'Closed', closedBy, tickets: updatedTickets || t.tickets };
      }
      return t;
    }));

    // Update selectedTicket if currently viewing
    if (selectedTicket && (
      String(selectedTicket.patientId) === String(patientId) ||
      selectedTicket.tickets?.some(sub => String(sub.id) === String(chatId))
    )) {
      setSelectedTicket(prev => prev ? { ...prev, status: 'Closed', closedBy } : null);
    }
  }, [selectedTicket]);

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

    // When leaving the current chat, update read timestamp so messages seen are marked as read
    if (selectedPatientId) {
      markConversationAsRead(selectedPatientId);
    }

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
      const fetchedMessages = await getPatientMessages(Number(patientId), { limit: 50 });
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
          return prev;
        }
        return [...prev, message];
      });
    }
  }, [selectedPatientId, tickets]);

  /**
   * Update conversation list when a new message arrives (for unread indicator + reordering)
   * This updates lastMessage, lastMessageAt, unreadCount on the ticket in the list
   * and re-sorts the list so the most recent conversation is at the top.
   */
  const updateConversationForNewMessage = useCallback((chatId, message, senderType) => {
    setTickets(prev => {
      // Find the ticket that contains this chatId (could be ticket ID or sub-ticket ID)
      const idx = prev.findIndex(t =>
        String(t.id) === String(chatId) ||
        t.tickets?.some(sub => String(sub.id) === String(chatId))
      );
      if (idx === -1) return prev;

      const ticket = prev[idx];
      const isCurrentlySelected = String(ticket.patientId) === String(selectedPatientId);

      const updated = {
        ...ticket,
        lastMessage: {
          id: message.id,
          text: message.promptType === 'file' ? '📎 Sent a file' : message.text,
          stamp: message.stamp,
          userType: message.userType || senderType,
          promptType: message.promptType
        },
        lastMessageAt: message.stamp
      };

      // Increment unread count only if this is a Patient message and staff is NOT viewing this patient
      if (senderType === 'Patient' && !isCurrentlySelected) {
        updated.unreadCount = (ticket.unreadCount || 0) + 1;
      }

      // If patient sends message while staff is viewing, mark as needs-reply
      // and update read timestamp so it's not shown as unread when staff leaves
      if (senderType === 'Patient' && isCurrentlySelected) {
        markNeedsReply(ticket.patientId, true);
        markConversationAsRead(ticket.patientId);
      }

      // If staff sends a message, clear needs-reply status
      if (senderType === 'Medical') {
        markNeedsReply(ticket.patientId, false);
      }

      const newArr = [...prev];
      newArr[idx] = updated;

      // Re-sort by effective time (status-aware)
      newArr.sort((a, b) => {
        const aTime = getEffectiveSortTime(a.status, a.lastMessageAt, a.session_start, a.session_end, a.archived_at);
        const bTime = getEffectiveSortTime(b.status, b.lastMessageAt, b.session_start, b.session_end, b.archived_at);
        const aMs = aTime ? new Date(aTime).getTime() : 0;
        const bMs = bTime ? new Date(bTime).getTime() : 0;
        if (aMs !== bMs) return bMs - aMs;

        return Number(b.tickets?.[0]?.id || 0) - Number(a.tickets?.[0]?.id || 0);
      });

      return newArr;
    });

    // Also update conversations array to stay in sync
    // Use setTickets result to find patientId (avoid stale tickets closure)
    setConversations(prev => {
      // Re-read the latest tickets to find the patientId for this chatId
      let patientIdForChat = null;
      setTickets(currentTickets => {
        const t = currentTickets.find(item =>
          String(item.id) === String(chatId) ||
          item.tickets?.some(sub => String(sub.id) === String(chatId))
        );
        patientIdForChat = t?.patientId;
        return currentTickets; // No mutation
      });

      if (!patientIdForChat) return prev;

      const idx = prev.findIndex(c => String(c.patientId) === String(patientIdForChat));
      if (idx === -1) return prev;

      const isCurrentlySelected = String(patientIdForChat) === String(selectedPatientId);
      const updated = {
        ...prev[idx],
        lastMessage: {
          id: message.id,
          text: message.promptType === 'file' ? '📎 Sent a file' : message.text,
          stamp: message.stamp,
          userType: message.userType || senderType,
          promptType: message.promptType
        },
        lastMessageAt: message.stamp,
        unreadCount: (senderType === 'Patient' && !isCurrentlySelected)
          ? (prev[idx].unreadCount || 0) + 1
          : prev[idx].unreadCount
      };

      const newArr = [...prev];
      newArr[idx] = updated;

      newArr.sort((a, b) => {
        const aTime = getEffectiveSortTime(
          a.latestTicket?.status, a.lastMessageAt,
          a.latestTicket?.session_start, a.latestTicket?.session_end, a.latestTicket?.archived_at
        );
        const bTime = getEffectiveSortTime(
          b.latestTicket?.status, b.lastMessageAt,
          b.latestTicket?.session_start, b.latestTicket?.session_end, b.latestTicket?.archived_at
        );
        const aMs = aTime ? new Date(aTime).getTime() : 0;
        const bMs = bTime ? new Date(bTime).getTime() : 0;
        if (aMs !== bMs) return bMs - aMs;

        return Number(b.latestTicket?.id || 0) - Number(a.latestTicket?.id || 0);
      });

      return newArr;
    });
  }, [selectedPatientId, markNeedsReply, markConversationAsRead]);

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
   * Uses selectedFilters (multi-filter) to determine visibility
   * Debounced to prevent rapid successive refreshes from multiple events
   */
  const addTicketDebounceRef = useRef(null);
  const addTicket = useCallback((ticket) => {
    const shouldShow =
      (selectedFilters.includes('pending') && ticket.status === 'Open') ||
      (selectedFilters.includes('active') && ticket.status === 'Ongoing') ||
      (selectedFilters.includes('archive') && ['Closed', 'Expired'].includes(ticket.status));

    if (!shouldShow) return;

    // If this ticket belongs to a patient already in the list, update in-place instead
    // of triggering a full API refresh. A full refresh causes:
    //   (a) the list to flicker/re-order unexpectedly after an accept
    //   (b) server unread counts to overwrite locally-zeroed read state
    const existingEntry = ticketsRef.current.find(t =>
      String(t.patientId) === String(ticket.patientId) ||
      t.tickets?.some(sub => String(sub.id) === String(ticket.id))
    );

    if (existingEntry) {
      // Check whether this is a genuinely new ticket for an existing patient
      // (e.g. patient had a closed chat and opened a new one) vs a status-only update
      // on a ticket we already know about.
      const ticketAlreadyTracked = existingEntry.tickets?.some(
        sub => String(sub.id) === String(ticket.id)
      );

      setTickets(prev => {
        const updated = prev.map(t => {
          const isTarget =
            String(t.patientId) === String(ticket.patientId) ||
            t.tickets?.some(sub => String(sub.id) === String(ticket.id));
          if (!isTarget) return t;

          let updatedSubTickets;
          if (ticketAlreadyTracked) {
            // Known sub-ticket — just flip its status
            updatedSubTickets = t.tickets?.map(sub =>
              String(sub.id) === String(ticket.id) ? { ...sub, status: ticket.status } : sub
            );
          } else {
            // New ticket for an existing patient — prepend it so it becomes the latest
            const newSub = {
              id: ticket.id,
              status: ticket.status,
              purpose: ticket.purpose,
              session_start: ticket.session_start,
              session_end: ticket.session_end,
              expiresAt: ticket.expiresAt,
              closedBy: ticket.closedBy,
            };
            updatedSubTickets = [newSub, ...(t.tickets || [])];
          }

          return {
            ...t,
            status: ticket.status,
            lastMessage: ticket.lastMessage || t.lastMessage,
            lastMessageAt: ticket.lastMessageAt || ticket.session_start || new Date().toISOString(),
            tickets: updatedSubTickets || t.tickets,
          };
        });

        // Re-sort so this patient floats to the top
        updated.sort((a, b) => {
          const aTime = getEffectiveSortTime(a.status, a.lastMessageAt, a.session_start, a.session_end, a.archived_at);
          const bTime = getEffectiveSortTime(b.status, b.lastMessageAt, b.session_start, b.session_end, b.archived_at);
          return (bTime ? new Date(bTime).getTime() : 0) - (aTime ? new Date(aTime).getTime() : 0);
        });

        return updated;
      });

      setConversations(prev => prev.map(c => {
        if (String(c.patientId) !== String(existingEntry.patientId)) return c;

        let updatedSubTickets;
        if (ticketAlreadyTracked) {
          updatedSubTickets = c.tickets?.map(sub =>
            String(sub.id) === String(ticket.id) ? { ...sub, status: ticket.status } : sub
          );
        } else {
          const newSub = {
            id: ticket.id,
            status: ticket.status,
            purpose: ticket.purpose,
            session_start: ticket.session_start,
            session_end: ticket.session_end,
            expiresAt: ticket.expiresAt,
            closedBy: ticket.closedBy,
          };
          updatedSubTickets = [newSub, ...(c.tickets || [])];
        }

        const latestTicket = c.latestTicket && String(c.latestTicket.id) === String(ticket.id)
          ? { ...c.latestTicket, status: ticket.status }
          : ticketAlreadyTracked
            ? c.latestTicket
            : { id: ticket.id, status: ticket.status, purpose: ticket.purpose,
                session_start: ticket.session_start, expiresAt: ticket.expiresAt };
        return { ...c, tickets: updatedSubTickets || c.tickets, latestTicket };
      }));
      return; // No full refresh needed
    }

    // Genuinely new patient — debounce a full refresh so rapid back-to-back events
    // are batched into a single network call
    if (addTicketDebounceRef.current) {
      clearTimeout(addTicketDebounceRef.current);
    }
    addTicketDebounceRef.current = setTimeout(() => {
      refreshMultipleFilters(selectedFilters);
      addTicketDebounceRef.current = null;
    }, 500);
  }, [selectedFilters, refreshMultipleFilters]);

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
        const approvedChat = result.chat;

        // Set the active ticket ID to the approved chat
        setActiveTicketId(approvedChat.id);

        // Set selected patient based on the full chat data
        const patientId = approvedChat.patientId;
        if (patientId) {
          setSelectedPatientId(patientId);
          setSelectedChatId(patientId); // Legacy
        }

        setSelectedTicket(approvedChat);

        // Fetch latest messages using patient messages endpoint (paginated, latest 50)
        // This ensures we show the most recent messages and scroll to bottom
        if (patientId) {
          const fetchedMessages = await getPatientMessages(Number(patientId), { limit: 50 });
          setMessages(fetchedMessages || []);
        } else {
          const fetchedMessages = await getMessages(chatId);
          setMessages(fetchedMessages || []);
        }

        // Update the ticket in-place: change its status from Open to Ongoing
        // This avoids a full list refresh which causes redundant animations
        setTickets(prev => {
          const updated = prev.map(t => {
            const isTarget = String(t.patientId) === String(patientId) ||
              t.tickets?.some(sub => String(sub.id) === String(chatId));
            if (!isTarget) return t;

            const updatedTickets = t.tickets?.map(sub =>
              String(sub.id) === String(chatId) ? { ...sub, status: 'Ongoing' } : sub
            );
            return { ...t, status: 'Ongoing', tickets: updatedTickets || t.tickets };
          });

          // Re-sort by effective time
          updated.sort((a, b) => {
            const aTime = getEffectiveSortTime(a.status, a.lastMessageAt, a.session_start, a.session_end, a.archived_at);
            const bTime = getEffectiveSortTime(b.status, b.lastMessageAt, b.session_start, b.session_end, b.archived_at);
            const aMs = aTime ? new Date(aTime).getTime() : 0;
            const bMs = bTime ? new Date(bTime).getTime() : 0;
            if (aMs !== bMs) return bMs - aMs;
            return Number(b.tickets?.[0]?.id || 0) - Number(a.tickets?.[0]?.id || 0);
          });

          return updated;
        });

        // Also update conversations array in-place
        setConversations(prev => {
          const updated = prev.map(c => {
            if (String(c.patientId) !== String(patientId)) return c;
            const updatedTickets = c.tickets?.map(sub =>
              String(sub.id) === String(chatId) ? { ...sub, status: 'Ongoing' } : sub
            );
            const latestTicket = c.latestTicket && String(c.latestTicket.id) === String(chatId)
              ? { ...c.latestTicket, status: 'Ongoing' }
              : c.latestTicket;
            return { ...c, tickets: updatedTickets || c.tickets, latestTicket };
          });
          return updated;
        });

        // Ensure 'active' filter is included so the approved ticket stays visible
        if (!selectedFilters.includes('active')) {
          const targetFilters = [...selectedFilters, 'active'];
          setSelectedFilters(targetFilters);
          localStorage.setItem('health-chat-selected-filters', JSON.stringify(targetFilters));
          // Only do a full refresh when we actually need to change filters
          refreshMultipleFilters(targetFilters);
        }
      }
      return result;
    } catch (err) {
      console.error('[HealthChatContext] Failed to approve ticket:', err);
      throw err;
    }
  }, [selectedFilters, refreshMultipleFilters]);

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
        // Clear needs-reply when staff sends a message
        if (selectedPatientId) {
          markNeedsReply(selectedPatientId, false);
        }
      }
      return result;
    } catch (err) {
      console.error('[HealthChatContext] Failed to send message:', err);
      throw err;
    }
  }, [addMessage, selectedPatientId, markNeedsReply]);

  /**
   * Close a ticket
   */
  const closeTicket = useCallback(async (chatId, notes = null) => {
    try {
      const result = await closeTicketService(chatId, notes);
      if (result.success) {
        // Find patientId for this chat
        const ticket = tickets.find(t =>
          String(t.id) === String(chatId) ||
          t.tickets?.some(sub => String(sub.id) === String(chatId))
        );
        const patientId = ticket?.patientId || selectedPatientId;

        // Mark as closed (status updates immediately, stays in list)
        if (patientId) {
          markTicketClosed(chatId, patientId, 'Staff');
        } else {
          updateTicketStatus(chatId, 'Closed');
        }

        // Reload messages to show system message
        if (selectedPatientId) {
          const fetchedMessages = await getPatientMessages(Number(selectedPatientId), { limit: 50 });
          setMessages(fetchedMessages || []);
        } else if (String(chatId) === String(selectedChatId)) {
          const fetchedMessages = await getMessages(chatId);
          setMessages(fetchedMessages || []);
        }
      }
      return result;
    } catch (err) {
      console.error('[HealthChatContext] Failed to close ticket:', err);
      throw err;
    }
  }, [updateTicketStatus, tickets, selectedPatientId, selectedChatId, markTicketClosed]);

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
   * Update the expiresAt for a ticket (called on healthchat:session-extended socket event)
   */
  const updateTicketExpiresAt = useCallback((chatId, expiresAt) => {
    const id = String(chatId);
    // Update legacy tickets list
    setTickets(prev => prev.map(t => String(t.id) === id ? { ...t, expiresAt } : t));
    // Update conversations (nested tickets array)
    setConversations(prev => prev.map(conv => ({
      ...conv,
      tickets: conv.tickets?.map(t => String(t.id) === id ? { ...t, expiresAt } : t),
    })));
    // Update selectedTicket if it's the same chat
    setSelectedTicket(prev => prev && String(prev.id) === id ? { ...prev, expiresAt } : prev);
  }, []);

  /**
   * Extend session for a ticket (+1 day)
   */
  const extendSessionChat = useCallback(async (chatId) => {
    if (!chatId || isExtendingSession) return;
    try {
      setIsExtendingSession(true);
      setError(null);
      const result = await extendSessionService(chatId);
      if (result.success && result.chat) {
        updateTicketExpiresAt(chatId, result.chat.expiresAt);
        // Reload messages to show the system message
        if (selectedPatientId) {
          const fetched = await getPatientMessages(Number(selectedPatientId), { limit: 50 });
          setMessages(fetched || []);
        } else if (String(chatId) === String(selectedChatId)) {
          const fetched = await getMessages(chatId);
          setMessages(fetched || []);
        }
      } else {
        setError(result.message || 'Failed to extend session.');
      }
      return result;
    } catch (err) {
      console.error('[HealthChatContext] Failed to extend session:', err);
      setError(err.message || 'Failed to extend session.');
      throw err;
    } finally {
      setIsExtendingSession(false);
    }
  }, [isExtendingSession, updateTicketExpiresAt, selectedPatientId, selectedChatId]);

  /**
   * Remove a conversation from the list (e.g., after transfer/takeover removes it from this staff)
   * Supports slide-out animation via a removing flag
   */
  const [removingPatientIds, setRemovingPatientIds] = useState(new Set());

  const removeConversation = useCallback((patientId) => {
    // Trigger slide-out animation first
    setRemovingPatientIds(prev => new Set([...prev, String(patientId)]));

    // After animation completes, actually remove from list
    setTimeout(() => {
      setTickets(prev => prev.filter(t => String(t.patientId) !== String(patientId)));
      setConversations(prev => prev.filter(c => String(c.patientId) !== String(patientId)));
      setRemovingPatientIds(prev => {
        const next = new Set(prev);
        next.delete(String(patientId));
        return next;
      });

      // If the removed conversation is currently selected, deselect
      if (String(selectedPatientId) === String(patientId)) {
        setSelectedPatientId(null);
        setSelectedChatId(null);
        setSelectedTicket(null);
        setSelectedConversation(null);
        setActiveTicketId(null);
        setMessages([]);
      }
    }, 300); // Match CSS animation duration
  }, [selectedPatientId]);

  /**
   * Transfer an ongoing ticket to another staff member
   */
  const transferTicket = useCallback(async (chatId, toMedicalId) => {
    try {
      const result = await transferTicketService(chatId, toMedicalId);
      if (result.success) {
        // If current user is no longer the assignee, remove the conversation
        // (The socket event will also trigger this for the previous staff)
        // Refresh to reflect the change
        await refreshMultipleFilters(selectedFilters);
        // Reload messages to show the system message
        if (selectedPatientId) {
          const fetchedMessages = await getPatientMessages(Number(selectedPatientId), { limit: 50 });
          setMessages(fetchedMessages || []);
        }
      }
      return result;
    } catch (err) {
      console.error('[HealthChatContext] Failed to transfer ticket:', err);
      throw err;
    }
  }, [selectedFilters, refreshMultipleFilters, selectedPatientId]);

  /**
   * Admin takeover: assume control of an ongoing ticket
   */
  const takeoverTicket = useCallback(async (chatId) => {
    try {
      const result = await takeoverOngoingTicketService(chatId);
      if (result.success && result.chat) {
        // Update the ticket locally to reflect new ownership
        const updatedChat = result.chat;
        setSelectedTicket(prev => prev ? { ...prev, medicalId: updatedChat.medicalId, medical: updatedChat.medical } : prev);

        // Refresh conversations and messages
        await refreshMultipleFilters(selectedFilters);
        if (selectedPatientId) {
          const fetchedMessages = await getPatientMessages(Number(selectedPatientId), { limit: 50 });
          setMessages(fetchedMessages || []);
        }
      }
      return result;
    } catch (err) {
      console.error('[HealthChatContext] Failed to takeover ticket:', err);
      throw err;
    }
  }, [selectedFilters, refreshMultipleFilters, selectedPatientId]);

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
    setMessages,
    selectChat,
    refreshMessages,
    markConversationAsRead,

    // Typing
    typingUsers,
    setUserTyping,

    // Needs-reply
    needsReplyChats,
    markNeedsReply,
    markTicketClosed,

    // Actions
    addMessage,
    addTicket,
    removeTicket,
    removeConversation,
    removingPatientIds,
    updateTicketStatus,
    updateConversationForNewMessage,
    approveTicket,
    rejectTicket,
    sendMessage,
    closeTicket,
    deleteTicket,
    transferTicket,
    takeoverTicket,
    extendSessionChat,
    isExtendingSession,
    updateTicketExpiresAt,

    // Admin & ownership
    isAdmin,

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
