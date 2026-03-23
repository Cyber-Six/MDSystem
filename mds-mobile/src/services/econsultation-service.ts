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

  // React Native's fetch does not support ReadableStream / response.body.getReader().
  // Use XMLHttpRequest which fires onreadystatechange as chunks arrive (streaming).
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', streamUrl);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (accessToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    }

    let lastIndex = 0;
    let accumulatedContent = '';

    // Handle abort signal
    if (signal) {
      signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.onreadystatechange = () => {
      // readyState 3 = LOADING (partial data available), 4 = DONE
      if (xhr.readyState < 3) return;

      if (xhr.status !== 0 && xhr.status !== 200) {
        if (xhr.readyState === 4) {
          reject(new Error(`HTTP error! status: ${xhr.status}`));
        }
        return;
      }

      // Process new data since last check
      const newText = xhr.responseText.substring(lastIndex);
      lastIndex = xhr.responseText.length;

      const lines = newText.split('\n');
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

      if (xhr.readyState === 4) {
        resolve();
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during streaming'));
    };

    xhr.onabort = () => {
      resolve();
    };

    xhr.send(JSON.stringify({ sessionId, message }));
  });
};

export const cancelGeneration = async (sessionId: string): Promise<void> => {
  await axiosRequest.post('/econsultation/chat/cancel', { sessionId });
};

export const clearChat = async (sessionId: string): Promise<{ sessionId: string; messages: ChatMessage[] }> => {
  await clearSessionId();
  return createNewSession();
};
