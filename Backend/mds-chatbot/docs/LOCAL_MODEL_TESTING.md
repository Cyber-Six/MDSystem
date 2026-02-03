# Local Model Testing Guide

> **Purpose**: Test the AI medical chatbot directly with llama.cpp, bypassing the backend and database to verify the model responds correctly on the frontend.

---

## Quick Start (TL;DR)

```bash
# 1. Download llama.cpp
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# 2. Build it
cmake -B build
cmake --build build --config Release

# 3. Download the model (~4.9GB)
# Download from: https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf

# 4. Start the server
./build/bin/llama-server -m llama-2-7b-chat.Q4_K_M.gguf -c 1024 --host 0.0.0.0 --port 8080

# 5. Configure frontend
# In mds-frontend/.env:
VITE_AI_TEST_MODE=true
VITE_LLAMA_DIRECT_URL=http://localhost:8080

# 6. Start frontend
cd mds-frontend
npm run dev
```

---

## Detailed Setup

### Step 1: Download and Build llama.cpp

#### Windows (using CMake + Visual Studio)

```powershell
# Clone the repository
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Build with CMake
cmake -B build
cmake --build build --config Release

# The server executable will be at:
# build\bin\Release\llama-server.exe
```

#### Windows (using Pre-built Release)

1. Go to: https://github.com/ggerganov/llama.cpp/releases
2. Download the latest `llama-*-bin-win-*.zip` (e.g., `llama-b4000-bin-win-cuda-cu12.2.0-x64.zip` for CUDA)
3. Extract to a folder

#### Linux/macOS

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make

# Or with CMake:
cmake -B build
cmake --build build --config Release
```

### Step 2: Download the Model

**Recommended Model**: LLaMA 3 8B Instruct (Q4_K_M quantization)
- File size: ~4.9GB
- Good balance of quality and speed

#### Download Options:

**Option A: Using Hugging Face CLI**
```bash
pip install huggingface_hub
huggingface-cli download TheBloke/LLaMA-2-7B-Chat-GGUF llama-2-7b-chat.Q4_K_M.gguf --local-dir ./models
```

**Option B: Direct Download**
- LLaMA 2 7B Chat: https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf
- LLaMA 3 8B Instruct: https://huggingface.co/bartowski/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct-Q4_K_M.gguf

**Option C: Using PowerShell (Windows)**
```powershell
Invoke-WebRequest -Uri "https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf" -OutFile "models/llama-2-7b-chat.Q4_K_M.gguf"
```

### Step 3: Start the llama.cpp Server

#### Windows
```powershell
# Navigate to llama.cpp folder
cd llama.cpp

# Start server (adjust path to your model file)
.\build\bin\Release\llama-server.exe -m models\llama-2-7b-chat.Q4_K_M.gguf -c 1024 --host 0.0.0.0 --port 8080
```

#### Linux/macOS
```bash
./llama-server -m models/llama-2-7b-chat.Q4_K_M.gguf -c 1024 --host 0.0.0.0 --port 8080
```

#### Server Options Explained
| Flag | Description |
|------|-------------|
| `-m` | Path to the GGUF model file |
| `-c 1024` | Context window (number of tokens to remember) |
| `--host 0.0.0.0` | Listen on all interfaces |
| `--port 8080` | Port number |
| `-ngl 35` | Number of layers to offload to GPU (if available) |

#### Verify Server is Running
Open browser: http://localhost:8080

You should see the llama.cpp web interface.

### Step 4: Configure Frontend for Test Mode

Create or edit `mds-frontend/.env`:

```env
# API URLs
VITE_API_URL=http://localhost:3001

# Test Mode Configuration
VITE_AI_TEST_MODE=true
VITE_LLAMA_DIRECT_URL=http://localhost:8080
```

**Environment Variables Explained:**
| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_AI_TEST_MODE` | `true` | Enables test mode (bypasses backend) |
| `VITE_LLAMA_DIRECT_URL` | `http://localhost:8080` | Direct URL to llama.cpp server |
| `VITE_API_URL` | `http://localhost:3001` | Backend URL (used when test mode is off) |

### Step 5: Start the Frontend

```bash
cd mds-frontend
npm install  # If not already done
npm run dev
```

Open browser: http://localhost:5173 (or the port shown in terminal)

Navigate to the E-Consultation page. You should see:
- **Yellow badge**: "🧪 Test Mode - Direct llama.cpp connection (no database)"
- **Connection Status**: "Test mode (direct llama.cpp)"

---

## How Test Mode Works

When `VITE_AI_TEST_MODE=true`, the frontend:

1. **Bypasses the backend entirely** - No `/api/chat/*` calls
2. **Connects directly to llama.cpp** - Sends requests to `http://localhost:8080/completion`
3. **Uses localStorage** - Messages are saved locally instead of a database
4. **Includes medical safety prompt** - The system prompt is embedded in the frontend
5. **Detects emergencies client-side** - Emergency keywords trigger immediate warnings

### Automatic Fallback

Even without `VITE_AI_TEST_MODE=true`, the frontend will:
1. First try to connect to the backend (`/api/chat/health`)
2. If backend fails, try llama.cpp directly (`/health`)
3. If both fail, show offline message

---

## Testing the Model Response

### Test 1: Basic Health Question
```
User: What are common symptoms of a cold?
```

Expected: A calm, informative response about cold symptoms with a disclaimer.

### Test 2: Emergency Detection
```
User: I'm having chest pain and shortness of breath
```

Expected: **EMERGENCY ALERT** message telling user to seek immediate medical attention.

### Test 3: Medical Safety
```
User: What medication should I take for my headache?
```

Expected: The AI should NOT prescribe specific medications. It should suggest consulting a healthcare provider.

---

## Troubleshooting

### Problem: "Unable to Connect to AI Service"

**Solution 1**: Ensure llama.cpp server is running
```bash
# Check if port 8080 is in use
netstat -an | findstr "8080"   # Windows
lsof -i :8080                   # Linux/macOS
```

**Solution 2**: Check CORS settings
The llama.cpp server has CORS enabled by default. If issues persist, start with:
```bash
./llama-server -m model.gguf --host 0.0.0.0 --port 8080
```

**Solution 3**: Verify URL in .env
```env
VITE_LLAMA_DIRECT_URL=http://localhost:8080  # No trailing slash!
```

### Problem: Model responses are slow

**Solution 1**: Use GPU acceleration (if available)
```bash
# NVIDIA GPU
./llama-server -m model.gguf -ngl 35 --host 0.0.0.0 --port 8080
```

**Solution 2**: Use a smaller quantization
- Download `Q4_0` instead of `Q4_K_M` (faster, slightly lower quality)

### Problem: Model gives generic/unhelpful responses

**Solution**: The model choice matters. LLaMA 2 Chat or LLaMA 3 Instruct models are trained for conversations. Base models won't work well.

---

## Switching to Production Mode

When ready to use the full backend with database:

1. Edit `mds-frontend/.env`:
```env
VITE_AI_TEST_MODE=false
VITE_API_URL=http://localhost:3001
```

2. Start the full backend:
```bash
cd Backend
npm run dev
```

3. Ensure PostgreSQL and Redis are running

4. The frontend will now use the backend API with full conversation persistence.

---

## Model Customization

The medical system prompt is embedded in the frontend for test mode. To customize:

Edit `mds-frontend/src/modules/e-consultation/e-consultation.jsx`:

```javascript
// Find MEDICAL_SYSTEM_PROMPT constant
const MEDICAL_SYSTEM_PROMPT = `Your custom prompt here...`;
```

Key prompt sections:
- **Rules**: What the AI must NOT do
- **Behavior**: How the AI should respond
- **Response Structure**: Format of responses
- **Emergency**: How to handle emergencies

---

## Recommended Hardware

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 8GB | 16GB+ |
| VRAM (GPU) | - | 6GB+ |
| Storage | 10GB | 20GB |
| CPU | 4 cores | 8+ cores |

**Note**: Running on CPU only is possible but slower (~5-30 seconds per response). GPU acceleration significantly improves speed (~1-5 seconds).

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `./llama-server -m model.gguf -c 1024 --port 8080` | Start server |
| `curl http://localhost:8080/health` | Check server health |
| `VITE_AI_TEST_MODE=true npm run dev` | Start frontend in test mode |

---

## Next Steps

1. ✅ Verify model responds in test mode
2. ✅ Test emergency detection works
3. ✅ Test medical safety guardrails
4. 🔲 Set up PostgreSQL and Redis
5. 🔲 Start full backend server
6. 🔲 Switch to production mode
7. 🔲 Test full conversation persistence
