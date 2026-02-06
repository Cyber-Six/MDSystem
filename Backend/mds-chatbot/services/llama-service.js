/**
 * LLaMA Service - Interface with locally-run llama.cpp server
 * Handles model initialization, requests, and response generation
 * Supports streaming responses for real-time token delivery
 */

const axios = require('axios');
const { spawn } = require('child_process');
const config = require('../config/model-config');
const logger = require('../../utils/logger');
const { EventEmitter } = require('events');

class LlamaService {
  constructor() {
    this.serverProcess = null;
    this.isInitialized = false;
    this.baseUrl = `http://${config.llamaServer.host}:${config.llamaServer.port}`;
    this.lastActivityTimestamp = null;
    this.idleCheckInterval = null;
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
        '-t', config.llamaServer.threads.toString(),
      ];

      const serverBin = config.llamaServer.serverBin || 'llama-server';

      this.serverProcess = spawn(serverBin, args);

      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        logger.debug('LLaMA server output', { output });

        // Check if server is ready
        if (output.includes('HTTP server listening')) {
          this.isInitialized = true;
          this.lastActivityTimestamp = Date.now();
          
          // Start idle timeout checker if on-demand is enabled
          if (config.onDemand.enabled) {
            this.startIdleChecker();
          }
          
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
        this.stopIdleChecker();
      });

      // Timeout from config
      setTimeout(() => {
        if (!this.isInitialized) {
          reject(new Error('LLaMA server failed to start within timeout'));
        }
      }, config.llamaServer.startupTimeout);
    });
  }

  /**
   * Health check for llama.cpp server
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: config.llamaServer.healthCheckTimeout,
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
    // Auto-start server if on-demand is enabled
    if (config.onDemand.enabled && !this.isInitialized) {
      const isRunning = await this.healthCheck();
      if (!isRunning) {
        logger.info('On-demand starting LLaMA server...');
        await this.startServer();
      } else {
        this.isInitialized = true;
      }
    }

    if (!this.isInitialized) {
      const isRunning = await this.healthCheck();
      if (!isRunning) {
        throw new Error('LLaMA server is not running. Please start it first.');
      }
      this.isInitialized = true;
    }

    // Update last activity timestamp
    this.lastActivityTimestamp = Date.now();

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

      // Clean response: remove model artifacts like <|assistant|> tags
      let generatedText = response.data.content
        .replace(/<\|assistant\|>/gi, '')
        .replace(/<\|user\|>/gi, '')
        .replace(/<\|system\|>/gi, '')
        .replace(/<\|end\|>/gi, '')
        .trim();

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
   * Generate streaming AI response
   * @param {Array} messages - Conversation history [{ role: 'user'|'assistant', content: string }]
   * @param {Object} options - Generation options
   * @param {Function} onToken - Callback for each token chunk
   * @returns {Promise<Object>} - Final response with content, tokens, and duration
   */
  async generateStreamingResponse(messages, options = {}, onToken) {
    // Auto-start server if on-demand is enabled
    if (config.onDemand.enabled && !this.isInitialized) {
      const isRunning = await this.healthCheck();
      if (!isRunning) {
        logger.info('On-demand starting LLaMA server for streaming...');
        await this.startServer();
      } else {
        this.isInitialized = true;
      }
    }

    if (!this.isInitialized) {
      const isRunning = await this.healthCheck();
      if (!isRunning) {
        throw new Error('LLaMA server is not running. Please start it first.');
      }
      this.isInitialized = true;
    }

    // Update last activity timestamp
    this.lastActivityTimestamp = Date.now();

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
        stream: true,  // Enable streaming
      };

      logger.info('Generating streaming AI response', { 
        messageCount: messages.length,
        promptLength: prompt.length 
      });

      const startTime = Date.now();
      let fullContent = '';
      let tokenCount = 0;

      // Make streaming request to llama.cpp server
      const response = await axios.post(
        `${this.baseUrl}/completion`,
        requestBody,
        {
          timeout: config.llamaServer.timeout,
          headers: { 'Content-Type': 'application/json' },
          responseType: 'stream',
        }
      );

      return new Promise((resolve, reject) => {
        let buffer = '';

        response.data.on('data', (chunk) => {
          buffer += chunk.toString();
          
          // Process complete lines (llama.cpp sends "data: {...}\n\n")
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';  // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6).trim();  // Remove "data: " prefix
                if (!jsonStr || jsonStr === '[DONE]') continue;
                
                const data = JSON.parse(jsonStr);
                
                if (data.content) {
                  fullContent += data.content;
                  tokenCount++;
                  
                  // Callback for each token
                  if (onToken && typeof onToken === 'function') {
                    onToken(data.content, data.stop || false);
                  }
                }

                // Check if generation is complete
                if (data.stop) {
                  const duration = Date.now() - startTime;
                  
                  // Clean response: remove model artifacts
                  let cleanedContent = fullContent
                    .replace(/<\|assistant\|>/gi, '')
                    .replace(/<\|user\|>/gi, '')
                    .replace(/<\|system\|>/gi, '')
                    .replace(/<\|end\|>/gi, '')
                    .trim();

                  logger.info('Streaming AI response completed', { 
                    duration,
                    responseLength: cleanedContent.length,
                    tokens: tokenCount 
                  });

                  resolve({
                    content: cleanedContent,
                    tokens: tokenCount,
                    duration,
                    model: 'llama-3-8b-instruct',
                    streamed: true,
                  });
                }
              } catch (parseError) {
                // Ignore parse errors for incomplete data
                logger.debug('Skipping unparseable chunk', { line });
              }
            }
          }
        });

        response.data.on('end', () => {
          // If we haven't resolved yet (no stop signal), resolve now
          const duration = Date.now() - startTime;
          
          let cleanedContent = fullContent
            .replace(/<\|assistant\|>/gi, '')
            .replace(/<\|user\|>/gi, '')
            .replace(/<\|system\|>/gi, '')
            .replace(/<\|end\|>/gi, '')
            .trim();

          if (cleanedContent) {
            logger.info('Streaming completed on stream end', { 
              duration,
              responseLength: cleanedContent.length,
              tokens: tokenCount 
            });

            resolve({
              content: cleanedContent,
              tokens: tokenCount,
              duration,
              model: 'llama-3-8b-instruct',
              streamed: true,
            });
          } else {
            reject(new Error('Empty response from streaming'));
          }
        });

        response.data.on('error', (error) => {
          logger.error('Streaming error', { error: error.message });
          reject(error);
        });
      });

    } catch (error) {
      logger.error('Failed to generate streaming AI response', { 
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
    // Use fast or full system prompt based on safety mode
    const sysPrompt = config.safetyMode ? config.systemPrompt : config.systemPromptFast;
    let prompt = sysPrompt + '\n\n';

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
    this.stopIdleChecker();
    
    if (this.serverProcess) {
      logger.info('Shutting down LLaMA server...');
      this.serverProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise(resolve => {
        this.serverProcess.on('close', resolve);
        setTimeout(resolve, config.llamaServer.shutdownTimeout);
      });

      this.serverProcess = null;
      this.isInitialized = false;
      this.lastActivityTimestamp = null;
      logger.info('LLaMA server shut down');
    }
  }

  /**
   * Start idle timeout checker (runs every minute)
   */
  startIdleChecker() {
    if (this.idleCheckInterval) {
      return; // Already running
    }

    const timeoutMs = config.onDemand.idleTimeoutMinutes * 60 * 1000;

    this.idleCheckInterval = setInterval(() => {
      const now = Date.now();
      const idleTime = now - (this.lastActivityTimestamp || now);

      if (idleTime >= timeoutMs) {
        logger.info('LLaMA server idle timeout reached, shutting down...', {
          idleMinutes: Math.round(idleTime / 60000),
        });
        this.shutdown();
      }
    }, 60000); // Check every minute

    logger.info('Idle timeout checker started', {
      timeoutMinutes: config.onDemand.idleTimeoutMinutes,
    });
  }

  /**
   * Stop idle timeout checker
   */
  stopIdleChecker() {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
      logger.info('Idle timeout checker stopped');
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    const idleMinutes = this.lastActivityTimestamp 
      ? Math.round((Date.now() - this.lastActivityTimestamp) / 60000)
      : null;

    return {
      initialized: this.isInitialized,
      processRunning: this.serverProcess !== null,
      baseUrl: this.baseUrl,
      onDemandEnabled: config.onDemand.enabled,
      idleTimeoutMinutes: config.onDemand.idleTimeoutMinutes,
      currentIdleMinutes: idleMinutes,
      lastActivity: this.lastActivityTimestamp 
        ? new Date(this.lastActivityTimestamp).toISOString()
        : null,
    };
  }
}

// Singleton instance
const llamaService = new LlamaService();

module.exports = llamaService;
