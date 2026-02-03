# AI Medical Chatbot Module

## Overview
A locally-run AI medical chatbot powered by LLaMA 3 8B that provides general health information and support while healthcare staff are offline. The system includes robust safety features, emergency detection, and seamless staff handoff capabilities.

## ⚠️ Important Safety Features

- **NOT a diagnostic tool** - Provides general information only
- **Emergency detection** - Automatically identifies critical symptoms
- **No prescriptions** - Never suggests medication or dosages
- **Staff handoff** - Healthcare professionals can take over conversations
- **Response validation** - All AI responses checked for safety
- **Mandatory disclaimers** - Clear warnings on every response

## 🏗️ Architecture

```
Frontend (e-consultation.jsx)
    ↓ HTTP/REST API
Backend Express Server
    ↓
AI Chatbot Module (/mds-chatbot/)
    ├── Safety Middleware (emergency detection)
    ├── Conversation Manager (history, context)
    ├── LLaMA Service (model integration)
    └── Handoff System (staff takeover)
    ↓
Local llama.cpp Server
    ↓
LLaMA 3 8B Instruct Model
```

## 📁 Folder Structure

```
Backend/mds-chatbot/
├── index.js                    # Module entry point
├── config/
│   ├── model-config.js         # Model settings & prompts
│   └── safety-rules.js         # Emergency keywords & rules
├── controllers/
│   ├── chat-controller.js      # Chat request handling
│   └── handoff-controller.js   # Staff takeover logic
├── middleware/
│   ├── safety-filter.js        # Input validation & sanitization
│   └── emergency-detector.js   # Emergency keyword detection
├── services/
│   ├── llama-service.js        # llama.cpp integration
│   └── conversation-service.js # Database operations
├── routes/
│   └── chat-routes.js          # API endpoints
├── database/
│   └── schema.sql              # Database schema
└── models-storage/             # Model files (gitignored)
    └── .gitkeep
```

## 🚀 Setup Instructions

### Prerequisites

1. **System Requirements**
   - RAM: 16GB minimum (32GB recommended)
   - Storage: 10GB for model files
   - OS: Windows/Linux/macOS
   - CPU: Multi-core processor

2. **Software Dependencies**
   - Node.js v18+
   - PostgreSQL v14+
   - llama.cpp with server mode

### Step 1: Install llama.cpp

**Windows (using Visual Studio):**
```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
cmake -B build
cmake --build build --config Release
```

**Linux/macOS:**
```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make
```

### Step 2: Download LLaMA 3 8B Model

Download the model file and place it in `Backend/mds-chatbot/models-storage/`:

```bash
# Create directory
mkdir -p Backend/mds-chatbot/models-storage

# Download model (using Hugging Face CLI or direct download)
# Example: llama-3-8b-instruct.Q4_K_M.gguf
# Place it in models-storage/ folder
```

**Recommended model:** `llama-3-8b-instruct.Q4_K_M.gguf` (~4.9GB)

### Step 3: Database Setup

Run the database migration:

```bash
psql -U your_username -d your_database -f Backend/mds-chatbot/database/schema.sql
```

Or using your existing database connection:

```javascript
const db = require('./config/db');
const fs = require('fs');

const schema = fs.readFileSync('./mds-chatbot/database/schema.sql', 'utf8');
await db.query(schema);
```

### Step 4: Environment Variables

Add to your `.env` file:

```env
# LLaMA Server Configuration
LLAMA_SERVER_HOST=localhost
LLAMA_SERVER_PORT=8080
AUTO_START_LLAMA=false  # Set to true to auto-start llama.cpp

# Model Path (optional - defaults to models-storage/)
# LLAMA_MODEL_PATH=/path/to/your/model.gguf
```

### Step 5: Install Node Dependencies

```bash
cd Backend
npm install axios uuid joi
```

### Step 6: Start llama.cpp Server

**Option A: Manual Start (Recommended)**
```bash
cd llama.cpp
./llama-server -m /path/to/llama-3-8b-instruct.Q4_K_M.gguf -c 1024 --port 8080
```

**Option B: Auto-start (set `AUTO_START_LLAMA=true` in .env)**
The service will spawn llama-server automatically when the backend starts.

### Step 7: Integrate into Express Server

Update your `Backend/server.js`:

```javascript
const { initializeChatbot, shutdownChatbot } = require('./mds-chatbot');

// ... existing code ...

// Initialize chatbot
initializeChatbot(app, {
  autoStartLlama: process.env.AUTO_START_LLAMA === 'true'
}).then(chatbot => {
  if (chatbot) {
    logger.info('✅ AI Medical Chatbot ready');
  } else {
    logger.warn('⚠️ AI Medical Chatbot not available');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await shutdownChatbot();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdownChatbot();
  process.exit(0);
});
```

## 📡 API Endpoints

### Patient Endpoints

#### Create Session
```http
POST /api/chat/session/new
Response: { success: true, session: { sessionId, ... } }
```

#### Send Message
```http
POST /api/chat/message
Content-Type: application/json

{
  "sessionId": "uuid",
  "message": "I have a headache"
}

Response: {
  "sessionId": "uuid",
  "message": "AI response...",
  "role": "assistant",
  "timestamp": "2026-02-03T..."
}
```

#### Get History
```http
GET /api/chat/history/:sessionId
Response: { messages: [...], count: 10 }
```

### Staff Endpoints (Requires JWT)

#### Get Active Chats
```http
GET /api/chat/staff/active
Authorization: Bearer <jwt_token>
```

#### Take Over Chat
```http
POST /api/chat/staff/takeover
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "sessionId": "uuid"
}
```

#### Send Staff Message
```http
POST /api/chat/staff/message
Authorization: Bearer <jwt_token>

{
  "sessionId": "uuid",
  "message": "Hello, I'm here to help"
}
```

## 🛡️ Safety Features

### Emergency Detection
Automatically detects critical keywords:
- Cardiac: "chest pain", "heart attack"
- Respiratory: "can't breathe", "shortness of breath"
- Neurological: "stroke", "seizure", "unconscious"
- Mental health: "suicidal", "kill myself"
- Severe trauma: "severe bleeding", "heavy bleeding"

### Response Validation
Every AI response is checked for:
- Diagnostic language ("you have", "this is")
- Prescription attempts
- Dangerous medical advice
- Missing disclaimers

### Rate Limiting
- 10 messages per minute per session
- 50 messages maximum per session
- 24-hour session timeout

## 🧪 Testing

### Test Emergency Detection
```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-uuid","message":"I have severe chest pain"}'
```

Expected: Emergency response with immediate care instructions.

### Test Normal Query
```bash
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-uuid","message":"How can I improve my sleep?"}'
```

Expected: General health information with disclaimer.

## 📊 Monitoring

### Health Check
```http
GET /api/chat/health

Response: {
  "status": "healthy",
  "service": "ai-medical-chatbot",
  "initialized": true,
  "baseUrl": "http://localhost:8080"
}
```

### Database Queries

**Active conversations:**
```sql
SELECT * FROM active_ai_chats;
```

**Emergency queue:**
```sql
SELECT * FROM emergency_handoff_queue;
```

## 🔧 Troubleshooting

### llama.cpp won't start
- Check if model file exists at correct path
- Verify sufficient RAM available
- Check port 8080 is not in use

### Slow responses
- Reduce `contextSize` in model-config.js
- Use smaller context window (512 instead of 1024)
- Ensure CPU isn't throttled

### Database errors
- Run schema.sql migration
- Check if `patients` and `staff` tables exist
- Verify database connection in config/db.js

## 📝 Configuration

### Adjust Response Safety
Edit `Backend/mds-chatbot/config/model-config.js`:

```javascript
generationParams: {
  temperature: 0.4,  // Lower = more conservative
  maxTokens: 500,    // Limit response length
}
```

### Add Emergency Keywords
Edit `Backend/mds-chatbot/config/safety-rules.js`:

```javascript
emergencyKeywords: [
  // Add your keywords here
  'new symptom',
]
```

## 🚦 Status

- ✅ LLaMA service integration
- ✅ Safety middleware & emergency detection
- ✅ Conversation management
- ✅ API endpoints
- ✅ Staff handoff system
- ⏳ Frontend integration (next step)
- ⏳ WebSocket real-time updates (future)
- ⏳ RAG system for medical knowledge (future)

## 📚 Next Steps

1. Update frontend to use new API
2. Test emergency detection thoroughly
3. Add WebSocket for real-time staff notifications
4. Implement comprehensive logging
5. Add analytics dashboard

## 🔒 Security Notes

- All staff endpoints require JWT authentication
- Messages are sanitized before processing
- Rate limiting prevents abuse
- Conversation data encrypted at rest (recommended)
- HIPAA compliance considerations (consult legal)

## 📄 License

Part of the MDSystem project. Internal use only.
