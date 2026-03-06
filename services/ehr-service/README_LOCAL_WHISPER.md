# 🏠 Local Whisper Setup - Complete Guide

## 📚 Documentation Files

- **`LOCAL_SETUP_QUICK_START.md`** - Quick start guide (start here!)
- **`LOCAL_WHISPER_SETUP.md`** - Detailed setup guide with all options
- **`docker-compose.whisper.yml`** - Docker Compose configuration
- **`whisper-server.py`** - Python FastAPI server script
- **`requirements-whisper.txt`** - Python dependencies

## 🎯 Quick Decision Guide

**Choose Docker if:**
- ✅ You want the easiest setup
- ✅ You have Docker installed
- ✅ You want automatic updates
- ✅ You don't need to customize much

**Choose Python if:**
- ✅ You want full control
- ✅ You need to customize the API
- ✅ You prefer Python development
- ✅ You want to modify transcription logic

## 🚀 Fastest Setup (Docker)

```bash
# 1. Start Whisper API
cd services/ehr-service
docker-compose -f docker-compose.whisper.yml up -d

# 2. Verify it's running
curl http://localhost:8000/health

# 3. Update backend .env
echo "USE_LOCAL_WHISPER=true" >> .env
echo "LOCAL_WHISPER_URL=http://localhost:8000/transcribe" >> .env

# 4. Restart backend
npm run dev
```

**Done!** Your backend will now use local Whisper instead of OpenAI API.

## ✅ whisper.cpp Integration (127.0.0.1:8080)

If you run `whisper.cpp` server locally, set:

```bash
USE_LOCAL_WHISPER=true
LOCAL_WHISPER_URL=http://127.0.0.1:8080
```

Notes:
- The backend now auto-resolves base whisper.cpp URLs to `/inference`.
- `http://127.0.0.1:8080` and `http://127.0.0.1:8080/inference` both work.
- If local Whisper fails and an OpenAI key is configured, backend falls back to OpenAI Whisper automatically.

## 🔄 Switching Between Local and OpenAI

**Use Local Whisper:**
```bash
USE_LOCAL_WHISPER=true
LOCAL_WHISPER_URL=http://localhost:8000/transcribe
```

**Use OpenAI API:**
```bash
USE_LOCAL_WHISPER=false
OPENAI_API_KEY=your-api-key-here
```

## 📊 Comparison

| Feature | Local Whisper | OpenAI API |
|---------|--------------|------------|
| Cost | Free | $0.006/min |
| Privacy | 100% Private | Data sent to OpenAI |
| Speed | Depends on hardware | Fast (cloud) |
| Setup | Requires server | Just API key |
| Offline | Yes | No |
| Maintenance | You manage | OpenAI manages |

## 🎓 Learning Resources

- Whisper GitHub: https://github.com/openai/whisper
- FastAPI Docs: https://fastapi.tiangolo.com/
- Docker Docs: https://docs.docker.com/

## 💡 Tips

1. **Start with Docker** - Easiest way to get started
2. **Use 'base' model** - Good balance of speed/quality
3. **GPU recommended** - Much faster than CPU
4. **Monitor resources** - Watch CPU/GPU/RAM usage
5. **Test thoroughly** - Verify accuracy with your audio

## 🆘 Need Help?

Check the detailed guides:
- `LOCAL_WHISPER_SETUP.md` - Full documentation
- `LOCAL_SETUP_QUICK_START.md` - Quick reference
