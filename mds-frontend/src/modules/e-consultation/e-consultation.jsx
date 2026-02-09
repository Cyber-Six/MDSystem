import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, AlertCircle, Sparkles, RotateCcw } from 'lucide-react';
import { axiosRequest, getApiBaseUrl } from '../../packages-core-adapter';
import GuidelinesCard from './components/GuidelinesCard';
import MessageBubble from './components/MessageBubble';
import LoadingIndicator from './components/LoadingIndicator';
import EmptyState from './components/EmptyState';

// Configuration - All requests go through backend via proper domain (X-Forwarded-Host header)
const STORAGE_KEY = 'econsultation_session_id';
const AI_MODEL_NAME = 'AI Chatbot - solGPT';

const EConsultation = () => {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const hasInitialized = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Prevent duplicate health checks (React Strict Mode runs effects twice)
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    initializeSession();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Check if backend is available (via proper domain routing)
  const checkBackendConnection = async () => {
    try {
      const response = await axiosRequest.get('/econsultation/chat/health', {
        timeout: 5000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  };

  // Initialize session
  const initializeSession = async () => {
    try {
      setIsInitializing(true);
      setError(null);

      const backendAvailable = await checkBackendConnection();

      if (!backendAvailable) {
        setConnectionStatus('offline');
        setError('Unable to connect to AI service. Please ensure the server is running.');
        setIsInitializing(false);
        return;
      }

      setConnectionStatus('connected');
      await initializeProductionMode();

    } catch (err) {
      console.error('Failed to initialize session:', err);
      setError('Failed to connect to chat service. Please refresh the page.');
      setConnectionStatus('error');
    } finally {
      setIsInitializing(false);
    }
  };

  // Initialize production mode (backend API via proper domain)
  const initializeProductionMode = async () => {
    const savedSessionId = localStorage.getItem(STORAGE_KEY);
    
    if (savedSessionId) {
      try {
        const historyResponse = await axiosRequest.get(`/econsultation/chat/history/${savedSessionId}`);
        
        if (historyResponse.status === 200) {
          const data = historyResponse.data;
          setSessionId(savedSessionId);
          setMessages(data.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })));
          return;
        }
      } catch (e) {
        console.error('Failed to restore session:', e);
      }
    }
    
    // Create new session
    const response = await axiosRequest.post('/econsultation/chat/session/new');

    if (response.status !== 200 && response.status !== 201) {
      throw new Error('Failed to create chat session');
    }

    const data = response.data;
    const newSessionId = data.session.sessionId;
    
    setSessionId(newSessionId);
    localStorage.setItem(STORAGE_KEY, newSessionId);
    
    // Fetch initial greeting
    const historyResponse = await axiosRequest.get(`/econsultation/chat/history/${newSessionId}`);
    const historyData = historyResponse.data;
    
    setMessages(historyData.messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    })));
  };

  // Handle sending message with streaming (via backend API)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const messageContent = inputValue.trim();
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: messageContent,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsLoading(true);
    setError(null);
    setStreamingContent('');

    // Don't create placeholder immediately - let loading indicator show first
    const assistantMessageId = Date.now() + 1;

    try {
      // Create AbortController for cleanup
      abortControllerRef.current = new AbortController();
      
      // Get the base URL for the API
      const baseUrl = getApiBaseUrl();
      const streamUrl = `${baseUrl}/econsultation/chat/message/stream`;
      
      // Use fetch for SSE streaming
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          message: messageContent
        }),
        credentials: 'include',
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            // Parse event type
            const eventType = line.slice(7).trim();
            continue;
          }
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Handle different event types based on data content
              if (data.token !== undefined) {
                // Token received - update streaming content
                accumulatedContent = data.content || (accumulatedContent + data.token);
                setStreamingContent(accumulatedContent);
                
                // Create or update the streaming message
                setMessages(prevMessages => {
                  const lastMessage = prevMessages[prevMessages.length - 1];
                  
                  // If last message is the assistant streaming message, update it
                  if (lastMessage && lastMessage.id === assistantMessageId) {
                    const newMessages = [...prevMessages];
                    newMessages[newMessages.length - 1] = {
                      ...lastMessage,
                      content: accumulatedContent
                    };
                    return newMessages;
                  } else {
                    // First token - create the streaming message
                    return [...prevMessages, {
                      id: assistantMessageId,
                      role: 'assistant',
                      content: accumulatedContent,
                      timestamp: new Date(), // Will be updated when done
                      isStreaming: true
                    }];
                  }
                });
              } else if (data.message !== undefined && data.role === 'assistant') {
                // Done event - finalize message with final timestamp
                const finalContent = data.message;
                const finalTimestamp = new Date();
                
                setMessages(prevMessages => {
                  const newMessages = [...prevMessages];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage && lastMessage.id === assistantMessageId) {
                    lastMessage.content = finalContent;
                    lastMessage.timestamp = finalTimestamp; // Update to completion time
                    lastMessage.isStreaming = false;
                  }
                  return newMessages;
                });
                setStreamingContent('');
              } else if (data.error) {
                // Error event
                throw new Error(data.message || 'An error occurred');
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete data
              console.debug('Skipping unparseable SSE data:', line);
            }
          }
        }
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Request aborted');
      } else {
        setError(err.message || 'Failed to get response. Please try again.');
        console.error('Error sending message:', err);
        
        // Remove the failed streaming message
        setMessages(updatedMessages);
      }
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      abortControllerRef.current = null;
      inputRef.current?.focus();
    }
  };

  // Handle clearing chat - NEW SESSION (only triggered by button click)
  const handleClearChat = async () => {
    try {
      // Clear current session from backend and localStorage
      if (sessionId) {
        await axiosRequest.delete(`/econsultation/chat/session/${sessionId}`);
        localStorage.removeItem(STORAGE_KEY);
      }
      
      // Clear messages immediately for better UX
      setMessages([]);
      setError(null);
      
      // Create new session
      await initializeProductionMode();
    } catch (err) {
      console.error('Error clearing chat:', err);
      setMessages([]);
      setError(null);
      await initializeSession();
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
          AI Medical Consultation
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Chat with our AI assistant about your health concerns
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chat Container */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg overflow-hidden">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-neutral-900 ${isLoading ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                </div>
                <div className="flex flex-col justify-center">
                  <h2 className="text-base font-semibold text-neutral-900 dark:text-white leading-tight">
                    {AI_MODEL_NAME}
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight">
                    {isLoading ? (streamingContent ? 'Generating response...' : 'Connecting...') : 'Online • Ready to help'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClearChat}
                disabled={isLoading || connectionStatus !== 'connected'}
                className="p-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white 
                         hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
                title="Clear chat and start new session"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="h-[450px] overflow-y-auto bg-white dark:bg-neutral-900">
              <div className="px-6 py-6 space-y-4">
                {/* Show empty states only when no messages and initializing/offline/error */}
                {messages.length === 0 && isInitializing && (
                  <EmptyState type="initializing" />
                )}

                {messages.length === 0 && !isInitializing && connectionStatus === 'offline' && (
                  <EmptyState type="offline" onRetry={initializeSession} />
                )}

                {messages.length === 0 && !isInitializing && connectionStatus === 'error' && (
                  <EmptyState type="error" error={error} onRetry={initializeSession} />
                )}

                {/* Messages - show when connected or when messages exist */}
                {messages.map((message) => (
                  <MessageBubble 
                    key={message.id} 
                    message={message} 
                    formatTime={formatTime} 
                  />
                ))}

                {/* Loading Indicator - only show when loading AND no streaming content */}
                {!isInitializing && connectionStatus === 'connected' && isLoading && !streamingContent && (
                  <LoadingIndicator />
                )}

                {/* Error Message - only show when connected and has messages */}
                {!isInitializing && connectionStatus === 'connected' && messages.length > 0 && error && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 px-6 py-4">
              <form onSubmit={handleSendMessage}>
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder={
                        isInitializing ? 'Connecting...' :
                        connectionStatus === 'offline' ? 'Service unavailable...' :
                        connectionStatus === 'error' ? 'Connection error. Please retry.' :
                        'Ask me anything about your health...'
                      }
                      disabled={connectionStatus !== 'connected' || isInitializing}
                      className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg 
                               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                               bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white
                               placeholder-neutral-400 dark:placeholder-neutral-500
                               resize-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      rows="2"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading || connectionStatus !== 'connected' || isInitializing}
                    className="flex-shrink-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700
                             text-white rounded-lg transition-all duration-200 flex items-center justify-center
                             disabled:cursor-not-allowed shadow-sm hover:shadow-md disabled:shadow-none self-center"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Guidelines Card */}
        <div>
          <GuidelinesCard />
        </div>
      </div>
    </div>
  );
};

export default EConsultation;
