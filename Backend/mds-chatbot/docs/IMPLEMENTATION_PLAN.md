# AI Medical Chatbot Implementation Plan

## Overview
This plan outlines the implementation of a locally-run LLaMA 3 8B medical chatbot that integrates with the e-consultation module. The system prioritizes medical safety, proper disclaimers, and seamless handoff to healthcare professionals.

---

## Architecture Design

### High-Level Architecture
```
Frontend (e-consultation.jsx)
    ↓ HTTP/WebSocket
Backend Express Server (Node.js)
    ↓
AI Chatbot Module (/Backend/ai-medical-chatbot/)
    ├── Safety Middleware (emergency detection, guardrails)
    ├── Conversation Manager (history, context)
    ├── llama.cpp Bridge (local model integration)
    └── Staff Handoff System (monitoring, takeover)
    ↓
Local LLaMA 3 8B Model (llama.cpp server)
```

---

## Folder Structure

### Backend/ai-medical-chatbot/
```
Backend/ai-medical-chatbot/
├── index.js                    # Main module entry point
├── config/
│   ├── model-config.js         # Model settings, prompts, parameters
│   └── safety-rules.js         # Emergency keywords, restricted topics
├── controllers/
│   ├── chat-controller.js      # Handle chat requests
│   └── handoff-controller.js   # Staff takeover logic
├── middleware/
│   ├── safety-filter.js        # Pre-process message safety checks
│   ├── emergency-detector.js   # Detect critical symptoms
│   └── response-validator.js   # Post-process AI responses
├── services/
│   ├── llama-service.js        # llama.cpp integration
│   ├── conversation-service.js # Manage chat history & context
│   └── handoff-service.js      # Staff notification & takeover
├── models/
│   ├── conversation.js         # Chat session schema
│   └── handoff-request.js      # Staff escalation schema
├── utils/
│   ├── prompt-builder.js       # Construct system prompts
│   └── message-formatter.js    # Format messages for model
├── routes/
│   └── chat-routes.js          # API endpoints
├── models-storage/             # Local model files (gitignored)
│   └── .gitkeep
└── README.md                   # Setup instructions
```

---

## Component Details

### 1. Model Configuration (config/model-config.js)
```javascript
module.exports = {
  modelPath: './ai-medical-chatbot/models-storage/llama-3-8b-instruct.Q4_K_M.gguf',
  contextSize: 1024,
  temperature: 0.4,
  topP: 0.9,
  repeatPenalty: 1.15,
  systemPrompt: `You are a medical support assistant, not a doctor.

Rules:
- You do NOT diagnose illnesses.
- You do NOT prescribe medication or give dosages.
- You do NOT replace professional medical advice.
- You provide general health information only.
...`
};
```

### 2. Safety Middleware (middleware/safety-filter.js)
- **Emergency Detection**: Scans for critical keywords (chest pain, can't breathe, etc.)
- **Topic Restrictions**: Blocks prescription requests, diagnosis demands
- **Input Validation**: Sanitizes user input
- **Override Responses**: Returns immediate emergency messages when needed

### 3. llama.cpp Integration (services/llama-service.js)
```javascript
class LlamaService {
  async initialize() {
    // Start llama.cpp server subprocess
    // Health check endpoint
  }
  
  async generateResponse(messages, options) {
    // Send request to local llama.cpp server
    // Stream or batch response
  }
  
  async shutdown() {
    // Gracefully stop model server
  }
}
```

### 4. Conversation Management (services/conversation-service.js)
- Store chat history in database (PostgreSQL)
- Track conversation state (AI-only vs staff-involved)
- Maintain context window (last N messages)
- Generate conversation summaries for staff

### 5. Staff Handoff System (services/handoff-service.js)
- Real-time notification system (WebSocket/Socket.io)
- Queue management for incoming chats
- Freeze AI responses when staff takes over
- Store full transcript with timestamps
- Track AI vs Human responses

---

## API Endpoints

### Chat Endpoints
```
POST   /api/ai-chat/message           # Send message, get AI response
GET    /api/ai-chat/history/:sessionId # Retrieve conversation history
POST   /api/ai-chat/session/new       # Start new chat session
DELETE /api/ai-chat/session/:sessionId # Clear chat session
```

### Staff Endpoints
```
GET    /api/ai-chat/staff/active      # Get all active chat sessions
POST   /api/ai-chat/staff/takeover    # Take over a chat session
POST   /api/ai-chat/staff/release     # Release chat back to AI
GET    /api/ai-chat/staff/transcript/:sessionId # Full conversation log
```

### Admin Endpoints
```
GET    /api/ai-chat/admin/stats       # Usage statistics
POST   /api/ai-chat/admin/model/reload # Reload model settings
```

---

## Database Schema

### conversations Table
```sql
CREATE TABLE ai_conversations (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  patient_id INT REFERENCES patients(id),
  status VARCHAR(50) DEFAULT 'ai-active', -- ai-active, staff-taken, closed
  staff_id INT REFERENCES staff(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);
```

### messages Table
```sql
CREATE TABLE ai_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- user, assistant, system, staff
  content TEXT NOT NULL,
  metadata JSONB, -- emergency_detected, safety_override, etc.
  created_at TIMESTAMP DEFAULT NOW()
);
```

### handoff_requests Table
```sql
CREATE TABLE ai_handoff_requests (
  id SERIAL PRIMARY KEY,
  conversation_id INT REFERENCES ai_conversations(id),
  reason VARCHAR(255), -- emergency, patient_request, auto_escalation
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, emergency
  status VARCHAR(50) DEFAULT 'pending', -- pending, assigned, resolved
  assigned_staff_id INT REFERENCES staff(id),
  created_at TIMESTAMP DEFAULT NOW(),
  assigned_at TIMESTAMP,
  resolved_at TIMESTAMP
);
```

---

## Safety Implementation

### Emergency Keywords Detection
```javascript
const EMERGENCY_KEYWORDS = [
  'chest pain', 'heart attack', "can't breathe", 'shortness of breath',
  'severe bleeding', 'heavy bleeding', 'fainted', 'passed out',
  'seizure', 'convulsing', 'suicidal', 'kill myself',
  'overdose', 'poisoning', 'severe pain', 'unconscious'
];
```

### Response Structure Enforcement
Every AI response must follow:
1. **Empathy/Acknowledgment**
2. **Clarifying Question** (if needed)
3. **General Information** (non-diagnostic)
4. **Suggested Actions** (safe only)
5. **When to Seek Help**
6. **Disclaimer**

### Guardrails
- **Max Response Length**: 500 tokens
- **Refusal Training**: Model must refuse diagnosis/prescription requests
- **Mandatory Disclaimers**: Appended to every response
- **Rate Limiting**: 10 messages per minute per session
- **Content Filtering**: Block inappropriate content

---

## Integration Steps

### Phase 1: Local Model Setup
1. Install llama.cpp on your system
2. Download LLaMA 3 8B Instruct Q4_K_M model
3. Test model locally with sample prompts
4. Verify response quality and safety

### Phase 2: Backend Service Development
1. Create `ai-medical-chatbot` folder structure
2. Implement llama-service.js (model integration)
3. Build safety middleware (emergency detection)
4. Create conversation management system
5. Set up database tables

### Phase 3: API Development
1. Create chat routes and controllers
2. Implement WebSocket for real-time updates
3. Build staff handoff endpoints
4. Add authentication/authorization

### Phase 4: Frontend Integration
1. Update e-consultation.jsx to use new API
2. Add emergency alert UI
3. Implement staff takeover indicators
4. Add disclaimer displays

### Phase 5: Testing & Refinement
1. Test emergency detection accuracy
2. Validate response safety
3. Load testing
4. Staff workflow testing
5. Security audit

---

## Technical Requirements

### System Requirements
- **OS**: Windows/Linux/macOS
- **RAM**: 16GB minimum (32GB recommended)
- **Storage**: 10GB for model files
- **CPU**: Modern multi-core processor (GPU optional but beneficial)

### Software Dependencies
- **Node.js**: v18+ (for async/await, native fetch)
- **llama.cpp**: Latest build with server mode
- **PostgreSQL**: v14+
- **Redis**: v7+ (for session management)

### Node Packages
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "socket.io": "^4.6.0",
    "pg": "^8.11.0",
    "ioredis": "^5.3.2",
    "uuid": "^9.0.0",
    "joi": "^17.11.0"
  }
}
```

---

## Security Considerations

### Authentication
- All endpoints require valid JWT token
- Session ownership validation
- Staff role verification for takeover

### Data Privacy
- HIPAA-compliant logging (no PHI in plain logs)
- Encrypted conversation storage
- Automatic session expiry (24 hours)
- Secure model file storage

### Rate Limiting
- 10 messages/minute per user
- 100 requests/hour per IP
- Emergency requests bypass limits

---

## Monitoring & Logging

### Metrics to Track
- Response time (target: <2 seconds)
- Emergency detections per day
- Staff takeover rate
- User satisfaction (optional survey)
- Model hallucination incidents

### Logging Strategy
```javascript
logger.info('AI Response Generated', {
  sessionId,
  responseTime,
  emergencyDetected: false,
  safetyOverride: false
});
```

---

## Deployment Considerations

### Local Development
```bash
# Start llama.cpp server
./llama-server -m model.gguf -c 1024 --port 8080

# Start Node.js backend
npm run dev
```

### Production Setup
- Use process manager (PM2) for both llama.cpp and Node.js
- Set up monitoring (Prometheus + Grafana)
- Configure log rotation
- Implement automated backups

---

## Future Enhancements

1. **RAG System**: Integrate medical knowledge base (WHO, CDC content)
2. **Multi-language Support**: Translate to local languages
3. **Voice Input**: Speech-to-text integration
4. **Appointment Booking**: Direct integration with scheduling
5. **Analytics Dashboard**: Staff performance, common inquiries
6. **Model Fine-tuning**: Custom medical knowledge training

---

## Success Criteria

✅ Model responds within 2 seconds  
✅ 100% emergency keyword detection rate  
✅ Zero diagnosis or prescription in responses  
✅ Staff can take over seamlessly  
✅ No medical liability issues  
✅ Positive user feedback  
✅ Reduced nurse/doctor offline inquiry load  

---

## Next Steps

1. Review and approve this plan
2. Set up development environment
3. Download and test LLaMA 3 8B model locally
4. Begin Phase 1 implementation
5. Iterative development with safety testing at each step

---

**Note**: This is a living document. Update as implementation progresses and requirements evolve.
