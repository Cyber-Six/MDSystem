/**
 * LLaMA Model Configuration
 * Settings for the locally-run medical AI chatbot
 */

const path = require('path');

module.exports = {
  // Model Settings
  // Use env variable or default to LLaMA 3 8B Instruct Q4_K_M
  modelPath: process.env.LLAMA_MODEL_PATH || path.join(__dirname, '../models-storage/Phi-3-mini-4k-instruct-Q4_K_M.gguf'),
  
  // Server Configuration
  llamaServer: {
    host: process.env.LLAMA_SERVER_HOST || 'localhost',
    port: process.env.LLAMA_SERVER_PORT || 8080,
    timeout: 30000, // 30 seconds request timeout
    serverBin: process.env.LLAMA_SERVER_BIN || '~/Models/llama.cpp/build/bin/llama-server',
    threads: parseInt(process.env.LLAMA_THREADS || '3', 10),
  },

  // On-Demand Configuration
  onDemand: {
    enabled: process.env.AUTO_START_LLAMA === 'true',
    idleTimeoutMinutes: parseInt(process.env.AI_IDLE_TIMEOUT_MINUTES || '20', 10),
  },

  // Generation Parameters (optimized for medical safety)
  generationParams: {
    temperature: 0.4,           // Lower = more conservative responses
    topP: 0.9,                  // Nucleus sampling
    topK: 40,
    repeatPenalty: 1.15,        // Reduce repetition
    maxTokens: 500,             // Limit response length
    contextSize: 1024,          // Context window
    stop: ['\n\nUser:', '\n\nHuman:', 'User:', 'Human:'],
  },

  // System Prompt - CRITICAL for medical safety
  systemPrompt: `You are a medical support assistant, not a doctor.

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
- Do not provide general information for emergency conditions.`,

  // Response Disclaimer (appended to all responses)
  disclaimer: '\n\n⚠️ **Important**: This information is not a medical diagnosis. Please consult a healthcare professional for proper evaluation.',

  // Retry Configuration
  retry: {
    maxAttempts: 3,
    delayMs: 1000,
  },
};
