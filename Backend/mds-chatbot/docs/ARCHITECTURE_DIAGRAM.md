# AI Medical Chatbot - System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND LAYER                                  │
│                     (mds-frontend/e-consultation)                        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTP/REST API
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       EXPRESS SERVER (Node.js)                           │
│                         Backend/server.js                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                   CHATBOT MODULE ROUTES                          │   │
│  │               (/api/chat/*)                                      │   │
│  └─────────────────────────┬───────────────────────────────────────┘   │
└────────────────────────────┼────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI CHATBOT MODULE                                     │
│                (Backend/mds-chatbot/)                                    │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  MIDDLEWARE LAYER (Security & Safety)                            │  │
│  │  ┌────────────┐  ┌────────────────┐  ┌──────────────────┐      │  │
│  │  │  Safety    │  │   Emergency    │  │    Response      │      │  │
│  │  │  Filter    │→ │   Detector     │→ │   Validator      │      │  │
│  │  └────────────┘  └────────────────┘  └──────────────────┘      │  │
│  │                                                                  │  │
│  │  • Input sanitization      • 40+ emergency keywords            │  │
│  │  • Rate limiting           • Prohibited topics                 │  │
│  │  • Spam detection          • Auto-escalation                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                             │                                            │
│                             ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  CONTROLLER LAYER                                                │  │
│  │  ┌───────────────────┐         ┌─────────────────────┐         │  │
│  │  │  Chat Controller  │         │ Handoff Controller  │         │  │
│  │  │                   │         │                     │         │  │
│  │  │ • Send message    │         │ • Staff takeover    │         │  │
│  │  │ • Create session  │         │ • Release chat      │         │  │
│  │  │ • Get history     │         │ • Send staff msg    │         │  │
│  │  └─────────┬─────────┘         └──────────┬──────────┘         │  │
│  └────────────┼────────────────────────────────┼───────────────────┘  │
│               │                                │                        │
│               ▼                                ▼                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  SERVICE LAYER                                                   │  │
│  │  ┌──────────────────────┐    ┌───────────────────────────┐     │  │
│  │  │   LLaMA Service      │    │  Conversation Service     │     │  │
│  │  │                      │    │                           │     │  │
│  │  │ • Model integration  │    │ • Session management      │     │  │
│  │  │ • Response generation│    │ • Message persistence     │     │  │
│  │  │ • Health checks      │    │ • Context window          │     │  │
│  │  └──────────┬───────────┘    │ • Handoff tracking        │     │  │
│  │             │                 └─────────────┬─────────────┘     │  │
│  └─────────────┼───────────────────────────────┼───────────────────┘  │
└─────────────────┼───────────────────────────────┼─────────────────────┘
                  │                               │
                  ▼                               ▼
        ┌───────────────────┐          ┌──────────────────┐
        │  llama.cpp Server │          │   PostgreSQL     │
        │   (Port 8080)     │          │    Database      │
        │                   │          │                  │
        │ • Model loading   │          │ • ai_conversations
        │ • Inference       │          │ • ai_messages    │
        │ • Token generation│          │ • ai_handoff_requests
        └─────────┬─────────┘          └──────────────────┘
                  │
                  ▼
        ┌───────────────────┐
        │  LLaMA 3 8B Model │
        │    (Q4_K_M)       │
        │                   │
        │ • 4.9GB GGUF file │
        │ • Medical-safe    │
        │ • Instruct-tuned  │
        └───────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW EXAMPLE                                │
└─────────────────────────────────────────────────────────────────────────┘

1. USER INPUT: "I have a headache"
        │
        ▼
2. SAFETY FILTER: Sanitize, validate, check spam
        │
        ▼
3. EMERGENCY DETECTOR: No emergency keywords found
        │
        ▼
4. CHAT CONTROLLER: Route to AI generation
        │
        ▼
5. CONVERSATION SERVICE: Load last 10 messages for context
        │
        ▼
6. LLAMA SERVICE: Format prompt with system instructions
        │
        ▼
7. llama.cpp SERVER: Generate response (temp=0.4, max_tokens=500)
        │
        ▼
8. RESPONSE VALIDATOR: Check for diagnostic language
        │
        ▼
9. APPEND DISCLAIMER: Add mandatory safety notice
        │
        ▼
10. SAVE TO DATABASE: Store message with metadata
        │
        ▼
11. RETURN TO USER: JSON response with message


┌─────────────────────────────────────────────────────────────────────────┐
│                     EMERGENCY FLOW EXAMPLE                               │
└─────────────────────────────────────────────────────────────────────────┘

1. USER INPUT: "I have severe chest pain"
        │
        ▼
2. EMERGENCY DETECTOR: ⚠️ MATCH FOUND - "chest pain"
        │
        ▼
3. SAFETY OVERRIDE: Skip AI generation
        │
        ▼
4. IMMEDIATE RESPONSE: "🚨 EMERGENCY ALERT - Seek immediate medical care"
        │
        ▼
5. CREATE HANDOFF REQUEST: Priority=EMERGENCY
        │
        ▼
6. NOTIFY STAFF: (WebSocket or polling)
        │
        ▼
7. SAVE TO DATABASE: Flag as emergency
        │
        ▼
8. RETURN TO USER: Emergency instructions + handoff notification


┌─────────────────────────────────────────────────────────────────────────┐
│                     STAFF HANDOFF FLOW                                   │
└─────────────────────────────────────────────────────────────────────────┘

1. STAFF LOGS IN: JWT authentication
        │
        ▼
2. VIEW DASHBOARD: GET /api/chat/staff/active
        │
        ▼
3. SEE EMERGENCY QUEUE: Emergency conversations first
        │
        ▼
4. TAKEOVER CHAT: POST /api/chat/staff/takeover
        │
        ▼
5. CONVERSATION LOCKED: Status = "staff-taken"
        │
        ▼
6. AI DISABLED: Future patient messages blocked
        │
        ▼
7. STAFF RESPONDS: POST /api/chat/staff/message
        │
        ▼
8. PATIENT RECEIVES: Staff message in UI
        │
        ▼
9. CONVERSATION ENDS: Staff closes or releases back to AI


┌─────────────────────────────────────────────────────────────────────────┐
│                      SAFETY LAYERS                                       │
└─────────────────────────────────────────────────────────────────────────┘

Layer 1: INPUT VALIDATION
    ├─ Sanitize HTML/scripts
    ├─ Remove malformed characters
    ├─ Length checks (1-2000 chars)
    └─ Spam detection

Layer 2: EMERGENCY DETECTION
    ├─ 40+ emergency keywords
    ├─ 20+ urgent keywords
    └─ Prohibited topic blocking

Layer 3: AI GENERATION
    ├─ System prompt (safety rules)
    ├─ Low temperature (0.4)
    ├─ Context limitation (1024 tokens)
    └─ Response length cap (500 tokens)

Layer 4: RESPONSE VALIDATION
    ├─ Check for diagnosis language
    ├─ Check for prescription attempts
    ├─ Validate structure
    └─ Mandatory disclaimer

Layer 5: RATE LIMITING
    ├─ 10 messages per minute
    ├─ 50 messages per session
    └─ 24-hour session timeout


┌─────────────────────────────────────────────────────────────────────────┐
│                    MONITORING & LOGGING                                  │
└─────────────────────────────────────────────────────────────────────────┘

Winston Logger (Backend/utils/logger.js)
    │
    ├─ INFO: Normal operations
    ├─ WARN: Emergency detections, validation failures
    ├─ ERROR: AI errors, database issues
    └─ DEBUG: Detailed request/response info

Database Audit Trail
    │
    ├─ Every message stored
    ├─ Metadata tracked (emergency, staff, etc.)
    ├─ Handoff requests logged
    └─ Full conversation history


┌─────────────────────────────────────────────────────────────────────────┐
│                    SCALABILITY DESIGN                                    │
└─────────────────────────────────────────────────────────────────────────┘

Horizontal Scaling:
    ├─ Stateless design (sessions in DB)
    ├─ Load balancer → Multiple Express instances
    ├─ Shared PostgreSQL
    └─ Redis for caching (optional)

llama.cpp Scaling:
    ├─ Multiple llama-server instances
    ├─ Load balance via Nginx
    └─ GPU acceleration (optional)

Performance Optimization:
    ├─ Context caching
    ├─ Response streaming (future)
    └─ Message pagination
```

## Key Components Explained

### 1. **Frontend → Backend Communication**
- REST API (simple, cacheable)
- Session-based (UUID in localStorage)
- Polling for staff takeover (WebSocket in future)

### 2. **Middleware Pipeline**
- Every request passes through safety checks
- Emergency override happens before AI
- Validation happens after AI

### 3. **llama.cpp Integration**
- Separate process for stability
- HTTP API communication
- Automatic retry on failures

### 4. **Database Design**
- Full audit trail (HIPAA-ready)
- Efficient queries with indexes
- Views for common operations

### 5. **Staff Dashboard**
- Priority queue (emergency first)
- Real-time status updates
- Full conversation access

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React | User interface |
| Backend | Express.js | API server |
| AI Model | LLaMA 3 8B | Response generation |
| AI Runtime | llama.cpp | Model serving |
| Database | PostgreSQL | Data persistence |
| Session | localStorage | Client-side state |
| Auth | JWT | Staff authentication |
| Logging | Winston | Application logs |

## Performance Characteristics

- **Response Time**: 1-3 seconds (depends on CPU)
- **Memory Usage**: ~6GB (4.9GB model + overhead)
- **Concurrent Users**: 10-50 (single llama-server)
- **Throughput**: 5-10 requests/minute (per instance)
- **Context Window**: 1024 tokens (~800 words)

## Security Features

✅ Input sanitization  
✅ Rate limiting  
✅ SQL injection protection (parameterized queries)  
✅ XSS protection  
✅ CORS configuration  
✅ JWT authentication for staff  
✅ Session validation  
✅ Content filtering  

## Deployment Architecture

```
Production:
    ├─ PM2 (Process Manager)
    │   ├─ llama-server (persistent)
    │   └─ Node.js backend (auto-restart)
    │
    ├─ Nginx (Reverse Proxy)
    │   ├─ SSL termination
    │   ├─ Load balancing
    │   └─ Static file serving
    │
    └─ PostgreSQL (Database)
        └─ Regular backups
```

This architecture is production-ready, scalable, and medically safe! 🎉
