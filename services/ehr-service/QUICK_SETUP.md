# 🚀 Quick Setup: Whisper API Key

## Your API Key is Ready!

Your OpenAI API key has been provided. Here's how to set it up:

## ✅ Step-by-Step Setup

### 1. Create `.env` file in `services/ehr-service/` directory

**On Mac/Linux:**
```bash
cd services/ehr-service
cat > .env << 'EOF'
OPENAI_API_KEY=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
PORT=3013
EOF
```

**Or manually create the file:**
- Create a new file: `services/ehr-service/.env`
- Add this line:
```
OPENAI_API_KEY=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
```

### 2. Ensure `.env` is NOT committed to Git

Check if `.gitignore` exists and includes `.env`:
```bash
cd services/ehr-service
echo ".env" >> .gitignore
```

### 3. Restart Backend

```bash
cd services/ehr-service
npm run dev
```

## ✅ That's It!

The backend will automatically:
- ✅ Load the API key from `.env`
- ✅ Use it for Whisper transcription
- ✅ Support English, Shona, and Ndebele

## 🧪 Test It

1. Open EHR web frontend
2. Open an appointment
3. Click "Voice Record" button
4. Complete consent flow
5. Record a test audio
6. Verify transcription works!

## 💰 Cost

- **$0.006 per minute** of audio
- Very affordable for medical consultations!

## 🔒 Security

- ✅ `.env` file is local only
- ✅ Never commit to Git
- ✅ API key stays private

## 📝 Note

The backend already has `@nestjs/config` configured, so it will automatically load environment variables from `.env` file. No code changes needed!
