import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, AlertCircle, Sparkles, RotateCcw, WifiOff } from 'lucide-react';

// Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const LLAMA_DIRECT_URL = import.meta.env.VITE_LLAMA_DIRECT_URL || 'http://localhost:8080';
const STORAGE_KEY = 'econsultation_session_id';
const LOCAL_MESSAGES_KEY = 'econsultation_messages';

// Test mode: Set to true to bypass backend and test directly with llama.cpp
const TEST_MODE = import.meta.env.VITE_AI_TEST_MODE === 'true';

// Medical system prompt for direct llama.cpp testing
const MEDICAL_SYSTEM_PROMPT = `You are a medical support assistant, not a doctor.

Rules:
- You do NOT diagnose illnesses.
- You do NOT prescribe medication or give dosages.
- You do NOT replace professional medical advice.
- You provide general health information only.
- You help users understand possible causes in a non-diagnostic way.
- You encourage consulting a licensed doctor or nurse.
- If symptoms are severe, worsening, or emergency-related, you must say so clearly.

Behavior:
- Ask clarifying questions before giving guidance.
- Use calm, supportive, non-alarming language.
- Avoid medical certainty words like "you have" or "this is".
- Use phrases like "may be associated with", "can sometimes indicate", "might be related to".
- Always remind users this is not a medical diagnosis.

Response Structure:
1. Empathy / acknowledgment
2. Clarifying question (if needed)
3. General information (non-diagnostic)
4. What to do now (safe actions only)
5. When to seek professional help
6. Disclaimer reminder

Emergency:
If the user mentions chest pain, breathing difficulty, heavy bleeding, fainting, seizures, suicidal thoughts, or severe pain:
- Clearly instruct them to seek emergency care immediately.
- Do not provide general information for emergency conditions.`;

// Emergency keywords for client-side detection in test mode
const EMERGENCY_KEYWORDS = [
  'chest pain', 'heart attack', "can't breathe", 'shortness of breath',
  'severe bleeding', 'heavy bleeding', 'fainted', 'passed out',
  'seizure', 'unconscious', 'suicidal', 'kill myself', 'overdose',
  'severe pain', 'stroke', 'choking'
];

const DISCLAIMER = '\n\n⚠️ **Important**: This information is not a medical diagnosis. Please consult a healthcare professional for proper evaluation.';

const EConsultation = () => {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isTestMode, setIsTestMode] = useState(TEST_MODE);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    initializeSession();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check if llama.cpp server is available (for test mode)
  const checkLlamaConnection = async () => {
    try {
      const response = await fetch(`${LLAMA_DIRECT_URL}/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  // Check if backend is available
  const checkBackendConnection = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  // Initialize session
  const initializeSession = async () => {
    try {
      setIsInitializing(true);
      setError(null);

      // Check connections
      const backendAvailable = await checkBackendConnection();
      const llamaAvailable = await checkLlamaConnection();

      if (!backendAvailable && !llamaAvailable) {
        setConnectionStatus('offline');
        setError('Unable to connect to AI service. Please ensure the server is running.');
        setIsInitializing(false);
        return;
      }

      // If backend is not available but llama is, switch to test mode
      if (!backendAvailable && llamaAvailable) {
        setIsTestMode(true);
        setConnectionStatus('test-mode');
      } else if (backendAvailable) {
        setConnectionStatus('connected');
      }

      if (isTestMode || (!backendAvailable && llamaAvailable)) {
        // Test mode: Use local storage for messages
        await initializeTestMode();
      } else {
        // Production mode: Use backend API
        await initializeProductionMode();
      }

    } catch (err) {
      console.error('Failed to initialize session:', err);
      setError('Failed to connect to chat service. Please refresh the page.');
      setConnectionStatus('error');
    } finally {
      setIsInitializing(false);
    }
  };

  // Initialize test mode (direct llama.cpp connection)
  const initializeTestMode = async () => {
    const savedMessages = localStorage.getItem(LOCAL_MESSAGES_KEY);
    
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
        setSessionId('test-mode-session');
        return;
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }

    // Create initial greeting
    const greeting = {
      id: Date.now(),
      role: 'assistant',
      content: `Hello! I'm your AI medical assistant. How can I help you today?

You can ask me about:
• General health questions
• Symptom information
• Medication queries
• Wellness tips

⚠️ **Important**: I provide general health information only. I am not a substitute for professional medical advice.

🧪 **Test Mode Active**: Running directly with llama.cpp (no database)`,
      timestamp: new Date()
    };

    setMessages([greeting]);
    setSessionId('test-mode-session');
    localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify([greeting]));
  };

  // Initialize production mode (backend API)
  const initializeProductionMode = async () => {
    const savedSessionId = localStorage.getItem(STORAGE_KEY);
    
    if (savedSessionId) {
      try {
        const historyResponse = await fetch(`${API_BASE_URL}/api/chat/history/${savedSessionId}`);
        
        if (historyResponse.ok) {
          const data = await historyResponse.json();
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
    const response = await fetch(`${API_BASE_URL}/api/chat/session/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Failed to create chat session');
    }

    const data = await response.json();
    const newSessionId = data.session.sessionId;
    
    setSessionId(newSessionId);
    localStorage.setItem(STORAGE_KEY, newSessionId);
    
    // Fetch initial greeting
    const historyResponse = await fetch(`${API_BASE_URL}/api/chat/history/${newSessionId}`);
    const historyData = await historyResponse.json();
    
    setMessages(historyData.messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    })));
  };

  // Check for emergency keywords
  const detectEmergency = (message) => {
    const lower = message.toLowerCase();
    return EMERGENCY_KEYWORDS.some(keyword => lower.includes(keyword));
  };

  // Get emergency response
  const getEmergencyResponse = () => {
    return `🚨 **EMERGENCY ALERT**

Based on your symptoms, this could be a medical emergency.

**SEEK IMMEDIATE MEDICAL ATTENTION:**
- Call emergency services (911 or your local emergency number)
- Go to the nearest emergency room
- Do not drive yourself if possible

Your symptoms require immediate evaluation by medical professionals.

This is NOT a diagnosis, but these symptoms warrant urgent medical care.`;
  };

  // Send message directly to llama.cpp (test mode)
  const sendToLlama = async (userMessage, conversationHistory) => {
    // Check for emergency first
    if (detectEmergency(userMessage)) {
      return getEmergencyResponse();
    }

    // Build prompt with conversation history
    let prompt = MEDICAL_SYSTEM_PROMPT + '\n\n';
    
    // Add last 5 conversation turns for context
    const recentMessages = conversationHistory.slice(-10);
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n\n`;
      }
    }
    
    prompt += `User: ${userMessage}\n\nAssistant: `;

    try {
      const response = await fetch(`${LLAMA_DIRECT_URL}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          temperature: 0.4,
          top_p: 0.9,
          top_k: 40,
          repeat_penalty: 1.15,
          n_predict: 500,
          stop: ['\n\nUser:', '\n\nHuman:', 'User:', 'Human:'],
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await response.json();
      let content = data.content?.trim() || 'I apologize, but I was unable to generate a response. Please try again.';
      
      // Add disclaimer if not present
      if (!content.includes('⚠️') && !content.includes('Important')) {
        content += DISCLAIMER;
      }

      return content;

    } catch (error) {
      console.error('Llama API error:', error);
      throw new Error('Failed to communicate with AI service');
    }
  };

  // Handle sending message
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

    try {
      let assistantContent;

      if (isTestMode) {
        // Test mode: Direct llama.cpp communication
        assistantContent = await sendToLlama(messageContent, messages);
      } else {
        // Production mode: Backend API
        const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sessionId: sessionId,
            message: messageContent 
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to get response');
        }

        const data = await response.json();
        assistantContent = data.message;
      }

      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date()
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);

      // Save to local storage in test mode
      if (isTestMode) {
        localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(finalMessages));
      }

    } catch (err) {
      setError(err.message || 'Failed to get response. Please try again.');
      console.error('Error sending message:', err);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Handle clearing chat
  const handleClearChat = async () => {
    try {
      if (isTestMode) {
        localStorage.removeItem(LOCAL_MESSAGES_KEY);
        await initializeTestMode();
      } else {
        if (sessionId) {
          await fetch(`${API_BASE_URL}/api/chat/session/${sessionId}`, {
            method: 'DELETE'
          });
          localStorage.removeItem(STORAGE_KEY);
        }
        await initializeProductionMode();
      }
      setError(null);
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

  // Loading state
  if (isInitializing) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400">Connecting to AI assistant...</p>
          </div>
        </div>
      </div>
    );
  }

  // Offline state
  if (connectionStatus === 'offline') {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <WifiOff className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">Unable to Connect</h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              The AI service is currently unavailable. Please ensure:
            </p>
            <ul className="text-left text-neutral-600 dark:text-neutral-400 mb-6 max-w-md mx-auto">
              <li>• The backend server is running on port 3001</li>
              <li>• OR llama.cpp server is running on port 8080</li>
            </ul>
            <button
              onClick={initializeSession}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        {isTestMode && (
          <div className="mt-2 inline-flex items-center px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm rounded-full">
            🧪 Test Mode - Direct llama.cpp connection (no database)
          </div>
        )}
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
                    AI Medical Assistant
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight">
                    {isLoading ? 'Generating response...' : 'Online • Ready to help'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClearChat}
                className="p-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                title="Clear chat"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="h-[450px] overflow-y-auto bg-white dark:bg-neutral-900">
              <div className="px-6 py-6 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                      message.role === 'assistant'
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                        : 'bg-gray-700 dark:bg-gray-600'
                    }`}>
                      {message.role === 'assistant' ? (
                        <Bot className="w-4 h-4 text-white" />
                      ) : (
                        <User className="w-4 h-4 text-white" />
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} flex-1`}>
                      <div
                        className={`rounded-xl px-4 py-2.5 shadow-sm max-w-[85%] ${
                          message.role === 'assistant'
                            ? 'bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 rounded-tl-md'
                            : 'bg-blue-600 text-white rounded-tr-md shadow-md'
                        }`}
                      >
                        <p className={`text-sm leading-relaxed whitespace-pre-wrap m-0 ${
                          message.role === 'assistant' ? 'text-neutral-800 dark:text-neutral-100' : 'text-white'
                        }`}>{message.content}</p>
                      </div>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 px-1">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Loading Indicator */}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl rounded-tl-md px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-neutral-400 dark:bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {error && (
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
                      placeholder="Ask me anything about your health..."
                      className="w-full px-4 py-2.5 border border-neutral-300 dark:border-neutral-600 rounded-lg 
                               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                               bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white
                               placeholder-neutral-400 dark:placeholder-neutral-500
                               resize-none text-sm"
                      rows="2"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading}
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
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100 mb-4">
              Important Guidelines
            </h3>
            <ul className="space-y-3 text-sm text-primary-700 dark:text-primary-300">
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>This AI assistant provides general health information only</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Not a substitute for professional medical advice or diagnosis</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>For emergencies, please visit the clinic immediately</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Your conversation is private and secure</span>
              </li>
            </ul>
          </div>

          {/* Connection Status Card */}
          <div className="mt-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Connection Status</h4>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'test-mode' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                {connectionStatus === 'connected' && 'Connected to backend'}
                {connectionStatus === 'test-mode' && 'Test mode (direct llama.cpp)'}
                {connectionStatus === 'offline' && 'Offline'}
                {connectionStatus === 'error' && 'Connection error'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EConsultation;
