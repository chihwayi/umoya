# 🔑 Whisper API Key Setup Instructions

## ⚠️ IMPORTANT SECURITY WARNING
**Your API key has been provided. Please follow these steps to set it up securely:**

## Step 1: Create .env File

Create a file named `.env` in the `services/ehr-service/` directory with this content:

```bash
OPENAI_API_KEY=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
PORT=3013
JWT_SECRET=your-jwt-secret-here
```

## Step 2: Ensure .env is in .gitignore

Make sure `.env` is listed in `.gitignore` to prevent committing your API key:

```bash
# In services/ehr-service/.gitignore, add:
.env
.env.local
.env.*.local
```

## Step 3: Install dotenv (if not already installed)

The backend should load environment variables. Check if `dotenv` or `@nestjs/config` is installed.

## Step 4: Restart Backend

After creating the `.env` file, restart your backend:

```bash
cd services/ehr-service
npm run dev
```

## Step 5: Verify It Works

The transcription service will automatically use `process.env.OPENAI_API_KEY` when available.

## 📋 Quick Setup Commands

```bash
# Navigate to backend directory
cd services/ehr-service

# Create .env file (copy the content above)
nano .env
# or
vim .env
# or on Mac/Windows, create it manually

# Verify .gitignore includes .env
echo ".env" >> .gitignore

# Restart backend
npm run dev
```

## 🔒 Security Checklist

- ✅ `.env` file created
- ✅ `.env` added to `.gitignore`
- ✅ Never commit `.env` to Git
- ✅ API key kept private
- ✅ Backend restarted

## 💰 Pricing Reminder

- **$0.006 per minute** of audio
- Example: 10-minute consultation = $0.06
- Very affordable for medical use!

## 🧪 Test the API

Once set up, test with:
```bash
curl -X POST http://localhost:3013/api/transcription/whisper \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: your-tenant" \
  -F "audio=@test.wav" \
  -F "language=auto"
```
