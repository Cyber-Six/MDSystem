/**
 * E-Consultation Service for React Native
 * Mirrors mds-patient e-consultation chat functionality
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { axiosRequest, getApiBaseUrl, TokenStorage } from '../core';

const STORAGE_KEY = '@econsultation_session_id';

export interface ChatMessage {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export const getSessionId = async (): Promise<string | null> => {
  return AsyncStorage.getItem(STORAGE_KEY);
};

export const saveSessionId = async (sessionId: string): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, sessionId);
};

export const clearSessionId = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};

export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await axiosRequest.get('/econsultation/chat/health', { timeout: 5000 });
    return response.status === 200;
  } catch {
    return false;
  }
};

export const createNewSession = async (): Promise<{ sessionId: string; messages: ChatMessage[] }> => {
  const response = await axiosRequest.post('/econsultation/chat/session/new');
  const newSessionId = response.data.session.sessionId;
  await saveSessionId(newSessionId);

  const historyResponse = await axiosRequest.get(`/econsultation/chat/history/${newSessionId}`);
  const messages = historyResponse.data.messages.map((msg: any) => ({
    ...msg,
    timestamp: new Date(msg.timestamp),
  }));

  return { sessionId: newSessionId, messages };
};

export const fetchHistory = async (sessionId: string): Promise<ChatMessage[]> => {
  const response = await axiosRequest.get(`/econsultation/chat/history/${sessionId}`);
  return response.data.messages.map((msg: any) => ({
    ...msg,
    timestamp: new Date(msg.timestamp),
  }));
};

export const sendMessageStreaming = async (
  sessionId: string,
  message: string,
  onToken: (content: string) => void,
  onDone: (finalMessage: ChatMessage) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): Promise<void> => {
  const baseUrl = getApiBaseUrl();
  const streamUrl = `${baseUrl}/econsultation/chat/message/stream`;
  const accessToken = await TokenStorage.getAccessToken();

  const response = await fetch(streamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ sessionId, message }),
    signal,
  });

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let accumulatedContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.token !== undefined) {
            accumulatedContent = data.content || (accumulatedContent + data.token);
            onToken(accumulatedContent);
          } else if (data.message !== undefined && data.role === 'assistant') {
            onDone({
              id: Date.now(),
              role: 'assistant',
              content: data.message,
              timestamp: new Date(),
            });
          } else if (data.error) {
            onError(data.message || 'An error occurred');
          }
        } catch {
          // Ignore unparseable SSE data
        }
      }
    }
  }
};

export const cancelGeneration = async (sessionId: string): Promise<void> => {
  await axiosRequest.post('/econsultation/chat/cancel', { sessionId });
};

export const clearChat = async (sessionId: string): Promise<{ sessionId: string; messages: ChatMessage[] }> => {
  await clearSessionId();
  return createNewSession();
};
