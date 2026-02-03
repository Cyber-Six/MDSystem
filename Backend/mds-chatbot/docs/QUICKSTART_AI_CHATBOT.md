# 🚀 Quick Start Guide - AI Medical Chatbot

This guide will walk you through setting up the locally-run AI medical chatbot.

## Prerequisites Checklist

- [ ] Node.js v18 or higher installed
- [ ] PostgreSQL v14 or higher installed
- [ ] 16GB+ RAM available
- [ ] 10GB+ free disk space for model
- [ ] Git (for cloning llama.cpp)

---

## Step 1: Install llama.cpp

### Windows

```powershell
# Install build tools (if not already installed)
# Download Visual Studio 2022 Community with C++ support

# Clone llama.cpp
cd C:\
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Build with CMake
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release

# Verify installation
.\build\bin\Release\llama-server.exe --version
```

### Linux/macOS

```bash
# Clone llama.cpp
cd ~
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Build
make

# Verify installation
./llama-server --version
```

---

## Step 2: Download AI Model

### Option A: Direct Download (Recommended)

1. Visit: https://huggingface.co/TheBloke/Llama-3-8B-Instruct-GGUF
2. Download: `llama-3-8b-instruct.Q4_K_M.gguf` (~4.9GB)
3. Move to: `Backend/mds-chatbot/models-storage/`

### Option B: Using Hugging Face CLI

```bash
# Install CLI
pip install huggingface-hub

# Download model
huggingface-cli download TheBloke/Llama-3-8B-Instruct-GGUF \
  llama-3-8b-instruct.Q4_K_M.gguf \
  --local-dir Backend/mds-chatbot/models-storage
```

### Verify Model

```bash
# Check file exists and size
ls -lh Backend/mds-chatbot/models-storage/llama-3-8b-instruct.Q4_K_M.gguf

# Should be approximately 4.9GB
```

---

## Step 3: Database Setup

### Create Tables

```bash
# Connect to your database
psql -U your_username -d your_database

# Run the schema
\i Backend/mds-chatbot/database/schema.sql

# Verify tables
\dt ai_*

# Expected tables:
# - ai_conversations
# - ai_messages
# - ai_handoff_requests
```

### Alternative: Using Node

```javascript
// In Backend/ directory
node -e "
const db = require('./config/db');
const fs = require('fs');
const schema = fs.readFileSync('./mds-chatbot/database/schema.sql', 'utf8');
db.query(schema).then(() => console.log('✅ Schema created'));
"
```

---

## Step 4: Install Dependencies

```bash
cd Backend

# Install new packages
npm install axios uuid joi

# Or update package.json
npm install
```

---

## Step 5: Configure Environment

Add to `Backend/.env`:

```env
# AI Chatbot Configuration
LLAMA_SERVER_HOST=localhost
LLAMA_SERVER_PORT=8080
AUTO_START_LLAMA=false

# Optional: Custom model path
# LLAMA_MODEL_PATH=/path/to/custom/model.gguf
```

---

## Step 6: Start llama.cpp Server

### Terminal 1: llama.cpp Server

```bash
# Windows
cd C:\llama.cpp
.\build\bin\Release\llama-server.exe ^
  -m C:\Code-Workspace\K1taru\MDSystem\Backend\mds-chatbot\models-storage\llama-3-8b-instruct.Q4_K_M.gguf ^
  -c 1024 ^
  --port 8080 ^
  --host localhost

# Linux/macOS
cd ~/llama.cpp
./llama-server \
  -m ~/Code-Workspace/K1taru/MDSystem/Backend/mds-chatbot/models-storage/llama-3-8b-instruct.Q4_K_M.gguf \
  -c 1024 \
  --port 8080 \
  --host localhost
```

**Expected output:**
```
llama server listening at http://localhost:8080
```

---

## Step 7: Start Backend Server

### Terminal 2: Node.js Backend

```bash
cd Backend
npm run dev
```

**Expected output:**
```
✅ Redis initialized
✅ AI Medical Chatbot initialized
⚙️ Server running on localhost:3001
```

---

## Step 8: Test the System

### Test 1: Health Check

```bash
curl http://localhost:3001/api/chat/health
```

**Expected:**
```json
{
  "status": "healthy",
  "service": "ai-medical-chatbot",
  "initialized": true,
  "baseUrl": "http://localhost:8080"
}
```

### Test 2: Create Session

```bash
curl -X POST http://localhost:3001/api/chat/session/new \
  -H "Content-Type: application/json"
```

**Expected:**
```json
{
  "success": true,
  "session": {
    "sessionId": "uuid-here",
    "status": "ai-active"
  }
}
```

### Test 3: Send Message

```bash
# Save session ID from previous test
SESSION_ID="your-session-id-here"

curl -X POST http://localhost:3001/api/chat/message \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"message\":\"What should I do if I have a headache?\"}"
```

**Expected:** AI response with health information and disclaimer.

### Test 4: Emergency Detection

```bash
curl -X POST http://localhost:3001/api/chat/message \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"message\":\"I have severe chest pain\"}"
```

**Expected:** Emergency response directing to immediate care.

---

## Step 9: Test Frontend

1. Start frontend dev server:
```bash
cd ../mds-frontend
npm run dev
```

2. Open browser: http://localhost:5173
3. Navigate to E-Consultation
4. Type a message and verify AI responds

---

## Troubleshooting

### Issue: llama-server not found

**Solution:**
- Verify llama.cpp build completed
- Add llama.cpp to PATH
- Use full path to executable

### Issue: Model file not found

**Solution:**
```bash
# Check model path
ls Backend/mds-chatbot/models-storage/

# Update path in Backend/mds-chatbot/config/model-config.js if needed
```

### Issue: Connection refused (ECONNREFUSED)

**Solution:**
- Ensure llama-server is running on port 8080
- Check firewall settings
- Verify port not in use: `netstat -an | grep 8080`

### Issue: Slow responses (>10 seconds)

**Solution:**
- Reduce context size in model-config.js
- Use faster model (Phi-3 Mini)
- Increase system RAM allocation
- Close other memory-intensive applications

### Issue: Database errors

**Solution:**
```bash
# Verify tables exist
psql -d your_database -c "\dt ai_*"

# Re-run schema
psql -d your_database -f Backend/mds-chatbot/database/schema.sql
```

### Issue: Out of memory

**Solution:**
- Close other applications
- Use smaller model (Q3 or Q2 quantization)
- Reduce context size to 512
- Increase system swap space

---

## Production Deployment

### Using PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start llama.cpp
pm2 start llama-server \
  --name llama-ai \
  -- -m /path/to/model.gguf -c 1024 --port 8080

# Start Backend
cd Backend
pm2 start npm --name backend -- start

# Save configuration
pm2 save
pm2 startup
```

### Auto-start on Boot

```bash
# After starting services with PM2
pm2 save
pm2 startup

# Follow the instructions provided
```

---

## Monitoring

### View Logs

```bash
# llama.cpp logs
pm2 logs llama-ai

# Backend logs
pm2 logs backend

# All logs
pm2 logs
```

### Check Status

```bash
pm2 status
pm2 monit
```

---

## Next Steps

- [ ] Test emergency detection thoroughly
- [ ] Configure staff authentication for handoff
- [ ] Set up WebSocket for real-time updates
- [ ] Configure logging and monitoring
- [ ] Set up automated backups
- [ ] Review security settings
- [ ] Load test the system
- [ ] Train staff on handoff procedures

---

## Support

For issues or questions:
1. Check logs: `pm2 logs` or console output
2. Review [Backend/mds-chatbot/README.md](Backend/mds-chatbot/README.md)
3. Check [IMPLEMENTATION_PLAN.md](Backend/mds-chatbot/IMPLEMENTATION_PLAN.md)

---

## Success Criteria

✅ llama-server running and accessible  
✅ Backend health check passes  
✅ Can create chat session  
✅ AI responds to messages  
✅ Emergency detection works  
✅ Frontend connects successfully  
✅ Response time < 2 seconds  
✅ No memory leaks after 1 hour  

**You're all set! 🎉**
