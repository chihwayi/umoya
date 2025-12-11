# Voice Consultation Feature - Implementation Plan

## 🎯 Overview
Intelligent voice-to-text consultation feature that listens to doctor-patient conversations, transcribes them, and automatically extracts clinical entities (vitals, symptoms, problems, medications) to populate EHR forms.

## 🏆 Recommended Solution Stack

### 1. Speech-to-Text (STT)
**Primary: OpenAI Whisper (Free & Open Source)**
- ✅ Excellent multilingual support (English, Shona, Ndebele)
- ✅ High accuracy for medical terminology
- ✅ Can run locally or via API
- ✅ Free and open source
- ✅ Supports real-time transcription

**Fallback: Vosk (Offline)**
- ✅ Works completely offline
- ✅ Lightweight models for mobile
- ✅ Good multilingual support
- ✅ Lower accuracy than Whisper but faster

### 2. Medical NLP (Entity Extraction)
**Primary: Custom Medical NER Pipeline**
- ✅ Regex patterns for vitals (BP, temperature, heart rate, etc.)
- ✅ Keyword matching for symptoms/problems
- ✅ Integration with existing SNOMED/ICD-10 terminology
- ✅ Context-aware extraction

**Future Enhancement: MedSpaCy**
- Advanced clinical NLP library
- Pre-trained medical entity recognition
- Can be integrated later for better accuracy

## 📋 Implementation Flow

```
1. Doctor starts consultation
   ↓
2. Patient Consent Modal (required)
   ↓
3. Start Recording (with visual indicator)
   ↓
4. Real-time transcription (optional) OR Post-recording processing
   ↓
5. Medical entity extraction (vitals, symptoms, problems)
   ↓
6. Auto-populate Clinical Notes / Vitals forms
   ↓
7. Doctor reviews and confirms
   ↓
8. Save to EHR
```

## 🏗️ Architecture

### Components:
1. **VoiceRecordingService** - Handles audio recording
2. **TranscriptionService** - Whisper/Vosk integration
3. **MedicalEntityExtractor** - Extracts vitals, symptoms, problems
4. **VoiceConsultationModal** - UI component for recording
5. **ConsentModal** - Patient consent before recording

### Integration Points:
- **ClinicalNotesScreen** - Add voice button to auto-populate SOAP notes
- **VisitManagementScreen** - Add voice button for quick vitals capture
- **DoctorDashboard** - Quick access to voice consultation

## 🔒 Privacy & Consent

**Patient Consent Requirements:**
- Explicit consent before recording starts
- Clear explanation of what's being recorded
- Option to decline (manual entry still available)
- Consent stored with recording metadata
- HIPAA/GDPR compliant storage

## 📱 User Experience

### Simple Integration:
- Small microphone button in existing forms
- Non-intrusive recording indicator
- Seamless auto-population
- Easy to disable/ignore if not needed

### Recording States:
- 🔴 Recording (with timer)
- ⏸️ Paused
- ⏹️ Stopped
- 🔄 Processing
- ✅ Completed (with extracted entities)

## 🚀 Implementation Steps

### Phase 1: Core Infrastructure
1. Install dependencies (Whisper, audio recording libraries)
2. Create VoiceRecordingService
3. Create TranscriptionService (Whisper integration)
4. Create ConsentModal component

### Phase 2: Entity Extraction
1. Create MedicalEntityExtractor service
2. Implement vitals extraction patterns
3. Implement symptom/problem extraction
4. Integration with SNOMED/ICD-10

### Phase 3: UI Integration
1. Add voice button to ClinicalNotesScreen
2. Add voice button to VisitManagementScreen
3. Create VoiceConsultationModal
4. Auto-population logic

### Phase 4: Testing & Refinement
1. Test with Shona/Ndebele/English
2. Accuracy testing
3. Performance optimization
4. User feedback integration

## 📦 Dependencies

```json
{
  "react-native-audio-recorder-player": "^3.x",
  "react-native-permissions": "^3.x",
  "@react-native-community/audio-toolkit": "^2.x",
  "openai-whisper": "latest", // or use API
  "vosk": "latest" // for offline fallback
}
```

## 🔧 Technical Considerations

### Audio Format:
- Format: WAV or MP3
- Sample Rate: 16kHz (Whisper standard)
- Channels: Mono
- Bit Depth: 16-bit

### Processing:
- Real-time: Stream to Whisper API (if using cloud)
- Batch: Record → Process → Extract (better for accuracy)
- Hybrid: Real-time preview + batch processing

### Storage:
- Temporary storage during consultation
- Delete after extraction (unless consent for storage)
- Encrypted storage if retained

## 🌍 Language Support

### Priority Languages:
1. **English** - Primary (best accuracy)
2. **Shona** - Secondary (good Whisper support)
3. **Ndebele** - Secondary (good Whisper support)

### Language Detection:
- Auto-detect language from audio
- Manual selection option
- Mixed language support (code-switching)

## 📊 Entity Extraction Patterns

### Vitals:
- BP: "120 over 80", "BP is 120/80", "blood pressure 140/90"
- Temperature: "temperature is 37.5", "fever of 38 degrees"
- Heart Rate: "pulse is 72", "heart rate 85 bpm"
- Respiratory: "breathing 18 per minute", "respiratory rate 20"

### Symptoms:
- "patient complains of headache"
- "chief complaint is chest pain"
- "symptoms include fever and cough"

### Problems:
- "diagnosed with hypertension"
- "history of diabetes"
- "suffering from asthma"

## 🎨 UI Mockup Concept

```
┌─────────────────────────────────┐
│  Clinical Notes                  │
├─────────────────────────────────┤
│  [🎤 Voice Record] [Manual Entry]│
│                                  │
│  Chief Complaint:               │
│  [Auto-filled from voice...]     │
│                                  │
│  History of Present Illness:    │
│  [Auto-filled from voice...]    │
└─────────────────────────────────┘
```

## 🔐 Security & Compliance

- ✅ Encrypted audio transmission
- ✅ Secure storage (if retained)
- ✅ Audit logs for recordings
- ✅ Patient consent tracking
- ✅ HIPAA/GDPR compliance
- ✅ Right to deletion

## 📈 Future Enhancements

1. **Real-time transcription** - See text as speaking
2. **Speaker diarization** - Separate doctor vs patient speech
3. **Sentiment analysis** - Patient emotional state
4. **Clinical decision support** - Suggestions based on conversation
5. **Multi-language real-time** - Code-switching detection
6. **Offline mode** - Vosk for areas with poor connectivity

## 🐛 Error Handling

- Network failures → Offline mode (Vosk)
- Transcription errors → Manual correction option
- Extraction errors → Show raw transcript for manual review
- Permission denied → Graceful fallback to manual entry

## 📝 Notes

- Keep it simple and non-intrusive
- Always allow manual override
- Doctor has final control over extracted data
- Patient consent is mandatory
- Privacy-first approach
