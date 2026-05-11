# Sprint PP-S23 — Patient Portal: Whisper AI Voice Input

## Objective
Add voice-to-text input to three patient-facing screens:
1. **Symptom Checker** — dictate symptoms instead of typing
2. **Secure Messaging** — dictate a message before sending
3. **Vitals Submission** — dictate free-text notes attached to a vitals entry

A reusable `VoiceInputButton` component handles recording, uploads audio to the backend Whisper endpoint, and returns transcribed text to the parent. No new backend tables are required. A new patient-facing voice proxy endpoint is added to `patient-portal.controller.ts` to bridge patient JWT auth to the existing transcription service.

## Database Changes
None — no new tables. Run `POST /admin-maintenance/tenants/repair-all` is NOT required for this sprint.

## Backend Changes

### `services/ehr-service/src/controllers/patient-portal.controller.ts`
Add a new endpoint at the bottom of the file, before the closing `}` of the class:

```typescript
@Post('voice-transcribe')
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: 'Transcribe audio to text for patient portal voice input' })
@UseInterceptors(FileInterceptor('audio'))
async voiceTranscribe(
  @UploadedFile() file: Express.Multer.File,
  @Body('context') context: string,
  @Req() req: any,
): Promise<{ text: string; confidence?: number }> {
  if (!file) throw new BadRequestException('No audio file provided');
  const result = await this.transcriptionService.transcribe(file, {
    language: req.query?.language,
    prompt: context || 'Patient describing symptoms or health information.',
  }, { tenantId: req.tenantId });
  return {
    text: this.transcriptionService.formatTranscription(result.text),
    confidence: result.confidence,
  };
}
```

Also inject `TranscriptionService` into the controller constructor. Check if it is already injected; if not, add:
- Add `private readonly transcriptionService: TranscriptionService` to the constructor parameters
- Add `TranscriptionService` to the `providers: []` array in `ehr.module.ts` (only if not already there)
- Add `import { TranscriptionService } from '../services/transcription.service'` at the top

Add `FileInterceptor` and `UploadedFile` imports:
```typescript
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
```

### `patient-portal/src/services/api.ts`
Add voice transcription method:
```typescript
voiceTranscribe: async (
  audioBlob: Blob,
  token: string,
  tenantSlug: string,
  context?: string,
  language?: string,
): Promise<{ text: string; confidence?: number }> => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'voice-input.webm');
  if (context) formData.append('context', context);
  const url = `${API_BASE_URL}/patient-portal/voice-transcribe${language ? `?language=${language}` : ''}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: _withRid({ 'X-Tenant-ID': tenantSlug, Authorization: `Bearer ${token}` }),
    body: formData,
  });
  _ensureOk(response, 'Voice transcription failed');
  return response.json();
},
```

## Frontend Changes

### NEW: `patient-portal/src/components/VoiceInputButton.tsx`
A self-contained mic button component. Props:
```typescript
interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;  // callback with transcribed text
  context?: string;                       // hint passed to Whisper
  language?: string;                      // e.g. 'en', 'sw'
  disabled?: boolean;
  className?: string;
}
```

Internal state machine: `idle` → `requesting` → `recording` → `processing` → `idle` (or `error`)

**Visual states:**
- `idle`: `w-10 h-10 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center hover:bg-indigo-100 transition-colors cursor-pointer`  
  Icon: `Mic` (text-indigo-600, w-5 h-5)
- `recording`: `w-10 h-10 rounded-full bg-red-500 flex items-center justify-center animate-pulse cursor-pointer`  
  Icon: `MicOff` (text-white, w-5 h-5) — clicking stops recording
- `processing`: `w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center cursor-not-allowed`  
  Icon: Spinner svg (animate-spin, text-indigo-600)
- `error`: show brief red outline for 2 seconds then return to idle

**Recording logic using MediaRecorder API:**
```typescript
const startRecording = async () => {
  try {
    setState('requesting');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: 'audio/webm' });
      setState('processing');
      try {
        const result = await patientPortalApi.voiceTranscribe(blob, token!, tenantSlug, props.context, props.language);
        props.onTranscript(result.text);
        setState('idle');
      } catch {
        setState('error');
        setTimeout(() => setState('idle'), 2000);
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    setState('recording');
  } catch {
    setState('error');
    setTimeout(() => setState('idle'), 2000);
  }
};

const stopRecording = () => {
  recorderRef.current?.stop();
};
```

**Max recording duration**: auto-stop after 60 seconds using `setTimeout`. Show a countdown timer in the recording state: small `text-xs text-red-600` below the button showing `0:XX`.

**Browser support check**: If `navigator.mediaDevices` is undefined, render the button in a disabled/hidden state gracefully — do not crash.

**Tooltip on hover** (idle state): `title="Click to speak"` attribute on the button.

### MODIFY: `patient-portal/src/pages/SymptomCheckerPage.tsx`
Locate the symptom text input area (the textarea or input where patients type symptoms).
Add the `VoiceInputButton` directly to the right of or below the input. When `onTranscript` fires, **append** the transcribed text to the existing input value with a space:
```typescript
<VoiceInputButton
  onTranscript={(text) => setSymptomInput(prev => prev ? `${prev} ${text}` : text)}
  context="Patient describing their symptoms for clinical triage."
  className="ml-2 flex-shrink-0"
/>
```
Place the button inside the same flex row as the textarea if possible. If the textarea is full-width, put the mic button as an absolute overlay in the top-right corner of the textarea container.

### MODIFY: `patient-portal/src/pages/MessagesPage.tsx`
Locate the message compose area (the input or textarea for typing a new message).
Add `VoiceInputButton` to the right of the send button or as an icon inside the compose bar:
```typescript
<VoiceInputButton
  onTranscript={(text) => setMessageDraft(prev => prev ? `${prev} ${text}` : text)}
  context="Patient dictating a message to their healthcare provider."
  className="ml-2"
/>
```

### MODIFY: `patient-portal/src/pages/VitalsPage.tsx`
Locate the notes or free-text field on the vitals submission form. Add:
```typescript
<VoiceInputButton
  onTranscript={(text) => setVitalsNotes(prev => prev ? `${prev} ${text}` : text)}
  context="Patient describing health observations with their vitals."
  className="ml-2"
/>
```
If `VitalsPage` does not have a notes field, add one: `<textarea placeholder="Add a note (optional)..." className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" rows={3} value={vitalsNotes} onChange={e => setVitalsNotes(e.target.value)} />` and pass `vitalsNotes` in the submit payload.

## Acceptance Criteria
- [ ] `POST /patient-portal/voice-transcribe` endpoint exists and returns `{ text, confidence }`
- [ ] Endpoint requires patient JWT (`X-Tenant-ID` + `Authorization: Bearer`)
- [ ] `VoiceInputButton` renders in idle/recording/processing states with correct colors
- [ ] Clicking mic starts recording; clicking again (or 60s auto-stop) stops and uploads
- [ ] Transcribed text appended into SymptomChecker symptom field
- [ ] Transcribed text appended into MessagesPage compose textarea
- [ ] Transcribed text appended into VitalsPage notes field
- [ ] Browser without microphone support: button is hidden/disabled, no crash
- [ ] Mic button uses indigo/red color scheme matching platform palette
- [ ] No hardcoded tenant slugs in any new file
- [ ] `TranscriptionService` injected into patient-portal controller without breaking existing staff whisper endpoint
