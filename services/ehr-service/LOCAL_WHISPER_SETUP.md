# 🏠 Local/Self-Hosted Whisper Setup Guide

## Overview

This guide shows you how to run Whisper locally on your own server, completely **FREE** (no API costs). This is perfect for:
- ✅ Privacy-sensitive medical data
- ✅ Cost savings (no per-minute charges)
- ✅ Offline capability
- ✅ Full control over your data

## 📋 Prerequisites

- **GPU Recommended**: NVIDIA GPU with CUDA support (for fast transcription)
- **CPU Option**: Can run on CPU but will be slower
- **Docker** (recommended) or Python 3.8+
- **At least 4GB RAM** (8GB+ recommended)
- **10GB+ free disk space** (for models)

## 🚀 Option 1: Using Docker (Easiest)

### Step 1: Install Docker

**Mac:**
```bash
# Download Docker Desktop from: https://www.docker.com/products/docker-desktop
# Or install via Homebrew:
brew install --cask docker
```

**Linux:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

**Windows:**
Download Docker Desktop from: https://www.docker.com/products/docker-desktop

### Step 2: Run Whisper API Server

**Using onerahmet/whisper-api (Recommended):**

```bash
# Pull and run the Docker container
docker run -d \
  --name whisper-api \
  -p 8000:8000 \
  --gpus all \
  onerahmet/whisper-api:latest-gpu

# For CPU-only (no GPU):
docker run -d \
  --name whisper-api \
  -p 8000:8000 \
  onerahmet/whisper-api:latest-cpu
```

**Using ahmetoner/whisper-asr-webservice:**

```bash
docker run -d \
  --name whisper-asr \
  -p 8000:8000 \
  -e ASR_MODEL=base \
  ahmetoner/whisper-asr-webservice:latest-gpu
```

### Step 3: Verify It's Running

```bash
# Check if container is running
docker ps

# Test the API
curl http://localhost:8000/health

# Or test transcription
curl -X POST http://localhost:8000/asr \
  -F "audio_file=@test.wav" \
  -F "task=transcribe" \
  -F "language=en"
```

### Step 4: Configure Backend

Update your `.env` file in `services/ehr-service/`:

```bash
USE_LOCAL_WHISPER=true
LOCAL_WHISPER_URL=http://localhost:8000/asr
# Or if using different endpoint:
# LOCAL_WHISPER_URL=http://localhost:8000/transcribe
```

## 🐍 Option 2: Python Setup (More Control)

### Step 1: Install Dependencies

```bash
# Create virtual environment
python3 -m venv whisper-env
source whisper-env/bin/activate  # On Windows: whisper-env\Scripts\activate

# Install Whisper
pip install openai-whisper

# Install FastAPI and dependencies
pip install fastapi uvicorn python-multipart
```

### Step 2: Create Whisper API Server

Create `whisper-server.py`:

```python
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
import whisper
import tempfile
import os

app = FastAPI()

# Load Whisper model (choose: tiny, base, small, medium, large)
model = whisper.load_model("base")  # Start with 'base', upgrade to 'large' if needed

@app.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form("auto"),
    temperature: float = Form(0.0),
    prompt: str = Form("")
):
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            content = await audio.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        # Transcribe
        result = model.transcribe(
            tmp_path,
            language=None if language == "auto" else language,
            temperature=temperature,
            initial_prompt=prompt if prompt else None
        )
        
        # Clean up
        os.unlink(tmp_path)
        
        return {
            "text": result["text"],
            "language": result["language"],
            "segments": result.get("segments", [])
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Step 3: Run the Server

```bash
python whisper-server.py
```

### Step 4: Configure Backend

Update `.env`:
```bash
USE_LOCAL_WHISPER=true
LOCAL_WHISPER_URL=http://localhost:8000/transcribe
```

## 🔧 Option 3: Using Speaches (Open Source Whisper API Server)

### Step 1: Clone Repository

```bash
git clone https://github.com/ahmetoner/whisper-asr-webservice.git
cd whisper-asr-webservice
```

### Step 2: Build Docker Image

```bash
docker build -t whisper-asr .
```

### Step 3: Run Container

```bash
docker run -d \
  --name whisper-asr \
  -p 8000:8000 \
  -e ASR_MODEL=base \
  whisper-asr
```

### Step 4: Configure Backend

```bash
USE_LOCAL_WHISPER=true
LOCAL_WHISPER_URL=http://localhost:8000/asr
```

## 📊 Model Comparison

| Model | Size | Speed | Quality | RAM Required |
|-------|------|-------|---------|--------------|
| tiny  | 39MB | Fastest | Good | ~1GB |
| base  | 74MB | Fast | Better | ~1GB |
| small | 244MB | Medium | Good | ~2GB |
| medium| 769MB | Slow | Very Good | ~5GB |
| large | 1550MB | Slowest | Best | ~10GB |

**Recommendation**: Start with `base` or `small` for good balance.

## 🔄 Update Backend Code (If Needed)

The backend already supports local Whisper! Just ensure your transcription service handles the response format correctly.

Check `services/ehr-service/src/services/transcription.service.ts` - it should already handle both OpenAI and local Whisper.

## 🧪 Testing Local Setup

### Test 1: Health Check
```bash
curl http://localhost:8000/health
```

### Test 2: Transcription
```bash
curl -X POST http://localhost:8000/transcribe \
  -F "audio=@test-audio.wav" \
  -F "language=en"
```

### Test 3: From Backend
```bash
curl -X POST http://localhost:3013/api/transcription/whisper \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant" \
  -F "audio=@test.wav" \
  -F "language=auto"
```

## 🐳 Docker Compose Setup (Recommended for Production)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  whisper-api:
    image: onerahmet/whisper-api:latest-gpu
    container_name: whisper-api
    ports:
      - "8000:8000"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - ASR_MODEL=base
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

## 🔒 Security Considerations

1. **Firewall**: Only expose port 8000 to your backend server
2. **Network**: Run Whisper API on internal network
3. **Authentication**: Add API key authentication if exposing publicly
4. **Rate Limiting**: Implement rate limiting for production

## 📈 Performance Tips

1. **Use GPU**: 10-50x faster than CPU
2. **Model Size**: Balance between speed and quality
3. **Batch Processing**: Process multiple files together
4. **Caching**: Cache common transcriptions

## 🆘 Troubleshooting

### Issue: "CUDA out of memory"
**Solution**: Use smaller model or reduce batch size

### Issue: "Port 8000 already in use"
**Solution**: Change port or stop existing service
```bash
docker stop whisper-api
# Or use different port: -p 8001:8000
```

### Issue: "Model download failed"
**Solution**: Download manually or check internet connection

### Issue: "Slow transcription"
**Solution**: 
- Use GPU instead of CPU
- Use smaller model (tiny/base)
- Reduce audio length

## 📝 Environment Variables

Add to `services/ehr-service/.env`:

```bash
# Use local Whisper instead of OpenAI
USE_LOCAL_WHISPER=true

# Local Whisper API URL
LOCAL_WHISPER_URL=http://localhost:8000/transcribe

# Or if using different endpoint:
# LOCAL_WHISPER_URL=http://localhost:8000/asr
```

## ✅ Verification Checklist

- [ ] Docker installed (or Python 3.8+)
- [ ] Whisper API server running
- [ ] Health check returns OK
- [ ] Backend `.env` configured
- [ ] Backend restarted
- [ ] Test transcription works

## 🎯 Next Steps

1. Choose your setup method (Docker recommended)
2. Start Whisper API server
3. Update backend `.env` file
4. Restart backend
5. Test voice recording in EHR

## 📚 Useful Resources

- Whisper GitHub: https://github.com/openai/whisper
- Docker Hub: https://hub.docker.com/r/onerahmet/whisper-api
- FastAPI Docs: https://fastapi.tiangolo.com/

## 💡 Pro Tips

1. **Start Small**: Begin with `tiny` or `base` model
2. **Monitor Resources**: Watch CPU/GPU/RAM usage
3. **Scale Up**: Upgrade to `large` model if quality is critical
4. **Backup Models**: Download models once, reuse them
5. **Production**: Use Docker Compose for easy management
