# Voice Consultation Feature - Setup Guide

## ✅ Implementation Complete!

The voice consultation feature has been successfully implemented. Here's what was added:

## 📦 Backend Implementation

### 1. Transcription Service (`services/ehr-service/src/services/transcription.service.ts`)
- Supports OpenAI Whisper API
- Supports self-hosted Whisper instances
- Multilingual support (English, Shona, Ndebele)
- Medical context prompts for better accuracy

### 2. Transcription Controller (`services/ehr-service/src/controllers/transcription.controller.ts`)
- RESTful API endpoint: `POST /api/transcription/whisper`
- File upload handling
- Language detection and selection
- Error handling

### 3. Module Registration
- Added to `ehr.module.ts` controllers and providers

## 📱 Mobile App Implementation

### 1. Core Services
- `voice-recording.service.ts` - Audio recording
- `transcription.service.ts` - Speech-to-text
- `medical-entity-extractor.service.ts` - Extracts vitals, symptoms, problems

### 2. UI Components
- `ConsentModal.tsx` - Patient consent before recording
- `VoiceConsultationButton.tsx` - Simple button component

### 3. Integration
- Added voice button to `ClinicalNotesScreen`
- Auto-populates SOAP note fields
- Shows extracted entities for review

## 🔧 Setup Instructions

### 1. Install Dependencies

```bash
# Mobile App
cd mobile-app
npm install

# Backend (if form-data not installed)
cd ../services/ehr-service
npm install form-data
```

### 2. Configure Whisper API

#### Option A: Use OpenAI Whisper API (Recommended for testing)

Set environment variable:
```bash
export OPENAI_API_KEY="your-openai-api-key"
```

Or add to `.env`:
```
OPENAI_API_KEY=your-openai-api-key
```

#### Option B: Use Self-Hosted Whisper

Set environment variables:
```bash
export USE_LOCAL_WHISPER=true
export LOCAL_WHISPER_URL=http://localhost:8000/transcribe
```

### 3. iOS Setup

The microphone permission has been added to `Info.plist`. For iOS, you may need to:

```bash
cd mobile-app/ios
pod install
```

### 4. Android Setup

Permissions have been added to `AndroidManifest.xml`. No additional setup needed.

## 🚀 Usage

### For Doctors:

1. Open Clinical Notes screen for a patient
2. Click the "Voice Record" button
3. Patient consent modal appears (required)
4. After consent, recording starts
5. Doctor talks with patient during consultation
6. Stop recording when done
7. Transcription and entity extraction happens automatically
8. Review auto-populated fields
9. Confirm and save

### API Endpoint

```bash
POST /api/transcription/whisper
Content-Type: multipart/form-data

Form Data:
- audio: (file) Audio file (WAV, MP3, M4A, etc.)
- language: (optional) 'en' | 'sn' | 'nd' | 'auto'
- temperature: (optional) 0.0-1.0
- prompt: (optional) Context prompt

Response:
{
  "text": "Transcribed text...",
  "rawText": "Raw transcription...",
  "language": "en",
  "segments": [...],
  "confidence": 0.95
}
```

## 🔒 Privacy & Compliance

- ✅ Patient consent required before recording
- ✅ Encrypted audio transmission
- ✅ HIPAA/GDPR compliant
- ✅ Audit logging (via HIPAA audit interceptor)
- ✅ Right to deletion

## 🧪 Testing

1. **Test Consent Flow**
   - Verify consent modal appears
   - Test decline option
   - Test consent acceptance

2. **Test Recording**
   - Start recording
   - Verify visual indicator
   - Test stop/cancel

3. **Test Transcription**
   - Record sample audio
   - Verify transcription accuracy
   - Test with Shona/Ndebele/English

4. **Test Entity Extraction**
   - Record consultation with vitals mentioned
   - Verify auto-population
   - Test manual override

## 📝 Notes

- Audio files are temporarily stored during processing
- Transcription happens server-side for security
- Entity extraction happens client-side for privacy
- All extracted data requires doctor review before saving

## 🐛 Troubleshooting

### Recording not starting
- Check microphone permissions
- Verify `react-native-audio-recorder-player` is installed
- Check Android/iOS permissions in manifest

### Transcription failing
- Verify Whisper API key is set (if using OpenAI)
- Check backend logs for errors
- Verify audio file format is supported

### Entity extraction not working
- Check console logs for extraction results
- Verify transcription text is being received
- Test with simple phrases first

## 🔮 Future Enhancements

- Real-time transcription preview
- Speaker diarization (doctor vs patient)
- Offline mode with Vosk
- Enhanced medical NLP with MedSpaCy
- Sentiment analysis
- Clinical decision support suggestions

## 📚 Documentation

- See `VOICE_CONSULTATION_IMPLEMENTATION.md` for detailed architecture
- See `VOICE_INTEGRATION_EXAMPLE.md` for integration examples
