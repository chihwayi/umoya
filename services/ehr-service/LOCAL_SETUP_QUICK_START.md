# 🚀 Quick Start: Local Whisper Setup

## Choose Your Method

### 🐳 Method 1: Docker (Easiest - Recommended)

**Step 1: Start Whisper API**
```bash
cd services/ehr-service
docker-compose -f docker-compose.whisper.yml up -d
```

**Step 2: Verify It's Running**
```bash
curl http://localhost:8000/health
# Should return: {"status":"ok","model":"base"}
```

**Step 3: Update Backend Config**
Add to `services/ehr-service/.env`:
```bash
USE_LOCAL_WHISPER=true
LOCAL_WHISPER_URL=http://localhost:8000/transcribe
```

**Step 4: Restart Backend**
```bash
npm run dev
```

**Done!** ✅

---

### 🐍 Method 2: Python (More Control)

**Step 1: Install Python Dependencies**
```bash
cd services/ehr-service
python3 -m venv whisper-env
source whisper-env/bin/activate  # Windows: whisper-env\Scripts\activate
pip install -r requirements-whisper.txt
```

**Step 2: Start Whisper Server**
```bash
python whisper-server.py
```

**Step 3: Update Backend Config**
Add to `services/ehr-service/.env`:
```bash
USE_LOCAL_WHISPER=true
LOCAL_WHISPER_URL=http://localhost:8000/transcribe
```

**Step 4: Restart Backend**
```bash
npm run dev
```

**Done!** ✅

---

## 🧪 Test It

```bash
# Test health endpoint
curl http://localhost:8000/health

# Test transcription (replace test.wav with your audio file)
curl -X POST http://localhost:8000/transcribe \
  -F "audio=@test.wav" \
  -F "language=en"
```

## 📝 Notes

- **First run**: Model will download automatically (~150MB for 'base' model)
- **GPU vs CPU**: GPU is 10-50x faster, but CPU works fine for testing
- **Model sizes**: Start with 'base', upgrade to 'large' if needed
- **Port**: Default is 8000, change if needed

## 🔧 Troubleshooting

**Port already in use?**
```bash
# Find what's using port 8000
lsof -i :8000
# Kill it or use different port
```

**Docker not starting?**
```bash
# Check logs
docker logs medicore-whisper-api
# Or try CPU version
docker-compose -f docker-compose.whisper.yml up -d
```

**Python errors?**
```bash
# Make sure Python 3.8+ is installed
python3 --version
# Install dependencies
pip install -r requirements-whisper.txt
```

## ✅ Verification

1. Whisper API running on port 8000
2. Health check returns OK
3. Backend `.env` configured
4. Backend restarted
5. Test voice recording in EHR

## 🎯 Next Steps

See `LOCAL_WHISPER_SETUP.md` for detailed documentation and advanced configuration.
