const { createServer } = require('node:http');
const express = require('express');
const request = require('supertest');
const { withEnvironment } = require('../../test-support/fixtures.cjs');

jest.mock('../../utils/logger', () => require('../../test-support/fixtures.cjs').loggerMock());

test.each([
  ['disconnects', 502, 'CHATBOT_UNAVAILABLE', 'Unable to reach the AI chatbot service.'],
  ['stalls', 504, 'CHATBOT_TIMEOUT', 'AI chatbot service did not respond in time.'],
])('handles an upstream that %s with a structured %i response', async (failure, status, error, message) => {
  const observed = jest.fn();
  const upstream = createServer((req) => {
    observed(req.url, req.headers['x-api-key']);
    if (failure === 'disconnects') req.socket.destroy();
  });
  await new Promise((resolve, reject) => {
    upstream.once('error', reject);
    upstream.listen(0, '127.0.0.1', resolve);
  });

  const restoreEnv = withEnvironment({
    CHATBOT_URL: `http://127.0.0.1:${upstream.address().port}`,
    CHATBOT_API_KEY: 'proxy-integration-key',
    CHATBOT_PROXY_TIMEOUT_MS: '200',
  });
  try {
    const app = express();
    jest.isolateModules(() => {
      const { chatbotProxy } = require('./chatbotProxy');
      app.use('/econsultation/chat', chatbotProxy);
    });

    await request(app)
      .get('/econsultation/chat/health?source=test')
      .timeout({ deadline: 3_000 })
      .expect(status)
      .expect({ error, message });
    expect(observed).toHaveBeenCalledWith('/api/health?source=test', 'proxy-integration-key');
  } finally {
    restoreEnv();
    upstream.closeAllConnections();
    await new Promise(resolve => upstream.close(resolve));
  }
});
