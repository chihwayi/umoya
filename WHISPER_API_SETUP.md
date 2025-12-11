# Whisper API Setup Guide

## ⚠️ SECURITY WARNING
**NEVER commit your API key to Git!** Always use environment variables or `.env` files that are in `.gitignore`.

## 🔑 Setting Up Your OpenAI API Key

### Option 1: Using .env File (Recommended)

1. **Create/Edit `.env` file** in `services/ehr-service/`:
   ```bash
   cd services/ehr-service
   touch .env
   ```

2. **Add your API key**:
   ```bash
   OPENAI_API_KEY=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
   ```

3. **Ensure `.env` is in `.gitignore`**:
   ```bash
   echo ".env" >> .gitignore
   ```

### Option 2: Using Environment Variable

**Linux/Mac:**
```bash
export OPENAI_API_KEY="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"
```

**Windows (PowerShell):**
```powershell
$env:OPENAI_API_KEY="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"
```

**Windows (CMD):**
```cmd
set OPENAI_API_KEY=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
```

## 📋 Pricing Information

**OpenAI Whisper API Pricing:**
- **$0.006 per minute** of audio transcribed
- Very affordable for medical consultations (typically 5-15 minutes)
- Example: 100 consultations × 10 minutes = 1000 minutes = **$6.00**

## 🔒 Security Best Practices

1. ✅ **Use `.env` file** (not committed to Git)
2. ✅ **Never share API keys** in chat, email, or public forums
3. ✅ **Rotate keys** if accidentally exposed
4. ✅ **Use environment variables** in production
5. ✅ **Monitor usage** in OpenAI dashboard

## 🧪 Testing the Setup

After setting the API key, restart your backend:

```bash
cd services/ehr-service
npm run dev
```

Then test the transcription endpoint:
```bash
curl -X POST http://localhost:3013/api/transcription/whisper \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Tenant-ID: your-tenant-slug" \
  -F "audio=@test-audio.wav" \
  -F "language=auto"
```

## 🆓 Free Alternatives (If Needed)

If you want completely free options:

1. **Self-hosted Whisper** (requires GPU server)
2. **WhisperAPI.com** - 5 free credits
3. **Voicegain** - 15,000 free minutes
4. **SpeakEasy** - 100 free transcriptions/month

## 📝 Next Steps

1. Set up the `.env` file with your API key
2. Restart the backend service
3. Test voice recording in the EHR
4. Monitor usage in OpenAI dashboard: https://platform.openai.com/usage

## 🔗 Useful Links

- OpenAI API Dashboard: https://platform.openai.com/api-keys
- Whisper API Docs: https://platform.openai.com/docs/guides/speech-to-text
- Pricing: https://openai.com/pricing
