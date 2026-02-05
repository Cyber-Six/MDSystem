# How MDSystem Server & AI Chatbot Work Together

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React)                             │
│              mds-frontend/src/modules/e-consultation/            │
│                     (e-consultation.jsx)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    HTTP Requests (via Axios)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Express Server)                      │
│                     Backend/server.js                            │
│                                                                   │
│  1. Loads environment from .env                                  │
│  2. Initializes Redis connection                                │
│  3. Sets up middleware (CORS, JSON, error handling)             │
│  4. Registers routes (auth, EMR, etc.)                          │
│  5. *** INITIALIZES CHATBOT MODULE ***                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    initializeChatbot()
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              AI Chatbot Module Initialization                    │
│              Backend/mds-chatbot/index.js                        │
│                                                                   │
│  try {                                                            │
│    1. await llamaService.initialize(autoStartLlama)            │
│    2. app.use('/econsultation/chat', chatRoutes)               │
│    3. return { llamaService, conversationService }             │
│  } catch (error) {                                               │
│    - Log error                                                   │
│    - Continue without AI (graceful degradation)                │
│  }                                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
         Registers Route Handler at: /econsultation/chat/*
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Chat Routes Registration                        │
│            Backend/mds-chatbot/routes/chat-routes.js            │
│                                                                   │
│  Routes at: /econsultation/chat/...                            │
│  ├── POST   /session/new         (create session)               │
│  ├── POST   /message             (send message)                 │
│  ├── GET    /history/:sessionId  (get history)                 │
│  ├── DELETE /session/:sessionId  (close session)                │
│  ├── GET    /staff/active        (list chats)                  │
│  ├── GET    /staff/handoffs      (queue)                       │
│  ├── POST   /staff/takeover      (staff takeover)              │
│  ├── POST   /staff/message       (staff message)                │
│  └── GET    /health              (status)                      │
│                                                                   │
│  Each route has:                                                 │
│  - IP rate limiting (using existing matrix.js profiles)        │
│  - Safety filters (sanitization, spam detection)                │
│  - Emergency detection middleware                               │
│  - JWT protection (staff endpoints)                             │
└────────────────────────────────────────────────────────────────┘
```

---

## 📊 Request Flow Example: Sending a Chat Message

```
┌─ FRONTEND REQUEST ─────────────────────────────────────────────┐
│                                                                  │
│  POST http://localhost:3001/econsultation/chat/message          │
│  {                                                              │
│    sessionId: "abc123",                                        │
│    message: "I have a headache"                               │
│  }                                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─ SERVER RECEIVES REQUEST ──────────────────────────────────────┐
│  server.js                                                      │
│  • Express routes request to /econsultation/chat/message       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─ MIDDLEWARE CHAIN ─────────────────────────────────────────────┐
│  chat-routes.js                                                 │
│                                                                  │
│  1. patientChatLimiter (rate limit check)                      │
│     └─ If too many requests → 429 Too Many Requests           │
│                                                                  │
│  2. validateMessage middleware                                  │
│     └─ Check message length (1-2000 chars)                    │
│                                                                  │
│  3. sanitizeContent middleware                                  │
│     └─ Remove HTML/JS, prevent XSS attacks                    │
│                                                                  │
│  4. detectSpam middleware                                       │
│     └─ Check for repetitive content                           │
│                                                                  │
│  5. emergencyDetectorMiddleware                                │
│     └─ Check for 40+ emergency keywords                       │
│     └─ If emergency detected → skip AI, return emergency response
│                                                                  │
│  ✅ All passed → Continue to controller                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─ CONTROLLER HANDLER ───────────────────────────────────────────┐
│  chat-controller.js → sendMessage()                            │
│                                                                  │
│  1. Load conversation from database                            │
│     await conversationService.getConversation(sessionId)       │
│                                                                  │
│  2. Get conversation history (last 10 messages)                │
│     await conversationService.getMessages(conversationId)      │
│                                                                  │
│  3. Save user message to database                              │
│     await conversationService.addMessage(...)                  │
│                                                                  │
│  4. Send to AI (llama-service)                                 │
│     await llamaService.chat({                                  │
│       messages: [...history, userMessage],                     │
│       maxTokens: 500,                                          │
│       temperature: 0.4  // conservative                        │
│     })                                                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─ LLAMA SERVICE ────────────────────────────────────────────────┐
│  llama-service.js → chat()                                     │
│                                                                  │
│  1. Check if llama-server is running                           │
│     ├─ If NO: Start it automatically (on-demand)              │
│     │   - Spawn: ~/Models/llama.cpp/build/bin/llama-server    │
│     │   - Model: ~/Models/llama.cpp/models/Phi-3-mini...      │
│     │   - Wait: 20-40 seconds (first response)                │
│     │   - Then: 5-10 seconds (active responses)               │
│     └─ Track lastActivityTimestamp for idle timeout           │
│                                                                  │
│  2. Send HTTP request to llama-server                          │
│     POST http://localhost:8080/v1/chat/completions            │
│     {                                                          │
│       "model": "phi-3",                                        │
│       "messages": [...],                                       │
│       "temperature": 0.4,                                      │
│       "max_tokens": 500                                        │
│     }                                                          │
│                                                                  │
│  3. Parse response                                             │
│     response.choices[0].message.content                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─ RESPONSE VALIDATION ──────────────────────────────────────────┐
│  chat-controller.js → validateAndFormatResponse()              │
│                                                                  │
│  1. Check for diagnostic language (reject if found)            │
│     ├─ "I diagnose", "you have condition", etc.               │
│     └─ Return error if violation detected                      │
│                                                                  │
│  2. Check for prescription attempts (reject if found)          │
│     ├─ "take medication X", "try drug Y"                      │
│     └─ Return error if violation detected                      │
│                                                                  │
│  3. Ensure medical disclaimer is present                       │
│     └─ Add if missing: "⚠️ **Important**: This is general info" │
│                                                                  │
│  4. Format response with structure:                            │
│     - Empathy statement                                        │
│     - Information                                              │
│     - Action recommendations                                  │
│     - Escalation option                                        │
│     - Medical disclaimer                                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─ SAVE TO DATABASE ─────────────────────────────────────────────┐
│  conversation-service.js                                        │
│                                                                  │
│  await conversationService.addMessage({                        │
│    conversation_id: conversationId,                            │
│    role: 'assistant',                                          │
│    content: aiResponse,                                        │
│    metadata: { ... }                                           │
│  })                                                             │
│                                                                  │
│  Update conversation updated_at (trigger fires)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─ SEND RESPONSE BACK TO FRONTEND ───────────────────────────────┐
│  HTTP 200 OK                                                    │
│  {                                                              │
│    success: true,                                              │
│    sessionId: "abc123",                                        │
│    conversationId: 42,                                         │
│    message: "I understand you have a headache...",            │
│    messageId: "msg-456"                                        │
│  }                                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─ FRONTEND DISPLAYS ────────────────────────────────────────────┐
│  e-consultation.jsx                                             │
│  • Shows AI response in chat bubble                            │
│  • Stores message in conversation state                        │
│  • Updates UI with new message                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Key Components & Their Relationships

### 1. **server.js** (Main Server)
```javascript
// Line 20: Import chatbot functions
const { initializeChatbot, shutdownChatbot } = require('./mds-chatbot');

// Line 59-64: Initialize chatbot during startup
initializeChatbot(app, {
  autoStartLlama: process.env.AUTO_START_LLAMA === 'true'
}).then(chatbot => {
  if (chatbot) logger.info('✅ AI Medical Chatbot initialized');
  else logger.warn('⚠️ Server running without AI');
});
```

**Role:** 
- Bootstraps Express server
- Loads all configuration
- Calls chatbot initialization

---

### 2. **mds-chatbot/index.js** (Chatbot Entry Point)
```javascript
async function initializeChatbot(app, options = {}) {
  // 1. Initialize AI service
  await llamaService.initialize(options.autoStartLlama);
  
  // 2. Register routes
  app.use('/econsultation/chat', chatRoutes);
  
  // 3. Return services for graceful shutdown
  return { llamaService, conversationService };
}
```

**Role:**
- Main chatbot initialization
- Registers `/econsultation/chat` route prefix
- Handles startup/shutdown

---

### 3. **chat-routes.js** (Route Handlers)
```javascript
// Rate limiters (using existing security config)
const patientChatLimiter = ipRateLimiter('PatientAuthentication', 'chat');
const staffChatLimiter = ipRateLimiter('staffAuthentication', 'staffchat');

// Route definitions
router.post('/message', patientChatLimiter, chatController.sendMessage);
router.post('/staff/takeover', jwtProtect('medical'), staffChatLimiter, ...);
```

**Role:**
- Define all chat endpoints
- Apply security middleware (rate limiting, auth)
- Route to appropriate controllers

---

### 4. **Services** (Business Logic)

#### **llama-service.js**
- Manages llama.cpp server process
- Handles on-demand startup/shutdown
- Tracks 20-minute idle timeout
- Makes HTTP requests to llama-server

#### **conversation-service.js**
- CRUD operations on PostgreSQL
- Manages conversation sessions
- Stores/retrieves messages
- Handles database transactions

---

### 5. **Controllers** (Request Handlers)

#### **chat-controller.js**
- `createSession()` - New chat
- `sendMessage()` - Send message + get AI response
- `getHistory()` - Retrieve conversation
- `closeSession()` - End chat

#### **handoff-controller.js**
- `getActiveChats()` - List all chats
- `getHandoffQueue()` - Emergency queue
- `takeoverChat()` - Staff takeover
- `staffMessage()` - Staff responds

---

### 6. **Middleware** (Security & Validation)

#### **safety-filter.js**
- `validateMessage` - Length checks
- `sanitizeContent` - XSS prevention
- `detectSpam` - Repetition detection

#### **emergency-detector.js**
- Checks for 40+ emergency keywords
- Flags urgent messages
- Triggers staff escalation

#### **jwtProtect.js** (from main Backend)
- Verifies JWT tokens
- Staff-only endpoints

#### **ratelimiter.js** (from main Backend)
- IP-based rate limiting
- Uses matrix.js profiles
- Prevents abuse

---

## 🔌 Data Flow Summary

```
Frontend Request
    ↓
server.js (Express entry)
    ↓
middleware (validation, security)
    ↓
chat-routes.js (route matching)
    ↓
*-controller.js (business logic)
    ↓
llama-service.js (AI) + conversation-service.js (DB)
    ↓
PostgreSQL (ai_conversations, ai_messages, ai_handoff_requests)
    ↓
Response formatted + validated
    ↓
Frontend displays chat message
```

---

## ⚙️ Key Configuration Points

| Component | Config Source | Purpose |
|-----------|---------------|---------|
| **Server Port** | `MEDICAL_PORT=3001` in .env | Backend API port |
| **llama-server Port** | `LLAMA_SERVER_PORT=8080` in .env | AI model serving |
| **Model Path** | `LLAMA_MODEL_PATH=~/Models/...` | Where Phi-3 model lives |
| **On-Demand AI** | `AUTO_START_LLAMA=true` | Auto-start llama-server |
| **Idle Timeout** | `AI_IDLE_TIMEOUT_MINUTES=20` | Stop AI after 20 min inactivity |
| **Threads** | `LLAMA_THREADS=3` | CPU cores for inference |
| **Rate Limiting** | matrix.js profiles | Request limits per IP |

---

## 🚀 Startup Sequence

```
1. npm start (Backend/package.json)
   └─ node server.js

2. server.js loads
   └─ Loads .env
   └─ Initializes Express
   └─ Connects to Redis
   └─ Registers all routes

3. initializeChatbot(app) called
   └─ mds-chatbot/index.js executes
   └─ llamaService.initialize()
      └─ If AUTO_START_LLAMA=true: spawn llama-server
      └─ If AUTO_START_LLAMA=false: wait for first request
   └─ app.use('/econsultation/chat', chatRoutes)
   └─ Returns services object

4. Server listening on :3001
   └─ Ready for requests
   └─ Chatbot at /econsultation/chat/*

5. First chat request comes in
   └─ If llama-server not running: start it (20-40s)
   └─ Send request to http://localhost:8080/v1/chat/completions
   └─ Get AI response
   └─ Validate response
   └─ Save to database
   └─ Return to frontend
```

---

## 🛡️ Error Handling Strategy

```
If chatbot initialization fails:
  ├─ Log error
  ├─ Continue without AI (graceful degradation)
  └─ Server still operational with other features

If llama-server crashes:
  ├─ Log error
  ├─ Mark as down
  └─ Restart on next request (if on-demand)

If request times out:
  ├─ User sees timeout error
  ├─ Can try again
  └─ No system damage

If safety filter blocks message:
  ├─ Return validation error
  ├─ Don't send to AI
  └─ User can adjust message

If emergency keyword detected:
  ├─ Skip AI response
  ├─ Return emergency protocol
  ├─ Notify staff
  └─ Mark for handoff
```

---

## 📝 Summary

The **mds-chatbot module** is a self-contained, pluggable system that:

✅ Integrates cleanly with main Express server  
✅ Can be disabled without breaking other features  
✅ Manages its own AI service (llama-server)  
✅ Handles database persistence independently  
✅ Implements multi-layer security  
✅ Provides graceful error handling  
✅ Supports on-demand resource management  

The **server.js** acts as the orchestrator that initializes all systems, while **mds-chatbot** provides the complete AI consultation feature.
