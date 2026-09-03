import { Injectable, Logger, Optional } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { CdssService } from './cdss.service';
import { AbstentionLogService, AbstentionReason } from './abstention-log.service';

export interface ClinicalStructuredData {
  chiefComplaint?: string;
  vitals?: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
    respiratoryRate?: string;
    oxygenSaturation?: string;
    weight?: string;
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
    @Optional() private readonly abstentionLog: AbstentionLogService,
  ) {}

  async transcribeAudio(
    audioBase64: string,
    language: string,
    db: any,
    recordedBy: string,
    options?: { patientId?: string; encounterId?: string },
  ): Promise<{ transcriptId: string; text: string; confidence: number }> {
    let text = '';
    let confidence = 0;
    let structuredData: ClinicalStructuredData = {};
    let abstained = false;

    if (this.cdss) {
      try {
        // F13 fix (S273) — Math.random() is not cryptographically secure and was
        // the odd one out; every other generated ID in this codebase (MRNs, claim
        // numbers, tokens) already uses crypto. Matches the established pattern.
        const sessionId = `voice_${Date.now()}_${randomBytes(6).toString('hex')}`;
        const result = await this.cdss.ambientTranscriptionStream({
          sessionId,
          audioBase64,
          context: { language },
          patientId: options?.patientId,
          appointmentId: options?.encounterId,
        });

        if (result.abstained) {
          abstained = true;
          await this.abstentionLog?.log(db, 'voice_transcription', 'cdss_error', { errorDetail: result.abstainReason ?? undefined });
          text = '';
          confidence = 0;
        } else {
          text = result.transcript;
          confidence = result.entities?.diagnoses?.length || result.entities?.medications?.length ? 0.85 : 0.7;
          structuredData = this.mapEntitiesToStructured(result);
        }
      } catch (err: any) {
        this.logger.warn(`CDSS transcription error: ${err.message}`);
        await this.abstentionLog?.log(db, 'voice_transcription', 'cdss_error', {});
        abstained = true;
      }
    } else {
      abstained = true;
      await this.abstentionLog?.log(db, 'voice_transcription', 'not_configured', {});
    }

    const rows = await db.query(
      `INSERT INTO voice_transcriptions
         (patient_id, encounter_id, recorded_by, transcript_text, structured_data,
          language, confidence, abstained)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        options?.patientId ?? null,
        options?.encounterId ?? null,
        recordedBy,
        text,
        JSON.stringify(structuredData),
        language,
        confidence,
        abstained,
      ],
    );

    return { transcriptId: rows[0].id, text, confidence };
  }

  async parseClinical(transcriptId: string, transcriptText: string, db: any): Promise<ClinicalStructuredData> {
    let structured: ClinicalStructuredData = {};

    if (this.cdss) {
      try {
        const sessionId = `parse_${transcriptId}`;
        const result = await this.cdss.ambientTranscriptionStream({
          sessionId,
          audioBase64: '',
          context: { text: transcriptText, mode: 'parse_only' },
        });
        if (!result.abstained) {
          structured = this.mapEntitiesToStructured(result);
        }
      } catch (err: any) {
        this.logger.warn(`CDSS parse error: ${err.message}`);
        structured = this.regexExtract(transcriptText);
      }
    } else {
      structured = this.regexExtract(transcriptText);
    }

    await db.query(
      `UPDATE voice_transcriptions SET structured_data = $1 WHERE id = $2`,
      [JSON.stringify(structured), transcriptId],
    );

    return structured;
  }

  async getTranscription(transcriptId: string, db: any): Promise<unknown | null> {
    const rows = await db.query(
      `SELECT * FROM voice_transcriptions WHERE id = $1`,
      [transcriptId],
    );
    return rows[0] ?? null;
  }

  private mapEntitiesToStructured(result: any): ClinicalStructuredData {
    const structured: ClinicalStructuredData = {};

    if (result.entities?.vitals?.length) {
      structured.vitals = {};
      for (const v of result.entities.vitals) {
        const t = (v.type ?? '').toLowerCase();
        if (t.includes('bp') || t.includes('blood_pressure') || t.includes('blood pressure')) structured.vitals.bloodPressure = v.value;
        else if (t.includes('hr') || t.includes('heart')) structured.vitals.heartRate = v.value;
        else if (t.includes('temp')) structured.vitals.temperature = v.value;
        else if (t.includes('rr') || t.includes('respiratory')) structured.vitals.respiratoryRate = v.value;
        else if (t.includes('spo2') || t.includes('oxygen') || t.includes('sat')) structured.vitals.oxygenSaturation = v.value;
        else if (t.includes('weight')) structured.vitals.weight = v.value;
      }
    }

    if (result.entities?.diagnoses?.length) {
      structured.diagnoses = result.entities.diagnoses.map((d: any) => d.text ?? d.icd ?? String(d));
    }

    if (result.entities?.medications?.length) {
      structured.medications = result.entities.medications.map(
        (m: any) => [m.name, m.dose, m.route].filter(Boolean).join(' '),
      );
    }

    if (result.draftNote?.subjective) {
      structured.chiefComplaint = result.draftNote.subjective;
    }

    if (result.draftNote?.plan) {
      structured.plan = result.draftNote.plan;
    }

    return structured;
  }

  private regexExtract(text: string): ClinicalStructuredData {
    const structured: ClinicalStructuredData = {};

    const ccMatch = text.match(/(?:complain(?:t|ing)(?: of)?|presenting with|c\/o)[:\s]+([^.;]+)/i);
    if (ccMatch) structured.chiefComplaint = ccMatch[1].trim();

    const bpMatch = text.match(/(?:bp|blood pressure)[:\s]+(\d+\/\d+)/i);
    const hrMatch = text.match(/(?:hr|heart rate|pulse)[:\s]+(\d+)/i);
    const tempMatch = text.match(/(?:temp(?:erature)?)[:\s]+(\d+\.?\d*)/i);
    const rrMatch = text.match(/(?:rr|resp(?:iratory rate)?)[:\s]+(\d+)/i);
    const spo2Match = text.match(/(?:spo2|o2 sat|oxygen)[:\s]+(\d+\.?\d*)%?/i);
    const wtMatch = text.match(/(?:weight|wt)[:\s]+(\d+\.?\d*)\s*kg/i);

    if (bpMatch || hrMatch || tempMatch || rrMatch || spo2Match || wtMatch) {
      structured.vitals = {};
      if (bpMatch) structured.vitals.bloodPressure = bpMatch[1];
      if (hrMatch) structured.vitals.heartRate = hrMatch[1];
      if (tempMatch) structured.vitals.temperature = tempMatch[1];
      if (rrMatch) structured.vitals.respiratoryRate = rrMatch[1];
      if (spo2Match) structured.vitals.oxygenSaturation = spo2Match[1];
      if (wtMatch) structured.vitals.weight = wtMatch[1];
    }

    const planMatch = text.match(/(?:plan|treatment)[:\s]+([^.;]+)/i);
    if (planMatch) structured.plan = planMatch[1].trim();

    return structured;
  }
}
