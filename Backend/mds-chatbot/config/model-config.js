/**
 * LLaMA Model Configuration
 * Settings for the locally-run medical AI chatbot
 */

const path = require('path');
const os = require('os');

// Helper function to expand tilde paths
const expandPath = (p) => {
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
};

module.exports = {
  // Safety Mode Toggle (true = full medical safety, false = fast plain mode)
  safetyMode: process.env.MEDICAL_SAFETY_MODE === 'true',

  // Model Settings
  // Use env variable or default to Phi-3-mini Q4_K_M
  modelPath: expandPath(process.env.LLAMA_MODEL_PATH || '~/Models/llama.cpp/models/Phi-3-mini-4k-instruct-Q4_K_M.gguf'),
  
  // Server Configuration
  llamaServer: {
    host: process.env.LLAMA_SERVER_HOST || 'localhost',
    port: process.env.LLAMA_SERVER_PORT || 8080,
    timeout: parseInt(process.env.LLAMA_REQUEST_TIMEOUT || '300000', 10), // AI response generation timeout
    healthCheckTimeout: parseInt(process.env.LLAMA_HEALTH_CHECK_TIMEOUT || '120000', 10), // Health check timeout
    startupTimeout: parseInt(process.env.LLAMA_STARTUP_TIMEOUT || '600000', 10), // Server startup timeout
    shutdownTimeout: parseInt(process.env.LLAMA_SHUTDOWN_TIMEOUT || '120000', 10), // Graceful shutdown timeout
    serverBin: expandPath(process.env.LLAMA_SERVER_BIN || '~/Models/llama.cpp/build/bin/llama-server'),
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

  // System Prompt for SAFETY MODE (full medical guardrails)
  systemPrompt: `You are a medical support assistant. You do NOT diagnose or prescribe. You provide general health information and encourage consulting a doctor. For emergencies (chest pain, breathing issues, severe bleeding, suicidal thoughts), instruct to seek immediate help.`,

  // System Prompt for FAST MODE (minimal, plain responses)
  systemPromptFast: `You are a helpful health assistant. Answer questions concisely and helpfully.`,

  // Retry Configuration
  retry: {
    maxAttempts: 3,
    delayMs: 1000,
  },
};
