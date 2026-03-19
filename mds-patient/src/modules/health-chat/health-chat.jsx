import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, MessageCircleHeart, Stethoscope } from 'lucide-react';
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

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const hasInitialized = useRef(false);

  const { isConnected: isSocketConnected, emitTyping } = useHealthChatSocket({
    chatId: ticket?.id,
    chatStatus: ticket?.status,
    onNewMessage: handleNewMessage,
    onTyping: handleTypingIndicator,
    onTicketApproved: handleTicketApproved,
    onTicketClosed: handleTicketClosed
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    initializeHealthChat();
  }, []);

  function handleNewMessage(newMessage) {
    setMessages(prev => [...prev, newMessage]);
    setIsStaffTyping(false);
  }
  function handleTypingIndicator(isTyping) { setIsStaffTyping(isTyping); }
  function handleTicketApproved(updatedTicket) {
    setTicket(updatedTicket);
    if (updatedTicket?.id) loadMessages(updatedTicket.id);
  }
  function handleTicketClosed(data) {
    setTicket(prev => prev ? { ...prev, status: 'Closed' } : null);
    if (data?.chatId) loadMessages(data.chatId);
  }

  async function initializeHealthChat() {
    try {
      setIsInitializing(true);
      setConnectionStatus('checking');
      setError(null);
      const activeTicket = await getCurrentActiveTicket();
      if (activeTicket) {
        setTicket(activeTicket);
        await loadMessages(activeTicket.id);
        setConnectionStatus('connected');
      } else {
        await loadPreviousTickets();
        setConnectionStatus('connected');
      }
    } catch (err) {
      setError('Failed to load health chat. Please try again.');
      setConnectionStatus('error');
    } finally {
      setIsInitializing(false);
    }
  }

  async function loadMessages(chatId) {
    try {
      const fetchedMessages = await getTicketMessages(chatId);
      setMessages(fetchedMessages);
    } catch (err) {
      setError('Failed to load messages.');
    }
  }

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
      setPreviousTickets([...closedResult.chats, ...expiredResult.chats]);
    } catch (err) {}
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
      setError(err.message || 'Failed to send message.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCloseTicket() {
    if (!ticket?.id) return;
    try {
      setIsLoading(true);
      const result = await closeTicket(ticket.id);
      if (result.success) {
        setTicket(prev => prev ? { ...prev, status: 'Closed' } : null);
        await loadMessages(ticket.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to close conversation.');
    } finally {
      setIsLoading(false);
    }
  }

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

  const shouldShowCreateForm = !ticket || ['Closed', 'Expired'].includes(ticket?.status);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 font-sans">

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

      {/* ── Main Content ── */}
      <div className="space-y-4">

        {/* Landing — no active ticket, show start button */}
        {shouldShowCreateForm && !showCreateForm && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: '#fdfcfa',
              border: '1.5px solid #e8e5e0',
              boxShadow: '0 4px 16px rgba(28,25,23,0.06)'
            }}
          >
            {/* Previous conversation preview */}
            {ticket && ['Closed', 'Expired'].includes(ticket.status) && (
              <div className="p-5 border-b border-neutral-200 dark:border-neutral-700">
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 mb-3">
                  Previous conversation
                </p>
                <div
                  className="max-h-56 overflow-y-auto space-y-2.5 rounded-xl p-4"
                  style={{ background: '#f4f2ef' }}
                >
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`text-sm leading-relaxed ${
                        msg.promptType === 'system'
                          ? 'text-center text-neutral-400 italic'
                          : msg.userType === 'Patient'
                          ? 'text-right text-secondary-700 dark:text-secondary-300'
                          : 'text-left text-neutral-600 dark:text-neutral-400'
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
            className="rounded-2xl overflow-hidden"
            style={{
              background: '#fdfcfa',
              border: '1.5px solid #e8e5e0',
              boxShadow: '0 4px 16px rgba(28,25,23,0.06)'
            }}
          >
            {/* Form header */}
            <div
              className="px-6 py-5 border-b"
              style={{ borderColor: '#e8e5e0' }}
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
                    className="w-full px-4 py-3.5 rounded-xl text-sm text-secondary-800 dark:text-white
                               placeholder-neutral-400 resize-none transition-all duration-200
                               focus:outline-none"
                    style={{
                      background: '#f4f2ef',
                      border: '1.5px solid #e8e5e0',
                      minHeight: '120px',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#f4c430';
                      e.target.style.boxShadow = '0 0 0 3px rgba(244,196,48,0.12)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '#e8e5e0';
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
                    className="mb-4 px-4 py-3 rounded-xl flex items-center gap-2.5 text-sm"
                    style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
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
                    className="flex-1 py-2.5 rounded-full text-sm font-medium text-neutral-600
                               transition-all duration-150 hover:bg-neutral-100 disabled:opacity-50"
                    style={{ border: '1.5px solid #d5d1cb' }}
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

        {/* Active / Pending chat */}
        {ticket && ['Open', 'Ongoing'].includes(ticket.status) && (
          <div
            className="rounded-2xl overflow-hidden flex flex-col"
            style={{
              height: 'calc(100vh - 220px)',
              minHeight: '480px',
              maxHeight: '720px',
              border: '1.5px solid #e8e5e0',
              boxShadow: '0 4px 24px rgba(28,25,23,0.07)'
            }}
          >
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
              onRefresh={refreshMessages}
              ticketStatus={ticket.status}
              ticketPurpose={ticket.purpose}
              ticketCreatedAt={ticket.session_start}
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