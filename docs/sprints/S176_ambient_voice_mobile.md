# S176 — Ambient Voice AI for Mobile

**Phase:** 2 — AI Intelligence Amplification  
**Effort:** L  
**Depends on:** S175  
**Goal:** On mobile, a clinician can tap "Start Dictation" during or after an encounter. Speech is transcribed, parsed into structured clinical data (chief complaint, vitals mentioned, diagnoses, plan), and pre-fills the encounter form — reducing data entry time by 70%.

---

## Problem

Clinicians on mobile must manually type all encounter data. This is the single biggest friction point on the mobile app. Voice-to-structured-data is the most requested feature. The patient portal already has a voice input stub — it must be replaced with a real implementation.

---

## Acceptance Criteria

1. A "Dictate" FAB (floating action button) appears on the mobile encounter entry screen.
2. Tapping starts recording via the device microphone (expo-av or expo-speech).
3. Audio is sent to `POST /voice/transcribe` which returns transcript text.
4. Transcript is parsed by `POST /voice/parse-clinical` which extracts structured fields.
5. Extracted fields pre-fill the encounter form: chief_complaint, vitals, diagnoses, plan.
6. Clinician reviews and edits before saving — AI never saves without review.
7. Transcription and parse results are stored in `voice_transcriptions` table.
8. If voice service is unavailable, user sees "Voice unavailable — please type manually" (no crash).
9. `tsc --noEmit` and `npx expo export --platform all` pass.
10. i18n keys in all 8 locales.

---

## 1. Database Provisioning

```typescript
{
  id: 'voice_transcriptions',
  version: '2026.05.27.1',
  statements: () => [
    `CREATE TABLE IF NOT EXISTS voice_transcriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID,
      encounter_id UUID,
      recorded_by UUID NOT NULL,
      transcript_text TEXT NOT NULL,
      structured_data JSONB NOT NULL DEFAULT '{}',
      duration_seconds INTEGER,
      language VARCHAR(8) NOT NULL DEFAULT 'en',
      confidence NUMERIC(4,3),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_vt_encounter ON voice_transcriptions(encounter_id)`,
    `CREATE INDEX IF NOT EXISTS idx_vt_patient ON voice_transcriptions(patient_id, created_at DESC)`,
  ],
},
```

---

## 2. Backend — VoiceTranscriptionService

Create `services/ehr-service/src/services/voice-transcription.service.ts`:

```typescript
import { Injectable, Logger, Optional } from '@nestjs/common';
import { CdssService } from './cdss.service';

export interface ClinicalStructuredData {
  chiefComplaint?: string;
  vitals?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    weight?: number;
  };
  diagnoses?: string[];
  medications?: string[];
  plan?: string;
  followUp?: string;
}

@Injectable()
export class VoiceTranscriptionService {
  private readonly logger = new Logger(VoiceTranscriptionService.name);

  constructor(
    @Optional() private readonly cdss: CdssService,
  ) {}

  async transcribeAudio(
    audioBase64: string,
    language: string,
    db: any,
    recordedBy: string,
    options?: { patientId?: string; encounterId?: string; durationSeconds?: number },
  ): Promise<{ transcriptId: string; text: string; confidence: number }> {
    let text = '';
    let confidence = 0;

    if (this.cdss) {
      try {
        const result = await this.cdss.transcribeAudio({
          audioBase64,
          language,
          context: 'clinical',
        });
        text = result?.text ?? '';
        confidence = result?.confidence ?? 0;
      } catch (err) {
        this.logger.warn(`Transcription failed: ${err.message}`);
        throw new Error('Voice service unavailable');
      }
    } else {
      throw new Error('Voice service not configured');
    }

    const rows = await db.query(
      `INSERT INTO voice_transcriptions
         (patient_id, encounter_id, recorded_by, transcript_text, duration_seconds, language, confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [
        options?.patientId ?? null,
        options?.encounterId ?? null,
        recordedBy,
        text,
        options?.durationSeconds ?? null,
        language,
        confidence,
      ],
    );

    return { transcriptId: rows[0].id, text, confidence };
  }

  async parseClinical(
    transcriptId: string,
    transcriptText: string,
    db: any,
  ): Promise<ClinicalStructuredData> {
    let structured: ClinicalStructuredData = {};

    if (this.cdss) {
      try {
        structured = await this.cdss.parseClinicalNarrative(transcriptText) ?? {};
      } catch (err) {
        this.logger.warn(`Clinical parse failed: ${err.message}`);
        // Fall back to regex-based extraction
        structured = this.regexExtract(transcriptText);
      }
    } else {
      structured = this.regexExtract(transcriptText);
    }

    await db.query(
      `UPDATE voice_transcriptions SET structured_data = $2 WHERE id = $1`,
      [transcriptId, JSON.stringify(structured)],
    );

    return structured;
  }

  private regexExtract(text: string): ClinicalStructuredData {
    const result: ClinicalStructuredData = {};

    // Chief complaint: "complaining of X" or "presents with X"
    const ccMatch = text.match(/(?:complaining of|presents? with|chief complaint is?)\s+([^.]+)/i);
    if (ccMatch) result.chiefComplaint = ccMatch[1].trim();

    // Blood pressure
    const bpMatch = text.match(/(?:BP|blood pressure)[:\s]+(\d{2,3}\/\d{2,3})/i);
    if (bpMatch) result.vitals = { ...result.vitals, bloodPressure: bpMatch[1] };

    // Heart rate
    const hrMatch = text.match(/(?:HR|heart rate|pulse)[:\s]+(\d{2,3})/i);
    if (hrMatch) result.vitals = { ...result.vitals, heartRate: parseInt(hrMatch[1]) };

    // Temperature
    const tempMatch = text.match(/(?:temp|temperature)[:\s]+([\d.]+)/i);
    if (tempMatch) result.vitals = { ...result.vitals, temperature: parseFloat(tempMatch[1]) };

    // Plan
    const planMatch = text.match(/(?:plan|treatment plan|management)[:\s]+([^.]+)/i);
    if (planMatch) result.plan = planMatch[1].trim();

    return result;
  }

  async getTranscription(transcriptId: string, db: any): Promise<unknown | null> {
    const rows = await db.query(
      `SELECT * FROM voice_transcriptions WHERE id = $1`,
      [transcriptId],
    );
    return rows[0] ?? null;
  }
}
```

---

## 3. Backend — VoiceController

Create `services/ehr-service/src/controllers/voice.controller.ts`:

```typescript
import {
  Controller, Post, Body, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { VoiceTranscriptionService } from '../services/voice-transcription.service';

@UseGuards(JwtAuthGuard)
@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceSvc: VoiceTranscriptionService) {}

  @Post('transcribe')
  async transcribe(
    @Body() body: {
      audioBase64: string;
      language?: string;
      patientId?: string;
      encounterId?: string;
      durationSeconds?: number;
    },
    @Req() req: any,
  ): Promise<{ transcriptId: string; text: string; confidence: number }> {
    return this.voiceSvc.transcribeAudio(
      body.audioBase64,
      body.language ?? 'en',
      req.tenantDb,
      req.user.sub,
      {
        patientId: body.patientId,
        encounterId: body.encounterId,
        durationSeconds: body.durationSeconds,
      },
    );
  }

  @Post('parse-clinical')
  async parseClinical(
    @Body() body: { transcriptId: string; transcriptText: string },
    @Req() req: any,
  ): Promise<unknown> {
    return this.voiceSvc.parseClinical(
      body.transcriptId,
      body.transcriptText,
      req.tenantDb,
    );
  }
}
```

---

## 4. Register in ehr.module.ts

```typescript
import { VoiceTranscriptionService } from './services/voice-transcription.service';
import { VoiceController } from './controllers/voice.controller';

controllers: [ /* ...existing... */ VoiceController ],
providers: [ /* ...existing... */ VoiceTranscriptionService ],
```

---

## 5. Mobile — Voice Dictation Component

Create `mobile/src/components/VoiceDictationFab.tsx`:

```tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  TouchableOpacity, View, Text, ActivityIndicator,
  StyleSheet, Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { C, FONT, RADIUS, SHADOW, SPACING } from '../design/tokens';
import { api } from '../services/api';
import { useTranslation } from 'react-i18next';

interface Props {
  patientId?: string;
  encounterId?: string;
  onParsed: (data: Record<string, unknown>) => void;
}

type RecordingState = 'idle' | 'recording' | 'transcribing' | 'parsing' | 'error';

export const VoiceDictationFab: React.FC<Props> = ({ patientId, encounterId, onParsed }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<RecordingState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  const startRecording = useCallback(async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setState('recording');
      startPulse();
    } catch (err) {
      setErrorMsg(t('voice.error_mic'));
      setState('error');
    }
  }, []);

  const stopAndProcess = useCallback(async () => {
    if (!recordingRef.current) return;
    stopPulse();
    setState('transcribing');

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      // Read audio as base64
      const { FileSystem } = await import('expo-file-system');
      const audioBase64 = await FileSystem.readAsStringAsync(uri!, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const transcribeRes = await api.post('/voice/transcribe', {
        audioBase64,
        language: 'en',
        patientId,
        encounterId,
      });

      setState('parsing');
      const parseRes = await api.post('/voice/parse-clinical', {
        transcriptId: transcribeRes.data.transcriptId,
        transcriptText: transcribeRes.data.text,
      });

      onParsed(parseRes.data);
      setState('idle');
    } catch (err: any) {
      setErrorMsg(err.message?.includes('unavailable')
        ? t('voice.service_unavailable')
        : t('voice.error_generic'));
      setState('error');
    }
  }, [patientId, encounterId, onParsed]);

  const fabColor: Record<RecordingState, string> = {
    idle:        C.blue,
    recording:   C.red,
    transcribing: C.amber,
    parsing:     C.amber,
    error:       '#9ca3af',
  };

  const fabLabel: Record<RecordingState, string> = {
    idle:        t('voice.tap_to_dictate'),
    recording:   t('voice.tap_to_stop'),
    transcribing: t('voice.transcribing'),
    parsing:     t('voice.parsing'),
    error:       errorMsg || t('voice.error_generic'),
  };

  return (
    <View style={styles.container}>
      {state !== 'idle' && state !== 'recording' && (
        <View style={styles.statusBubble}>
          <ActivityIndicator size="small" color={C.blue} />
          <Text style={styles.statusText}>{fabLabel[state]}</Text>
        </View>
      )}
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          onPress={state === 'recording' ? stopAndProcess : startRecording}
          disabled={state === 'transcribing' || state === 'parsing'}
          style={[styles.fab, { backgroundColor: fabColor[state] }]}
        >
          <Text style={styles.fabIcon}>
            {state === 'recording' ? '■' : '🎙'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.lg,
    alignItems: 'flex-end',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.md,
  },
  fabIcon: {
    fontSize: 24,
  },
  statusBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'white',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    ...SHADOW.sm,
    maxWidth: 200,
  },
  statusText: {
    fontFamily: FONT.ui,
    fontSize: 12,
    color: '#374151',
    flex: 1,
    flexWrap: 'wrap',
  },
});
```

### Usage in encounter entry screen:

```tsx
import { VoiceDictationFab } from '../components/VoiceDictationFab';

// Inside encounter form screen:
<VoiceDictationFab
  patientId={patientId}
  encounterId={encounterId}
  onParsed={(data) => {
    if (data.chiefComplaint) setChiefComplaint(data.chiefComplaint);
    if (data.plan) setPlan(data.plan);
    if (data.vitals?.bloodPressure) setBp(data.vitals.bloodPressure);
    if (data.vitals?.heartRate) setHr(String(data.vitals.heartRate));
  }}
/>
```

---

## 6. i18n Keys — All 8 Locales

### `en.json`:
```json
"voice": {
  "tap_to_dictate": "Tap to Dictate",
  "tap_to_stop": "Tap to Stop",
  "transcribing": "Transcribing...",
  "parsing": "Parsing clinical data...",
  "service_unavailable": "Voice unavailable — please type manually",
  "error_mic": "Microphone access denied",
  "error_generic": "Voice error — please try again",
  "review_notice": "Please review AI-filled fields before saving"
}
```

### `sn.json`:
```json
"voice": {
  "tap_to_dictate": "Bedera kuti Udikite",
  "tap_to_stop": "Bedera kuti Umise",
  "transcribing": "Kunyora...",
  "parsing": "Kuyera data yekurapa...",
  "service_unavailable": "Inzwi haikwanisi — ndapota nyora neruoko",
  "error_mic": "Kutendera kwemaikrofoni kwarambidzwa",
  "error_generic": "Kukanganisa kweinzwi — ndapota edza zvakare",
  "review_notice": "Ndapota ongorora minda yakazadzwa neAI usati waponesa"
}
```

### `nd.json`:
```json
"voice": {
  "tap_to_dictate": "Thepha Ukumlayisha",
  "tap_to_stop": "Thepha Ukumisa",
  "transcribing": "Kubhala...",
  "parsing": "Ukuhlaziya idatha yezokwelapha...",
  "service_unavailable": "Izwi alitholakali — sicela ubhale ngezandla",
  "error_mic": "Ukufinyelela ikhamera kwehlulekile",
  "error_generic": "Iphutha lezwi — zama futhi",
  "review_notice": "Sicela ubuyekeze amasimu agcwalisiwe yi-AI ngaphambi kokulondoloza"
}
```

### `pt.json`:
```json
"voice": {
  "tap_to_dictate": "Toque para Ditar",
  "tap_to_stop": "Toque para Parar",
  "transcribing": "A transcrever...",
  "parsing": "A analisar dados clínicos...",
  "service_unavailable": "Voz indisponível — por favor escreva manualmente",
  "error_mic": "Acesso ao microfone negado",
  "error_generic": "Erro de voz — por favor tente novamente",
  "review_notice": "Reveja os campos preenchidos pela IA antes de guardar"
}
```

### `fr.json`:
```json
"voice": {
  "tap_to_dictate": "Appuyez pour Dicter",
  "tap_to_stop": "Appuyez pour Arrêter",
  "transcribing": "Transcription en cours...",
  "parsing": "Analyse des données cliniques...",
  "service_unavailable": "Voix indisponible — veuillez saisir manuellement",
  "error_mic": "Accès au microphone refusé",
  "error_generic": "Erreur vocale — veuillez réessayer",
  "review_notice": "Veuillez vérifier les champs remplis par l'IA avant d'enregistrer"
}
```

### `sw.json`:
```json
"voice": {
  "tap_to_dictate": "Gusa Kusema",
  "tap_to_stop": "Gusa Kusimama",
  "transcribing": "Kuandika...",
  "parsing": "Kuchambua data ya kliniki...",
  "service_unavailable": "Sauti haipatikani — tafadhali andika kwa mkono",
  "error_mic": "Ufikiaji wa maikrofoni umekataliwa",
  "error_generic": "Hitilafu ya sauti — jaribu tena",
  "review_notice": "Tafadhali kagua sehemu zilizojazwa na AI kabla ya kuhifadhi"
}
```

### `zu.json`:
```json
"voice": {
  "tap_to_dictate": "Thepha Ukusho",
  "tap_to_stop": "Thepha Ukumisa",
  "transcribing": "Kubhala...",
  "parsing": "Ukuhlaziya idatha yezokwelapha...",
  "service_unavailable": "Izwi alitholakali — sicela ubhale ngesandla",
  "error_mic": "Ukufinyelela ishayeleli kwehlulekile",
  "error_generic": "Iphutha lezwi — zama futhi",
  "review_notice": "Sicela ubuyekeze amasimu agcwalisiwe yi-AI ngaphambi kokulondoloza"
}
```

### `af.json`:
```json
"voice": {
  "tap_to_dictate": "Tik om te Dikteer",
  "tap_to_stop": "Tik om te Stop",
  "transcribing": "Transkribeer...",
  "parsing": "Kliniese data ontleed...",
  "service_unavailable": "Stem nie beskikbaar nie — tik asseblief handmatig",
  "error_mic": "Mikrofoon toegang geweier",
  "error_generic": "Stemfout — probeer asseblief weer",
  "review_notice": "Hersien asseblief KI-gevulde velde voor stoor"
}
```

---

## 7. Jest Spec

Create `services/ehr-service/src/services/voice-transcription.service.spec.ts`:

```typescript
import { VoiceTranscriptionService } from './voice-transcription.service';

function makeService(cdss?: any) {
  return new VoiceTranscriptionService(cdss ?? null);
}

function makeDb() {
  return {
    query: jest.fn()
      .mockResolvedValueOnce([{ id: 'transcript-1' }]) // INSERT
      .mockResolvedValue([]),
  };
}

describe('VoiceTranscriptionService', () => {
  it('throws when CDSS not configured', async () => {
    const svc = makeService(null);
    const db = makeDb();
    await expect(
      svc.transcribeAudio('base64data', 'en', db, 'doc1'),
    ).rejects.toThrow('Voice service not configured');
  });

  it('transcribes via CDSS when available', async () => {
    const cdss = {
      transcribeAudio: jest.fn().mockResolvedValue({ text: 'Patient has chest pain', confidence: 0.95 }),
    };
    const svc = makeService(cdss);
    const db = makeDb();
    const result = await svc.transcribeAudio('base64data', 'en', db, 'doc1');
    expect(result.text).toBe('Patient has chest pain');
    expect(result.transcriptId).toBe('transcript-1');
  });

  it('throws when CDSS transcription fails', async () => {
    const cdss = {
      transcribeAudio: jest.fn().mockRejectedValue(new Error('network error')),
    };
    const svc = makeService(cdss);
    const db = makeDb();
    await expect(
      svc.transcribeAudio('data', 'en', db, 'doc1'),
    ).rejects.toThrow('Voice service unavailable');
  });

  it('regexExtract parses blood pressure from text', async () => {
    const svc = makeService(null);
    const db = { query: jest.fn().mockResolvedValue([]) };
    const structured = await svc.parseClinical(
      'tid-1',
      'Patient BP: 120/80. Complaining of headache. Plan: paracetamol.',
      db,
    );
    expect(structured.vitals?.bloodPressure).toBe('120/80');
    expect(structured.chiefComplaint).toContain('headache');
    expect(structured.plan).toContain('paracetamol');
  });

  it('parseClinical uses CDSS when available', async () => {
    const cdss = {
      parseClinicalNarrative: jest.fn().mockResolvedValue({
        chiefComplaint: 'Fever',
        plan: 'Rest and fluids',
      }),
    };
    const svc = makeService(cdss);
    const db = { query: jest.fn().mockResolvedValue([]) };
    const result = await svc.parseClinical('t1', 'Patient has fever.', db);
    expect(result.chiefComplaint).toBe('Fever');
  });
});
```

---

## 8. Definition of Done

- [ ] `voice_transcriptions` table provisioned; repair passes
- [ ] `VoiceTranscriptionService` and `VoiceController` in `ehr.module.ts`
- [ ] `POST /voice/transcribe` returns `{ transcriptId, text, confidence }`
- [ ] `POST /voice/parse-clinical` returns structured clinical fields
- [ ] `VoiceDictationFab` component exists in `mobile/src/components/`
- [ ] FAB is wired into the encounter entry screen and pre-fills form on `onParsed`
- [ ] Error states show user-facing message — no unhandled crashes
- [ ] `tsc --noEmit` passes in `services/ehr-service/`
- [ ] All Jest specs pass
- [ ] i18n keys in all 8 locale files
- [ ] `npx expo export --platform all` passes
