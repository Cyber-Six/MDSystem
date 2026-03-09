/**
 * Chatbot Proxy Middleware
 * 
 * Proxies /econsultation/chat/* requests to the MDS-Chatbot microservice.
 * 
 * Configuration:
 *   CHATBOT_URL     — Base URL of the chatbot service (set in .env)
 *   CHATBOT_API_KEY — Shared secret for service-to-service auth
 * 
 * Behavior:
 *   Patient routes:  /econsultation/chat/* → CHATBOT_URL/api/patient/*
 *   Staff routes:    /econsultation/chat/staff/* → CHATBOT_URL/api/staff/*
 *   Health:          /econsultation/chat/health → CHATBOT_URL/api/health
 * 
 * SSE Streaming:
 *   The proxy pipes the response stream directly, preserving Server-Sent Events.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');
const logger = require('../../utils/logger');

// Timeout for non-streaming proxy requests (5 minutes, matches LLaMA generation timeout)
const PROXY_TIMEOUT_MS = parseInt(process.env.CHATBOT_PROXY_TIMEOUT_MS, 10) || 300000;

const CHATBOT_URL = process.env.CHATBOT_URL;
const CHATBOT_API_KEY = process.env.CHATBOT_API_KEY;

if (!CHATBOT_URL) {
  logger.warn('CHATBOT_URL not set — chatbot proxy will return 503 for all requests');
}

if (!CHATBOT_API_KEY) {
  logger.warn('CHATBOT_API_KEY not set — chatbot proxy will return 503 for all requests');
}

/**
 * Map incoming path to chatbot microservice path
 */
function mapPath(originalPath) {
  // Strip the mount prefix (handled by Express routing)
  // At this point, req.path is relative to the mount point (/econsultation/chat)
  
  if (originalPath.startsWith('/staff')) {
    return `/api${originalPath}`;
  }
  
  if (originalPath === '/health') {
    return '/api/health';
  }
  
  // All other routes → /api/patient/*
  return `/api/patient${originalPath}`;
}

/**
 * Proxy a request to the chatbot microservice
 */
function proxyRequest(req, res, targetPath) {
  if (!CHATBOT_URL || !CHATBOT_API_KEY) {
    return res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: 'AI chatbot service is not configured on this server.',
    });
  }

  // Preserve query string from the original request
  const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const parsedUrl = new URL(targetPath + queryString, CHATBOT_URL);
  const isHttps = parsedUrl.protocol === 'https:';
  const transport = isHttps ? https : http;

  // Generate a request ID for traceability across proxy → chatbot
  const requestId = crypto.randomBytes(8).toString('hex');

  // Build headers — forward originals + inject service auth
  const headers = {
    'Content-Type': req.headers['content-type'] || 'application/json',
    'X-API-Key': CHATBOT_API_KEY,
    'X-Request-Id': requestId,
    'X-Forwarded-For': req.ip,
    'X-Forwarded-Proto': req.protocol,
  };

  // Forward Authorization header if present (for potential future use)
  if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization;
  }

  // For staff routes, inject staff identity from JWT (set by jwtProtect before this middleware)
  if (req.user) {
    headers['X-Staff-Id'] = String(req.user.id);
    headers['X-Staff-Role'] = req.user.role || 'medical';
  }

  // Forward origin for CORS
  if (req.headers.origin) {
    headers['Origin'] = req.headers.origin;
  }

  // Serialize body for POST/PUT/PATCH and set Content-Length before request
  let bodyBuffer = null;
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    bodyBuffer = Buffer.from(JSON.stringify(req.body));
    headers['Content-Length'] = bodyBuffer.length;
  }

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? 443 : 80),
    path: parsedUrl.pathname + (parsedUrl.search || ''),
    method: req.method,
    headers,
    // Timeout for the initial connection + headers; SSE streams stay open after headers arrive
    timeout: PROXY_TIMEOUT_MS,
  };

  logger.debug('Proxying chatbot request', {
    requestId,
    from: req.originalUrl,
    to: `${CHATBOT_URL}${targetPath}${queryString}`,
    method: req.method,
    hasStaffId: !!req.user,
  });

  const proxyReq = transport.request(options, (proxyRes) => {
    // Copy status code
    res.status(proxyRes.statusCode);

    // Copy response headers (important for SSE)
    const skipHeaders = new Set(['transfer-encoding', 'connection']);
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (!skipHeaders.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }

    // For SSE, ensure buffering is disabled
    if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
    }

    // Pipe the response body (works for both JSON and SSE streams)
    proxyRes.pipe(res);
  });

  // Handle socket timeout (fires before 'error')
  proxyReq.on('timeout', () => {
    logger.error('Chatbot proxy timeout', {
      requestId,
      target: `${CHATBOT_URL}${targetPath}`,
      timeoutMs: PROXY_TIMEOUT_MS,
    });
    proxyReq.destroy(new Error('PROXY_TIMEOUT'));
  });

  // Handle proxy errors
  proxyReq.on('error', (error) => {
    logger.error('Chatbot proxy error', {
      requestId,
      error: error.message,
      code: error.code,
      target: `${CHATBOT_URL}${targetPath}`,
    });

    if (!res.headersSent) {
      const isTimeout = error.message === 'PROXY_TIMEOUT';
      res.status(isTimeout ? 504 : 502).json({
        error: isTimeout ? 'CHATBOT_TIMEOUT' : 'CHATBOT_UNAVAILABLE',
        message: isTimeout
          ? 'AI chatbot service did not respond in time.'
          : 'Unable to reach the AI chatbot service.',
      });
    }
  });

  // Handle client disconnect
  req.on('close', () => {
    proxyReq.destroy();
  });

  // Write body and end request
  if (bodyBuffer) {
    proxyReq.write(bodyBuffer);
  }

  proxyReq.end();
}

/**
 * Express router for chatbot proxy
 * Mount at /econsultation/chat
 */
function chatbotProxy(req, res) {
  const targetPath = mapPath(req.path);
  proxyRequest(req, res, targetPath);
}

module.exports = { chatbotProxy, mapPath };
