# Local Model Testing Guide

> **Purpose**: Test the AI medical chatbot directly with llama.cpp, bypassing the backend and database to verify the model responds correctly on the frontend.

---

## Quick Start (TL;DR) - Raspberry Pi Linux

### For Raspberry Pi 5 (8GB) with Ice Tower Cooler

```bash
# 1. Install dependencies
sudo apt-get update
sudo apt-get install -y build-essential cmake git wget

# 2. Download llama.cpp
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# 3. Build for ARM (Raspberry Pi)
make -j4

# 4. Download the BEST model for medical chatbot (~4.9GB)
# LLaMA 3 8B Instruct - Best safety, instruction-following, medical reasoning
mkdir -p models
wget -O models/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf \
  https://huggingface.co/QuantFactory/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf

# 5. Start the server (optimized for Pi 5 8GB + Ice Tower)
./llama-server -m models/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf \
  -c 2048 -n 512 -t 4 --host 0.0.0.0 --port 8080

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

### Step 1: Download and Build llama.cpp on Raspberry Pi

#### Raspberry Pi 4/5 (4GB or 8GB RAM)

**Install Build Dependencies:**
```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install required tools
sudo apt-get install -y build-essential cmake git wget curl

# Optional: Install htop to monitor resources
sudo apt-get install -y htop
```

**Clone and Build llama.cpp:**
```bash
# Clone repository
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp

# Build using make (recommended for ARM)
make -j4

# This will create the 'llama-server' executable in the current directory
# Build time: ~5-10 minutes on Raspberry Pi 4/5
```

**Alternative: CMake Build (if make fails):**
```bash
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j4

# Server will be at: build/bin/llama-server
```

#### Enable Swap (Recommended for 4GB Pi)

If you have 4GB RAM, increase swap space:
```bash
# Check current swap
free -h

# Increase swap to 4GB
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Change CONF_SWAPSIZE=100 to CONF_SWAPSIZE=4096
sudo dphys-swapfile setup
sudo dphys-swapfile swapon

# Verify
free -h
```

### Step 2: Download the Model (Optimized for Raspberry Pi)

**🥇 BEST Model for Medical Chatbot on Pi 5 8GB**: LLaMA 3 8B Instruct (Q4_K_M)
- File size: ~4.9GB
- RAM usage: ~5.5GB (perfect for 8GB Pi)
- Response time: ~1.5-3 tokens/sec (~5-15 seconds per response)
- Quality: ⭐⭐⭐⭐⭐ (Highest possible for local deployment)

**Why LLaMA 3 8B is THE BEST for Medical Chatbot:**

✅ **Safety First**
- Conservative, cautious responses (critical for medical)
- Strong refusal when unsure (doesn't hallucinate diagnoses)
- Lower hallucination risk than alternatives

✅ **Medical-Appropriate Behavior**
- Excellent instruction-following
- Structured, professional replies
- Natural disclaimer integration
- Appropriate tone for health queries

✅ **Perfect for Your Setup**
- Fits comfortably in Pi 5 8GB RAM
- Stable performance for web API use
- Optimized by Meta for instruction tasks
- Best quality-to-size ratio for medical use

✅ **Better Than Alternatives**
- More conservative than Mistral 7B
- Better reasoning than Phi-3-mini
- Lower risk than larger low-quant models
- Specifically designed for chat/instruct tasks

#### Download Options:

**Option A: Using wget (Recommended for Pi 5 8GB + Ice Tower)**
```bash
# Create models directory
mkdir -p ~/llama.cpp/models
cd ~/llama.cpp/models

# Download LLaMA 3 8B Instruct Q4_K_M (~4.9GB)
wget https://huggingface.co/QuantFactory/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf

# Download time: ~15-45 minutes depending on your internet speed
```

**Option B: Using curl**
```bash
curl -L -o ~/llama.cpp/models/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf \
  https://huggingface.co/QuantFactory/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf
```

**Model Comparison for Medical Chatbot:**

| Model | Size | RAM Usage | Response Time | Medical Safety | Quality | Best For |
|-------|------|-----------|---------------|----------------|---------|----------|
| **🥇 LLaMA 3 8B Instruct Q4_K_M** | 4.9GB | ~5.5GB | ~5-15s | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **Pi 5 8GB Medical** |
| 🥈 Mistral 7B Instruct Q5_K_M | 5.1GB | ~6GB | ~6-12s | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Speed priority |
| 🥉 Phi-3-mini Q4_K_M | 2.3GB | ~3GB | ~3-8s | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Fast responses |
| Llama 3.2 3B Instruct Q4_K_M | 2.0GB | ~2.5GB | ~2-6s | ⭐⭐⭐ | ⭐⭐⭐ | Budget Pi 4 |
| TinyLlama 1.1B Q4_K_M | 0.7GB | ~1.2GB | ~1-3s | ⭐⭐ | ⭐⭐ | Testing only |

**⚠️ NOT Recommended for Medical Use:**
- 10B-13B models with Q2/Q3 quantization (high hallucination risk)
- Uncensored or experimental models (unsafe for medical)
- Coding-focused models (not trained for medical scenarios)

**Download Alternative Models:**
```bash
# 🥈 Mistral 7B Q5_K_M (faster, still excellent)
wget https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q5_K_M.gguf

# 🥉 Phi-3-mini (ultra-fast fallback)
wget https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf

# Llama 3.2 3B (for Pi 4)
wget https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf
```

### Step 3: Start the llama.cpp Server on Raspberry Pi

#### Raspberry Pi 5 (8GB) + Ice Tower - BEST Configuration

```bash
# Navigate to llama.cpp folder
cd ~/llama.cpp

# Start server with Mistral 7B (RECOMMENDED for your setup)
./llama-server \
  -m models/mistral-7b-instruct-v0.2.Q4_K_M.gguf \
  -c 2048 \
  -n 512 \
  -t 4 \
  --host 0.0.0.0 \
  --port 8080 \
  --ctx-size 2048 \
  --n-predict 512

# The server will start and show:
# "HTTP server listening at http://0.0.0.0:8080"
# Expected: ~5-10 second response times with excellent quality
```

#### Server Options Explained (Raspberry Pi Optimized)
| Flag | Value | Description |
|------|-------|-------------|
| `-m` | `models/Phi-3-mini-4k-instruct-q4.gguf` | Path to model file |
| `-c 1024` | Context window size (tokens to remember) |
| `-n 256` | Max tokens to generate per response |
| `-t 4` | Number of CPU threads (4 for Pi 4/5) |
| `--host 0.0.0.0` | Listen on all network interfaces |
| `--port 8080` | Port number for the server |
| `--ctx-size 1024` | Context size (same as `-c`) |
| `--n-predict 256` | Prediction limit (prevents timeout) |

#### Performance Tuning for Different Pi Models

**🥇 Raspberry Pi 5 (8GB) + Ice Tower - Medical Chatbot (RECOMMENDED):**
```bash
./llama-server -m models/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf \
  -c 2048 -n 512 -t 4 --host 0.0.0.0 --port 8080
# Safety: ⭐⭐⭐⭐⭐ | Quality: ⭐⭐⭐⭐⭐ | Speed: ~5-15s
```

**🥈 Raspberry Pi 5 (8GB) - Speed Priority:**
```bash
./llama-server -m models/mistral-7b-instruct-v0.2.Q5_K_M.gguf \
  -c 2048 -n 512 -t 4 --host 0.0.0.0 --port 8080
# Safety: ⭐⭐⭐⭐ | Quality: ⭐⭐⭐⭐⭐ | Speed: ~6-12s
```

**🥉 Raspberry Pi 5 (8GB) - Ultra-Fast:**
```bash
./llama-server -m models/Phi-3-mini-4k-instruct-q4.gguf \
  -c 2048 -n 512 -t 4 --host 0.0.0.0 --port 8080
# Safety: ⭐⭐⭐⭐ | Quality: ⭐⭐⭐⭐ | Speed: ~3-8s
```

**Raspberry Pi 4 (4GB) - Balanced:**
```bash
./llama-server -m models/Phi-3-mini-4k-instruct-q4.gguf \
  -c 1024 -n 256 -t 4 --host 0.0.0.0 --port 8080
# Safety: ⭐⭐⭐⭐ | Quality: ⭐⭐⭐⭐ | Speed: ~8-15s
```

**Raspberry Pi 4 (2GB) - Testing Only:**
```bash
./llama-server -m models/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf \
  -c 512 -n 128 -t 4 --host 0.0.0.0 --port 8080
# Safety: ⭐⭐ | Quality: ⭐⭐ | Speed: ~3-7s
```

#### Running as Background Service

To run the server in the background:
```bash
# Using nohup
nohup ./llama-server -m models/Phi-3-mini-4k-instruct-q4.gguf \
  -c 1024 -n 256 -t 4 --host 0.0.0.0 --port 8080 > llama.log 2>&1 &

# Check if running
ps aux | grep llama-server

# View logs
tail -f llama.log

# Stop server
pkill llama-server
```

#### Auto-start on Boot (Optional)

Create systemd service:
```bash
sudo nano /etc/systemd/system/llama-server.service
```

Add this content:
```ini
[Unit]
Description=LLaMA Server for Medical Chatbot
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/llama.cpp
ExecStart=/home/pi/llama.cpp/llama-server -m /home/pi/llama.cpp/models/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf -c 2048 -n 512 -t 4 --host 0.0.0.0 --port 8080
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable llama-server
sudo systemctl start llama-server
sudo systemctl status llama-server
```

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

### Problem: Model responses are slow (Raspberry Pi)

**Solution 1**: Ensure CPU governor is set to performance
```bash
# Check current governor
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor

# Set to performance mode
sudo sh -c "echo performance > /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor"
sudo sh -c "echo performance > /sys/devices/system/cpu/cpu1/cpufreq/scaling_governor"
sudo sh -c "echo performance > /sys/devices/system/cpu/cpu2/cpufreq/scaling_governor"
sudo sh -c "echo performance > /sys/devices/system/cpu/cpu3/cpufreq/scaling_governor"

# Make permanent (add to /etc/rc.local)
```

**Solution 2**: Use a smaller model
```bash
# Switch to TinyLlama (much faster)
./llama-server -m models/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf \
  -c 512 -n 128 -t 4 --host 0.0.0.0 --port 8080
```

**Solution 3**: Reduce context and prediction limits
```bash
# Smaller context = faster responses
./llama-server -m models/Phi-3-mini-4k-instruct-q4.gguf \
  -c 512 -n 128 -t 4 --host 0.0.0.0 --port 8080
```

**Solution 4**: Monitor for thermal throttling
```bash
# Install monitoring tools
sudo apt-get install -y stress-ng

# Check CPU temperature
vcgencmd measure_temp

# Monitor in real-time
watch -n 1 vcgencmd measure_temp

# If temp > 80°C, add cooling!
```

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

## Recommended Hardware (Raspberry Pi)

| Raspberry Pi Model | RAM | Cooling | Model | Response Time | Medical Safety | Quality | Status |
|-------------------|-----|---------|-------|---------------|----------------|---------|--------|
| **Pi 5 (8GB)** | 8GB | **Ice Tower** | **🥇 LLaMA 3 8B Q4_K_M** | ~5-15 sec | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ **OPTIMAL** |
| **Pi 5 (8GB)** | 8GB | Fan/Heatsink | 🥈 Mistral 7B Q5_K_M | ~6-12 sec | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Excellent |
| **Pi 5 (8GB)** | 8GB | Active | 🥉 Phi-3-mini Q4_K_M | ~3-8 sec | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ Fast |
| **Pi 4 (8GB)** | 8GB | Active | Phi-3-mini Q4_K_M | ~5-12 sec | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ Good |
| **Pi 4 (4GB)** | 4GB + 4GB swap | Active | Phi-3-mini Q4_K_M | ~8-15 sec | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ Usable |
| **Pi 4 (2GB)** | 2GB + 2GB swap | Any | TinyLlama Q4_K_M | ~3-7 sec | ⭐⭐ | ⭐⭐ | ⚠️ Testing only |
| Pi 3 | 1GB | Any | - | - | - | - | ❌ Not recommended |

**Storage Requirements:**
- Minimum: 10GB free space (OS + model + llama.cpp)
- Recommended: 20GB+ for multiple models and logs

**Network:**
- Ethernet or WiFi connection for downloading models
- If accessing from other devices, use ethernet for better performance

**Cooling:**
- Active cooling (fan) highly recommended for sustained inference
- Pi 5 gets hot under AI workload - heatsink + fan essential

**Power Supply:**
- Pi 5: Official 5V/5A USB-C adapter
- Pi 4: Official 5V/3A USB-C adapter
- Avoid cheap adapters - they cause throttling

---

## Quick Reference (Raspberry Pi 5 8GB + Ice Tower)

| Command | Description |
|---------|-------------|
| `./llama-server -m models/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf -c 2048 -n 512 -t 4 --port 8080` | Start server (best model) |
| `curl http://localhost:8080/health` | Check server health |
| `htop` | Monitor CPU/RAM usage |
| `vcgencmd measure_temp` | Check Pi temperature (should stay <70°C) |
| `ps aux | grep llama` | Check if server is running |
| `pkill llama-server` | Stop server |
| `tail -f llama.log` | View server logs |
| `free -h` | Check memory usage (~5.5GB used) |
| `df -h` | Check disk space |
| `sudo systemctl status llama-server` | Check service status |

---

## 🎯 Final Recommendation

**For Raspberry Pi 5 8GB + Ice Tower + Medical Chatbot:**

✅ **Use LLaMA 3 8B Instruct Q4_K_M**

This is the **best balance** of:
- ⭐ Medical safety & conservative responses
- ⭐ Excellent instruction-following
- ⭐ Low hallucination risk
- ⭐ Stable web API performance
- ⭐ Perfect fit for 8GB RAM

```bash
# Complete setup in one command block:
cd ~/llama.cpp/models && \
wget https://huggingface.co/QuantFactory/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf && \
cd .. && \
./llama-server -m models/Meta-Llama-3-8B-Instruct.Q4_K_M.gguf -c 2048 -n 512 -t 4 --host 0.0.0.0 --port 8080
```
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
