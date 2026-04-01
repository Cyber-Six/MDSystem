import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageCircleHeart, Stethoscope } from 'lucide-react';
import ChatBox from './components/ChatBox';
import TicketDivider from './components/TicketDivider';
import TicketStatusBanner from './components/TicketStatusBanner';
import {
  getCurrentActiveTicket,
  getMostRecentTicket,
  getMyTickets,
  getTicketMessages,
  createTicket,
  sendMessage,
  closeTicket,
  extendSession
} from './health-chat-service';
import { useHealthChatSocket } from './hooks/use-health-chat-socket';

const HealthChat = () => {
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [previousTickets, setPreviousTickets] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [isStaffTyping, setIsStaffTyping] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [ticketPurpose, setTicketPurpose] = useState('');
  const [showCloseModal, setShowCloseModal]       = useState(false);
  const [isExtendingSession, setIsExtendingSession] = useState(false);

  const messagesEndRef = useRef(null);
  const previousConversationEndRef = useRef(null);
  const inputRef = useRef(null);
  const hasInitialized = useRef(false);

  // Load messages for a ticket (defined early for use in callbacks)
  const loadMessages = useCallback(async (chatId) => {
    try {
      const fetchedMessages = await getTicketMessages(chatId);
      setMessages(fetchedMessages || []);
    } catch (err) {
      console.error('[HealthChat] Failed to load messages:', err);
      setError('Failed to load messages.');
    }
  }, []);

  // Socket event handlers (must be defined before useHealthChatSocket)
  // Handle new message from socket
  const handleNewMessage = useCallback((newMessage) => {
    setMessages(prev => [...prev, newMessage]);
    // Clear typing indicator when message received
    setIsStaffTyping(false);
  }, []);

  // Handle typing indicator from socket
  const handleTypingIndicator = useCallback((isTyping) => {
    setIsStaffTyping(isTyping);
  }, []);

  // Handle ticket approved via socket
  const handleTicketApproved = useCallback((updatedTicket) => {
    console.log('[HealthChat] Ticket approved event received:', updatedTicket);
    setTicket(updatedTicket);
    // Reload messages in case there's a system message
    if (updatedTicket?.id) {
      loadMessages(updatedTicket.id);
    }
  }, [loadMessages]);

  // Handle ticket closed via socket
  const handleTicketClosed = useCallback((data) => {
    console.log('[HealthChat] Ticket closed event received:', data);
    setTicket(prev => {
      if (!prev) return null;
      // Prefer the full chat record from the event (has session_end, closedBy, etc.)
      // Fall back to merging individual fields so the divider shows correct info immediately.
      if (data?.chat) {
        return { ...prev, ...data.chat };
      }
      return {
        ...prev,
        status: 'Closed',
        closedBy: data?.closedBy || prev.closedBy || null,
        session_end: prev.session_end || new Date().toISOString(),
      };
    });
    // Reload messages to show system message
    if (data?.chatId) {
      loadMessages(data.chatId);
    }
  }, [loadMessages]);

  // Handle session-extended via socket (another party extended, or own extension confirmed)
  const handleSessionExtended = useCallback((data) => {
    console.log('[HealthChat] Session extended event received:', data);
    setTicket(prev => {
      if (!prev) return null;
      return {
        ...prev,
        expiresAt: data.expiresAt || prev.expiresAt,
        session_start: data.chat?.session_start || prev.session_start,
      };
    });
    if (data?.chatId) loadMessages(data.chatId);
  }, [loadMessages]);

  // Socket hook
  const { isConnected: isSocketConnected, socketError, emitTyping } = useHealthChatSocket({
    chatId: ticket?.id,
    chatStatus: ticket?.status,
    onNewMessage: handleNewMessage,
    onTyping: handleTypingIndicator,
    onTicketApproved: handleTicketApproved,
    onTicketClosed: handleTicketClosed,
    onSessionExtended: handleSessionExtended
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Auto-scroll previous conversation to bottom when displayed
  useEffect(() => {
    if (ticket && ['Closed', 'Expired'].includes(ticket.status) && messages.length > 0) {
      previousConversationEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, ticket]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    initializeHealthChat();
  }, []);

  // Poll for ticket status when pending (fallback for socket disconnection)
  useEffect(() => {
    // Only poll when ticket is pending (Open) and socket might not be connected
    if (!ticket?.id || ticket?.status !== 'Open') return;

    console.log('[HealthChat] Starting status polling for ticket:', ticket.id);

    const pollInterval = setInterval(async () => {
      try {
        const updatedTicket = await getCurrentActiveTicket();
        if (updatedTicket && updatedTicket.status !== 'Open') {
          // Ticket status changed! Update local state
          console.log('[HealthChat] Polling detected status change:', updatedTicket.status);
          setTicket(updatedTicket);
          if (updatedTicket.id) {
            await loadMessages(updatedTicket.id);
          }
        }
      } catch (err) {
        console.error('[HealthChat] Polling failed:', err);
      }
    }, 15000); // Poll every 15 seconds

    return () => {
      console.log('[HealthChat] Stopping status polling');
      clearInterval(pollInterval);
    };
  }, [ticket?.id, ticket?.status, loadMessages]);

  // Proactively freeze UI when the session's expiresAt time is reached
  useEffect(() => {
    if (ticket?.status !== 'Ongoing' || !ticket?.expiresAt) return;
    const msUntilExpiry = new Date(ticket.expiresAt).getTime() - Date.now();
    if (msUntilExpiry <= 0) {
      // Already past expiry — mark expired immediately
      setTicket(prev => prev ? { ...prev, status: 'Expired' } : null);
      return;
    }
    const timer = setTimeout(() => {
      setTicket(prev => prev ? { ...prev, status: 'Expired' } : null);
    }, msUntilExpiry);
    return () => clearTimeout(timer);
  }, [ticket?.id, ticket?.status, ticket?.expiresAt]);

  // Poll for new messages when socket is disconnected (fallback mechanism)
  useEffect(() => {
    // Only poll when socket is disconnected and ticket is active (Ongoing)
    if (!ticket?.id || ticket?.status !== 'Ongoing') return;
    if (isSocketConnected && !socketError) return; // Socket is working, no need to poll

    console.log('[HealthChat] Socket disconnected - starting message polling for ticket:', ticket.id);

    const pollInterval = setInterval(async () => {
      try {
        await loadMessages(ticket.id);
      } catch (err) {
        console.error('[HealthChat] Message polling failed:', err);
      }
    }, 10000); // Poll every 10 seconds

    return () => {
      console.log('[HealthChat] Stopping message polling');
      clearInterval(pollInterval);
    };
  }, [ticket?.id, ticket?.status, isSocketConnected, socketError, loadMessages]);

  async function initializeHealthChat() {
    try {
      setIsInitializing(true);
      setConnectionStatus('checking');
      setError(null);

      // First, try to get an active ticket
      const activeTicket = await getCurrentActiveTicket();
      if (activeTicket) {
        setTicket(activeTicket);
        await loadMessages(activeTicket.id);
        setConnectionStatus('connected');
        return;
      }

      // If no active ticket, load and show the most recent previous ticket
      const mostRecent = await getMostRecentTicket();
      if (mostRecent) {
        setTicket(mostRecent);
        await loadMessages(mostRecent.id);
        setConnectionStatus('connected');
        return;
      }

      // If no active and no previous tickets, just show empty state
      setConnectionStatus('connected');
    } catch (err) {
      setError('Failed to load health chat. Please try again.');
      setConnectionStatus('error');
    } finally {
      setIsInitializing(false);
    }
  }

  // Refresh messages (manual refresh via HTTP when sockets fail)
  async function refreshMessages() {
    if (!ticket?.id) return;
    try {
      setError(null);
      await loadMessages(ticket.id);
    } catch (err) {
      setError('Failed to refresh messages. Please try again.');
    }
  }

  async function loadPreviousTickets() {
    try {
      const closedResult = await getMyTickets('Closed', 0, 10);
      const expiredResult = await getMyTickets('Expired', 0, 10);
      setPreviousTickets([
        ...(closedResult?.chats || []),
        ...(expiredResult?.chats || [])
      ]);
    } catch (err) {
      console.error('[HealthChat] Failed to load previous tickets:', err);
    }
  }

  async function handleCreateTicket(e) {
    e.preventDefault();
    if (!ticketPurpose.trim()) { setError('Please describe your health concern.'); return; }
    try {
      setIsLoading(true);
      setError(null);
      const result = await createTicket(ticketPurpose.trim());
      if (result.success && result.chat) {
        setTicket(result.chat);
        setMessages([]);
        setShowCreateForm(false);
        setTicketPurpose('');
        setConnectionStatus('connected');
        // Load any initial messages (like system messages)
        if (result.chat.id) {
          await loadMessages(result.chat.id);
        }
      } else {
        setError(result.message || 'Failed to create ticket.');
      }
    } catch (err) {
      setError(err.message || 'Failed to create ticket. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    const hasText = inputValue.trim().length > 0;
    const hasFile = attachedFile !== null;
    if (!hasText && !hasFile) return;
    if (!ticket?.id) return;
    try {
      setIsLoading(true);
      setError(null);
      emitTyping(false);
      if (hasFile) {
        const result = await sendMessage(ticket.id, null, attachedFile.fileId, 'file');
        if (result.success && result.message) setMessages(prev => [...prev, result.message]);
        setAttachedFile(null);
      }
      if (hasText) {
        const result = await sendMessage(ticket.id, inputValue.trim(), null, 'text');
        if (result.success && result.message) setMessages(prev => [...prev, result.message]);
        setInputValue('');
      }
    } catch (err) {
      // If the session expired server-side, update local state so the UI freezes
      if (err.message && /expired/i.test(err.message)) {
        setTicket(prev => prev ? { ...prev, status: 'Expired' } : null);
        if (ticket?.id) loadMessages(ticket.id);
      }
      setError(err.message || 'Failed to send message.');
    } finally {
      setIsLoading(false);
      // Refocus input after sending so user can continue typing
      // Use double requestAnimationFrame for reliable focus after state updates
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      });
    }
  }

  async function handleCloseTicket() {
    if (!ticket?.id) return;
    setShowCloseModal(false);
    try {
      setIsLoading(true);
      const result = await closeTicket(ticket.id);
      if (result.success) {
        setTicket(prev => prev ? { ...prev, status: 'Closed' } : null);
        await loadMessages(ticket.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to close ticket.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExtendSession() {
    if (!ticket?.id || isExtendingSession) return;
    try {
      setIsExtendingSession(true);
      setError(null);
      const result = await extendSession(ticket.id);
      if (result.success && result.chat) {
        setTicket(prev => prev ? {
          ...prev,
          expiresAt: result.chat.expiresAt,
          session_start: result.chat.session_start,
        } : null);
        await loadMessages(ticket.id);
      } else {
        setError(result.message || 'Failed to extend session.');
      }
    } catch (err) {
      setError(err.message || 'Failed to extend session.');
    } finally {
      setIsExtendingSession(false);
    }
  }

  // Handle canceling pending ticket
  async function handleCancelTicket() {
    if (!ticket?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await closeTicket(ticket.id);

      if (result.success) {
        // Clear the ticket and messages
        setTicket(null);
        setMessages([]);
        // Load previous tickets
        await loadPreviousTickets();
      } else {
        setError(result.message || 'Failed to cancel request.');
      }
    } catch (err) {
      console.error('[HealthChat] Cancel ticket failed:', err);
      setError(err.message || 'Failed to cancel request.');
    } finally {
      setIsLoading(false);
    }
  }

  // Handle input change with typing indicator
  function handleInputChange(e) {
    setInputValue(e.target.value);
    if (e.target.value.trim()) emitTyping(true);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  // Check if we should show create form
  // Don't show during initialization to prevent flash
  const shouldShowCreateForm = !isInitializing && (!ticket || ['Closed', 'Expired'].includes(ticket?.status));

  return (
    <div className="max-w-2xl mx-auto px-4 font-sans">

      {/* ── Page Header ── */}
      <div className="relative rounded-2xl overflow-hidden mb-6 bg-primary-500">
        <div className="flex items-center gap-4 px-7 py-6">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.3)' }}
          >
            <MessageCircleHeart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-2xl m-0 leading-tight" style={{ color: '#ffffff' }}>
              Health Chat
            </h1>
            <p className="text-sm mt-0.5 m-0" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Talk to our medical team, anytime
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-8">
        {/* Loading state during initialization */}
        {isInitializing && (
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-12">
            <div className="flex flex-col items-center justify-center text-neutral-500">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm">Loading health chat...</p>
            </div>
          </div>
        )}

        {/* Create Ticket Form - Show when no active ticket or ticket is closed */}
        {shouldShowCreateForm && !showCreateForm && (
          <div
            className="rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
            style={{
              boxShadow: '0 4px 16px rgba(28,25,23,0.06)'
            }}
          >
            {/* Previous conversation preview */}
            {ticket && ['Closed', 'Expired'].includes(ticket.status) && (
              <div className="p-3 border-b border-neutral-200 dark:border-neutral-700">
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-2">
                  Previous conversation
                </p>
                <div
                  className="max-h-52 overflow-y-auto space-y-2 rounded-xl p-3 bg-neutral-50 dark:bg-neutral-800/50 flex flex-col"
                >
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex flex-col">
                      {msg.promptType === 'system' ? (
                        <div className="flex justify-center py-1.5 px-4">
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400">
                            {msg.text}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className={`flex gap-2 ${msg.userType === 'Patient' ? 'flex-row-reverse' : 'flex-row'} items-end max-w-[85%] ${msg.userType === 'Patient' ? 'self-end' : 'self-start'}`}>
                            {msg.userType === 'Patient' ? (
                              <div
                                className="px-3 py-1.5 text-sm leading-relaxed whitespace-pre-wrap text-secondary-900"
                                style={{
                                  background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
                                  borderRadius: '18px 18px 4px 18px',
                                  boxShadow: '0 2px 8px rgba(244,196,48,0.25)'
                                }}
                              >
                                {msg.text}
                              </div>
                            ) : (
                              <div
                                className="px-3 py-1.5 text-sm leading-relaxed whitespace-pre-wrap bg-white dark:bg-neutral-800 text-secondary-800 dark:text-neutral-100 border-[1.5px] border-neutral-200 dark:border-neutral-700 shadow-sm"
                                style={{ borderRadius: '18px 18px 18px 4px' }}
                              >
                                {msg.text}
                              </div>
                            )}
                          </div>
                          <span className={`text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 ${msg.userType === 'Patient' ? 'self-end' : 'self-start'}`}>
                            {formatTime(msg.stamp)}
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                  <div ref={previousConversationEndRef} />
                </div>
                <TicketDivider
                  closedAt={ticket.session_end}
                  closedBy={ticket.closedBy || (ticket.status === 'Expired' ? 'System' : 'Unknown')}
                />
              </div>
            )}

            {/* CTA */}
            <div className="p-7 text-center">
              <div
                className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ background: 'rgba(244,196,48,0.12)', border: '1.5px solid rgba(244,196,48,0.25)' }}
              >
                <Stethoscope className="w-7 h-7 text-primary-500" />
              </div>
              <p className="font-heading font-semibold text-secondary-800 dark:text-white text-lg mb-1">
                {ticket ? 'Start a new consultation' : 'Need to talk to our medical team?'}
              </p>
              <p className="text-sm text-neutral-500 mb-6">
                Ask questions, share concerns — we're here to help.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2.5 px-7 py-3 rounded-full font-medium text-sm
                           text-secondary-900 transition-all duration-200
                           hover:brightness-105 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
                  boxShadow: '0 4px 14px rgba(244,196,48,0.35)'
                }}
              >
                <Plus className="w-4 h-4" />
                {ticket ? 'New Consultation' : 'Start Health Chat'}
              </button>
            </div>
          </div>
        )}

        {/* Create ticket form */}
        {shouldShowCreateForm && showCreateForm && (
          <div
            className="rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
            style={{
              boxShadow: '0 4px 16px rgba(28,25,23,0.06)'
            }}
          >
            {/* Form header */}
            <div
              className="px-6 py-5 border-b border-neutral-200 dark:border-neutral-700"
            >
              <h3 className="font-heading font-semibold text-secondary-800 dark:text-white text-base m-0">
                Tell us what's on your mind
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5 m-0">
                Be as detailed as you'd like — the more context, the better we can help.
              </p>
            </div>

            <div className="p-6">
              <form onSubmit={handleCreateTicket}>
                <div className="mb-5">
                  <textarea
                    value={ticketPurpose}
                    onChange={(e) => setTicketPurpose(e.target.value)}
                    placeholder="e.g. I've had a headache for 3 days and it's not getting better..."
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-secondary-800 dark:text-white
                               placeholder-neutral-400 resize-none transition-all duration-200
                               focus:outline-none bg-neutral-100 dark:bg-neutral-800
                               border border-neutral-200 dark:border-neutral-700
                               focus:border-primary-500 dark:focus:border-primary-400
                               focus:shadow-lg focus:shadow-primary-500/10"
                    style={{
                      minHeight: '90px',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#f4c430';
                      e.target.style.boxShadow = '0 0 0 3px rgba(244,196,48,0.12)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '';
                      e.target.style.boxShadow = 'none';
                    }}
                    rows={4}
                    disabled={isLoading}
                  />
                  {/* Character feel — helpful hint */}
                  <p className="text-xs text-neutral-400 mt-2 text-right">
                    {ticketPurpose.length > 0 ? `${ticketPurpose.length} characters` : 'Tip: include duration, severity, and any relevant history'}
                  </p>
                </div>

                {error && (
                  <div
                    className="mb-4 px-4 py-3 rounded-xl flex items-center gap-2.5 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
                  >
                    <span className="w-4 h-4 flex-shrink-0">⚠</span>
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowCreateForm(false); setTicketPurpose(''); setError(null); }}
                    disabled={isLoading}
                    className="flex-1 py-2.5 rounded-full text-sm font-medium text-neutral-600 dark:text-neutral-300
                               transition-all duration-150 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50
                               border border-neutral-300 dark:border-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !ticketPurpose.trim()}
                    className="flex-[2] py-2.5 rounded-full text-sm font-semibold text-secondary-900
                               transition-all duration-200 hover:brightness-105 active:scale-95
                               disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                               flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
                      boxShadow: ticketPurpose.trim() ? '0 4px 14px rgba(244,196,48,0.35)' : 'none'
                    }}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-secondary-800/40 border-t-secondary-800 rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Send Request →'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Chat Box - Show when ticket exists and is active (Open or Ongoing) */}
        {!isInitializing && ticket && ['Open', 'Ongoing'].includes(ticket.status) && (
          <div className="space-y-4">
            {/* Status Banner */}
            <TicketStatusBanner
              status={ticket.status}
              onCancel={handleCancelTicket}
              isLoading={isLoading}
            />

            {/* Chat Interface */}
            <div className="h-[600px] rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700 shadow-lg bg-white dark:bg-neutral-900">
              <ChatBox
                messages={messages}
                isLoading={isLoading}
                isInitializing={isInitializing}
                connectionStatus={connectionStatus}
                error={error}
                inputValue={inputValue}
                inputRef={inputRef}
                messagesEndRef={messagesEndRef}
                onInputChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onSubmit={handleSendMessage}
                onCloseTicket={handleCloseTicket}
                onOpenCloseModal={() => setShowCloseModal(true)}
                showCloseModal={showCloseModal}
                onCancelCloseModal={() => setShowCloseModal(false)}
                formatTime={formatTime}
                onRetry={initializeHealthChat}
                onRefresh={refreshMessages}
                ticketStatus={ticket.status}
                ticketPurpose={ticket.purpose}
                ticketCreatedAt={ticket.session_start}
                isStaffTyping={isStaffTyping}
                attachedFile={attachedFile}
                onFileStaged={setAttachedFile}
                onFileRemoved={() => setAttachedFile(null)}
                isSocketConnected={isSocketConnected}
                socketError={socketError}
                onOpenMedicineRequest={() => navigate('/medicine-request')}
                expiresAt={ticket.expiresAt}
                isExtendingSession={isExtendingSession}
                onExtendSession={handleExtendSession}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default HealthChat;
