/**
 * LLaMA Service - Interface with locally-run llama.cpp server
 * Handles model initialization, requests, and response generation
 */

const axios = require('axios');
const { spawn } = require('child_process');
const config = require('../config/model-config');
const logger = require('../../utils/logger');

class LlamaService {
  constructor() {
    this.serverProcess = null;
    this.isInitialized = false;
    this.baseUrl = `http://${config.llamaServer.host}:${config.llamaServer.port}`;
  }

  /**
   * Initialize llama.cpp server (if not already running externally)
   * @param {boolean} autoStart - Whether to auto-start the server
   */
  async initialize(autoStart = false) {
    try {
      // Check if server is already running
      const isRunning = await this.healthCheck();
      
      if (isRunning) {
        this.isInitialized = true;
        logger.info('LLaMA server is already running', { url: this.baseUrl });
        return true;
      }

      if (!autoStart) {
        logger.warn('LLaMA server is not running. Start it manually or set autoStart=true');
        return false;
      }

      // Auto-start llama.cpp server
      await this.startServer();
      return true;

    } catch (error) {
      logger.error('Failed to initialize LLaMA service', { error: error.message });
      throw error;
    }
  }

  /**
   * Start llama.cpp server as a subprocess
   */
  async startServer() {
    return new Promise((resolve, reject) => {
      logger.info('Starting llama.cpp server...', { 
        modelPath: config.modelPath,
        port: config.llamaServer.port 
      });

      const args = [
        '-m', config.modelPath,
        '-c', config.generationParams.contextSize.toString(),
        '--port', config.llamaServer.port.toString(),
        '--host', config.llamaServer.host,
        '-t', '4', // threads
      ];

      this.serverProcess = spawn('llama-server', args);

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        logger.debug('LLaMA server output', { output });

        // Check if server is ready
        if (output.includes('HTTP server listening')) {
          this.isInitialized = true;
          logger.info('✅ LLaMA server started successfully');
          resolve();
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        logger.error('LLaMA server error', { error: data.toString() });
      });

      this.serverProcess.on('error', (error) => {
        logger.error('Failed to start LLaMA server', { error: error.message });
        reject(error);
      });

      this.serverProcess.on('close', (code) => {
        logger.info('LLaMA server process exited', { code });
        this.isInitialized = false;
        this.serverProcess = null;
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!this.isInitialized) {
          reject(new Error('LLaMA server failed to start within timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Health check for llama.cpp server
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate AI response
   * @param {Array} messages - Conversation history [{ role: 'user'|'assistant', content: string }]
   * @param {Object} options - Generation options
   */
  async generateResponse(messages, options = {}) {
    if (!this.isInitialized) {
      const isRunning = await this.healthCheck();
      if (!isRunning) {
        throw new Error('LLaMA server is not running. Please start it first.');
      }
      this.isInitialized = true;
    }

    try {
      // Format messages for the model
      const prompt = this.formatPrompt(messages);

      const requestBody = {
        prompt,
        temperature: options.temperature ?? config.generationParams.temperature,
        top_p: options.topP ?? config.generationParams.topP,
        top_k: options.topK ?? config.generationParams.topK,
        repeat_penalty: options.repeatPenalty ?? config.generationParams.repeatPenalty,
        n_predict: options.maxTokens ?? config.generationParams.maxTokens,
        stop: config.generationParams.stop,
        stream: false,
      };

      logger.info('Generating AI response', { 
        messageCount: messages.length,
        promptLength: prompt.length 
      });

      const startTime = Date.now();

      const response = await axios.post(
        `${this.baseUrl}/completion`,
        requestBody,
        {
          timeout: config.llamaServer.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const duration = Date.now() - startTime;

      if (!response.data || !response.data.content) {
        throw new Error('Invalid response from LLaMA server');
      }

      const generatedText = response.data.content.trim();

      logger.info('AI response generated successfully', { 
        duration,
        responseLength: generatedText.length,
        tokens: response.data.tokens_predicted 
      });

      return {
        content: generatedText,
        tokens: response.data.tokens_predicted,
        duration,
        model: 'llama-3-8b-instruct',
      };

    } catch (error) {
      logger.error('Failed to generate AI response', { 
        error: error.message,
        messageCount: messages.length 
      });

      if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to LLaMA server. Make sure it is running.');
      }

      throw error;
    }
  }

  /**
   * Format conversation messages into a prompt for the model
   * @param {Array} messages - Conversation history
   */
  formatPrompt(messages) {
    let prompt = config.systemPrompt + '\n\n';

    for (const msg of messages) {
      if (msg.role === 'user') {
        prompt += `User: ${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n\n`;
      }
    }

    prompt += 'Assistant: ';

    return prompt;
  }

  /**
   * Shutdown llama.cpp server gracefully
   */
  async shutdown() {
    if (this.serverProcess) {
      logger.info('Shutting down LLaMA server...');
      this.serverProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise(resolve => {
        this.serverProcess.on('close', resolve);
        setTimeout(resolve, 5000); // Force after 5 seconds
      });

      this.serverProcess = null;
      this.isInitialized = false;
      logger.info('LLaMA server shut down');
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      processRunning: this.serverProcess !== null,
      baseUrl: this.baseUrl,
    };
  }
}

// Singleton instance
const llamaService = new LlamaService();

module.exports = llamaService;
