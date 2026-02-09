import React, { useState, useRef, useEffect } from 'react';
import { axiosRequest, getApiBaseUrl } from '../../packages-core-adapter';
import GuidelinesCard from './components/GuidelinesCard';
import ChatBox from './components/ChatBox';

// Configuration - All requests go through backend via proper domain (X-Forwarded-Host header)
const STORAGE_KEY = 'econsultation_session_id';
const SESSION_INITIALIZED_KEY = 'econsultation_initialized'; // sessionStorage key

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
    // Prevent duplicate initialization (React Strict Mode runs effects twice)
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    // Check if we've already initialized in this browser session (not page refresh)
    const isAlreadyInitialized = sessionStorage.getItem(SESSION_INITIALIZED_KEY) === 'true';
    const savedSessionId = localStorage.getItem(STORAGE_KEY);
    
    if (isAlreadyInitialized && savedSessionId) {
      // Fast path: we're navigating back to this module (not a page refresh)
      // Just restore session without any backend checks
      fastRestoreSession(savedSessionId);
    } else if (savedSessionId) {
      // Page refresh with existing session: restore with history check
      quickRestoreSession(savedSessionId);
    } else {
      // No session at all: do full initialization with health check
      initializeSession();
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup: abort streaming when navigating away from module
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Fast restore: instant restore when navigating between modules (no backend calls except history)
  const fastRestoreSession = async (savedSessionId) => {
    try {
      setIsInitializing(true);
      setSessionId(savedSessionId);
      setConnectionStatus('connected');
      
      // Fetch message history to restore conversation
      const historyResponse = await axiosRequest.get(`/econsultation/chat/history/${savedSessionId}`);
      
      if (historyResponse.status === 200) {
        const data = historyResponse.data;
        setMessages(data.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
      }
      
      setIsInitializing(false);
    } catch (err) {
      console.error('Fast restore failed:', err);
      // Fall back to full initialization
      await initializeSession();
    }
  };

  // Quick restore session with history check (for page refresh)
  const quickRestoreSession = async (savedSessionId) => {
    try {
      setIsInitializing(true);
      setSessionId(savedSessionId);
      
      // Try to fetch history
      const historyResponse = await axiosRequest.get(`/econsultation/chat/history/${savedSessionId}`);
      
      if (historyResponse.status === 200) {
        const data = historyResponse.data;
        setMessages(data.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
        setConnectionStatus('connected');
        setIsInitializing(false);
        
        // Mark session as initialized for this browser session
        sessionStorage.setItem(SESSION_INITIALIZED_KEY, 'true');
        return;
      }
      
      // If history fetch fails, fall back to full initialization
      throw new Error('Session not found');
    } catch (err) {
      console.log('Quick restore failed, doing full initialization');
      await initializeSession();
    }
  };

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

  // Initialize session (only called when no session exists or quick restore fails)
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
      
      // Mark session as initialized for this browser session
      sessionStorage.setItem(SESSION_INITIALIZED_KEY, 'true');

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

  // Handle canceling generation
  const handleCancelGeneration = async () => {
    // First, call backend to cancel generation and prevent database save
    try {
      if (sessionId) {
        await axiosRequest.post('/econsultation/chat/cancel', {
          sessionId: sessionId
        });
        console.log('Generation cancelled via backend', sessionId);
      }
    } catch (err) {
      console.error('Failed to cancel via backend:', err);
      // Continue with client-side cleanup even if backend call fails
    }

    // Abort the fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setIsLoading(false);
    setStreamingContent('');
    
    // Remove the incomplete streaming message
    setMessages(prevMessages => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      if (lastMessage && lastMessage.isStreaming) {
        return prevMessages.slice(0, -1);
      }
      return prevMessages;
    });
    
    inputRef.current?.focus();
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
      // Create AbortController for cleanup and cancellation
      abortControllerRef.current = new AbortController();
      
      // Get the proper base URL from axiosRequest configuration
      const baseUrl = getApiBaseUrl();
      const streamUrl = `${baseUrl}/econsultation/chat/message/stream`;
      
      // Use fetch for SSE streaming (axios doesn't properly support SSE in browsers)
      // But use the same URL configuration as axiosRequest for consistency
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          message: messageContent
        }),
        credentials: 'include', // Include cookies like axiosRequest does
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
        sessionStorage.removeItem(SESSION_INITIALIZED_KEY);
      }
      
      // Clear messages immediately for better UX
      setMessages([]);
      setError(null);
      
      // Create new session
      await initializeProductionMode();
      
      // Mark new session as initialized
      sessionStorage.setItem(SESSION_INITIALIZED_KEY, 'true');
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
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
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
          <ChatBox
            messages={messages}
            isLoading={isLoading}
            isInitializing={isInitializing}
            connectionStatus={connectionStatus}
            streamingContent={streamingContent}
            error={error}
            inputValue={inputValue}
            inputRef={inputRef}
            messagesEndRef={messagesEndRef}
            onInputChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            onSubmit={handleSendMessage}
            onClearChat={handleClearChat}
            onCancelGeneration={handleCancelGeneration}
            formatTime={formatTime}
            onRetry={initializeSession}
          />
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
