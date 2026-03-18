import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import ChatBox from './components/ChatBox';
import TicketDivider from './components/TicketDivider';
import {
  getCurrentActiveTicket,
  getMyTickets,
  getTicketMessages,
  createTicket,
  sendMessage,
  closeTicket
} from './health-chat-service';
import { useHealthChatSocket } from './hooks/use-health-chat-socket';

const HealthChat = () => {
  // Ticket state
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [previousTickets, setPreviousTickets] = useState([]);

  // UI state
  const [inputValue, setInputValue] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [isStaffTyping, setIsStaffTyping] = useState(false);

  // Create ticket form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [ticketPurpose, setTicketPurpose] = useState('');

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const hasInitialized = useRef(false);
  const typingTimeoutRef = useRef(null);

  // Socket hook
  const { isConnected: isSocketConnected, emitTyping } = useHealthChatSocket({
    chatId: ticket?.id,
    chatStatus: ticket?.status,
    onNewMessage: handleNewMessage,
    onTyping: handleTypingIndicator,
    onTicketApproved: handleTicketApproved,
    onTicketClosed: handleTicketClosed
  });

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize on mount
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    initializeHealthChat();
  }, []);

  // Handle new message from socket
  function handleNewMessage(newMessage) {
    setMessages(prev => [...prev, newMessage]);
    // Clear typing indicator when message received
    setIsStaffTyping(false);
  }

  // Handle typing indicator from socket
  function handleTypingIndicator(isTyping) {
    setIsStaffTyping(isTyping);
  }

  // Handle ticket approved via socket
  function handleTicketApproved(updatedTicket) {
    setTicket(updatedTicket);
    // Reload messages in case there's a system message
    if (updatedTicket?.id) {
      loadMessages(updatedTicket.id);
    }
  }

  // Handle ticket closed via socket
  function handleTicketClosed(data) {
    setTicket(prev => prev ? { ...prev, status: 'Closed' } : null);
    // Reload messages to show system message
    if (data?.chatId) {
      loadMessages(data.chatId);
    }
  }

  // Initialize health chat - load existing ticket or show create form
  async function initializeHealthChat() {
    try {
      setIsInitializing(true);
      setConnectionStatus('checking');
      setError(null);

      // Get current active ticket
      const activeTicket = await getCurrentActiveTicket();

      if (activeTicket) {
        setTicket(activeTicket);
        await loadMessages(activeTicket.id);
        setConnectionStatus('connected');
      } else {
        // Load previous closed tickets for history
        await loadPreviousTickets();
        setConnectionStatus('connected');
        // If has previous tickets, show them with create button
        // If no tickets at all, show create form
      }
    } catch (err) {
      console.error('[HealthChat] Initialization failed:', err);
      setError('Failed to load health chat. Please try again.');
      setConnectionStatus('error');
    } finally {
      setIsInitializing(false);
    }
  }

  // Load messages for a ticket
  async function loadMessages(chatId) {
    try {
      const fetchedMessages = await getTicketMessages(chatId);
      setMessages(fetchedMessages);
    } catch (err) {
      console.error('[HealthChat] Failed to load messages:', err);
      setError('Failed to load messages.');
    }
  }

  // Load previous closed tickets
  async function loadPreviousTickets() {
    try {
      const closedResult = await getMyTickets('Closed', 0, 10);
      const expiredResult = await getMyTickets('Expired', 0, 10);
      setPreviousTickets([...closedResult.chats, ...expiredResult.chats]);
    } catch (err) {
      console.error('[HealthChat] Failed to load previous tickets:', err);
    }
  }

  // Handle creating a new ticket
  async function handleCreateTicket(e) {
    e.preventDefault();

    if (!ticketPurpose.trim()) {
      setError('Please describe your health concern.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await createTicket(ticketPurpose.trim());

      if (result.success && result.chat) {
        setTicket(result.chat);
        setMessages([]);
        setShowCreateForm(false);
        setTicketPurpose('');
      } else {
        setError(result.message || 'Failed to create ticket.');
      }
    } catch (err) {
      console.error('[HealthChat] Create ticket failed:', err);
      setError(err.message || 'Failed to create ticket. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  // Handle sending a message
  async function handleSendMessage(e) {
    e.preventDefault();

    const hasText = inputValue.trim().length > 0;
    const hasFile = attachedFile !== null;

    if (!hasText && !hasFile) return;
    if (!ticket?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      // Stop typing indicator
      emitTyping(false);

      if (hasFile) {
        // Send file message
        const result = await sendMessage(ticket.id, null, attachedFile.fileId, 'file');
        if (result.success && result.message) {
          setMessages(prev => [...prev, result.message]);
        }
        setAttachedFile(null);
      }

      if (hasText) {
        // Send text message
        const result = await sendMessage(ticket.id, inputValue.trim(), null, 'text');
        if (result.success && result.message) {
          setMessages(prev => [...prev, result.message]);
        }
        setInputValue('');
      }

      inputRef.current?.focus();
    } catch (err) {
      console.error('[HealthChat] Send message failed:', err);
      setError(err.message || 'Failed to send message.');
    } finally {
      setIsLoading(false);
    }
  }

  // Handle closing ticket
  async function handleCloseTicket() {
    if (!ticket?.id) return;

    const confirmed = window.confirm(
      'Are you sure you want to close this conversation? You can start a new one later.'
    );

    if (!confirmed) return;

    try {
      setIsLoading(true);
      const result = await closeTicket(ticket.id);

      if (result.success) {
        setTicket(prev => prev ? { ...prev, status: 'Closed' } : null);
        // Reload messages to show system message
        await loadMessages(ticket.id);
      }
    } catch (err) {
      console.error('[HealthChat] Close ticket failed:', err);
      setError(err.message || 'Failed to close conversation.');
    } finally {
      setIsLoading(false);
    }
  }

  // Handle input change with typing indicator
  function handleInputChange(e) {
    setInputValue(e.target.value);

    // Emit typing indicator
    if (e.target.value.trim()) {
      emitTyping(true);
    }
  }

  // Handle key down (Enter to send)
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  }

  // Format timestamp
  function formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Check if we should show create form
  const shouldShowCreateForm = !ticket || ['Closed', 'Expired'].includes(ticket?.status);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header Banner */}
      <div className="rounded-2xl p-6 mb-6 bg-primary-500">
        <div className="flex items-center gap-4">
          <div className="w-10 h-12 rounded-xl bg-white/25 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-heading font-bold text-white" style={{ margin: 0 }}>
              Health Chat
            </h1>
            <p className="text-white/80 text-sm mt-1" style={{ margin: 0 }}>
              Connect with our medical staff for health consultations
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-8">
        {/* Create Ticket Form - Show when no active ticket or ticket is closed */}
        {shouldShowCreateForm && !showCreateForm && (
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
            {/* Show previous conversation if exists */}
            {ticket && ['Closed', 'Expired'].includes(ticket.status) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-neutral-800 dark:text-white mb-4">
                  Previous Conversation
                </h3>
                <div className="max-h-[300px] overflow-y-auto space-y-3 mb-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`text-sm ${
                        msg.promptType === 'system'
                          ? 'text-center text-neutral-500'
                          : msg.userType === 'Patient'
                          ? 'text-right text-blue-600 dark:text-blue-400'
                          : 'text-left text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {msg.text}
                    </div>
                  ))}
                </div>
                <TicketDivider
                  closedAt={ticket.session_end}
                  closedBy={ticket.status === 'Expired' ? 'System' : 'Unknown'}
                />
              </div>
            )}

            <div className="text-center">
              <p className="text-neutral-600 dark:text-neutral-400 mb-4">
                {ticket ? 'Start a new consultation' : 'Need to speak with medical staff?'}
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg
                         hover:bg-primary-600 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                Start Health Chat
              </button>
            </div>
          </div>
        )}

        {/* Create Ticket Form */}
        {shouldShowCreateForm && showCreateForm && (
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-neutral-800 dark:text-white mb-4">
              Start a Health Consultation
            </h3>
            <form onSubmit={handleCreateTicket}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  What would you like to discuss?
                </label>
                <textarea
                  value={ticketPurpose}
                  onChange={(e) => setTicketPurpose(e.target.value)}
                  placeholder="Describe your health concern or question..."
                  className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                           bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white
                           placeholder-neutral-400 dark:placeholder-neutral-500"
                  rows={4}
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setTicketPurpose('');
                    setError(null);
                  }}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 border border-neutral-300 dark:border-neutral-600
                           text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50
                           dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !ticketPurpose.trim()}
                  className="flex-1 px-4 py-2.5 bg-primary-500 text-white rounded-lg
                           hover:bg-primary-600 transition-colors disabled:opacity-50
                           disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Chat Box - Show when ticket exists and is not showing create form */}
        {ticket && !shouldShowCreateForm && (
          <div className="h-[600px]">
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
              formatTime={formatTime}
              onRetry={initializeHealthChat}
              ticketStatus={ticket.status}
              isStaffTyping={isStaffTyping}
              attachedFile={attachedFile}
              onFileStaged={setAttachedFile}
              onFileRemoved={() => setAttachedFile(null)}
              isSocketConnected={isSocketConnected}
            />
          </div>
        )}

        {/* Show active chat (Open or Ongoing) */}
        {ticket && ['Open', 'Ongoing'].includes(ticket.status) && (
          <div className="h-[600px]">
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
              formatTime={formatTime}
              onRetry={initializeHealthChat}
              ticketStatus={ticket.status}
              isStaffTyping={isStaffTyping}
              attachedFile={attachedFile}
              onFileStaged={setAttachedFile}
              onFileRemoved={() => setAttachedFile(null)}
              isSocketConnected={isSocketConnected}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthChat;
