import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { CdssService } from './cdss.service';

@Injectable()
export class StreamingDiagnosisService {
  private readonly logger = new Logger(StreamingDiagnosisService.name);

  constructor(private readonly cdssService: CdssService) {}

  /**
   * Stream differential diagnosis via SSE.
   * Called by the controller with the raw Express Response object.
   */
  async streamDifferential(
    text: string,
    patientId: string,
    sessionId: string,
    res: Response,
    tenantId?: string,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const diagnosis = await this.cdssService.diagnosisAssist(
        {
          patientId,
          sessionId,
          symptoms: [text],
          clinicalNotes: text,
          context: 'streaming_diagnosis',
          specialty: 'primary_care',
          module: 'diagnostic_workup',
        },
        true,
        tenantId,
      );
      const differential = Array.isArray((diagnosis as any)?.suggested_diagnoses)
        ? (diagnosis as any).suggested_diagnoses.map((item: any, index: number) => ({
            rank: index + 1,
            diagnosis: item?.diagnosis || item?.text || 'Unspecified condition',
            confidence: Number(item?.confidence || item?.probability || 0),
            icd10: item?.icd10 || item?.icd || undefined,
            red_flags: Array.isArray((diagnosis as any)?.red_flags) ? (diagnosis as any).red_flags : [],
          }))
        : [];

      res.write(`data: ${JSON.stringify({ differential, partial: false })}\n\n`);
      res.write('event: done\ndata: {}\n\n');
      res.end();
    } catch (e: any) {
      this.logger.error(`Streaming diagnosis unavailable, CDSS call failed: ${e?.message}`);
      res.write(
        `event: error\ndata: ${JSON.stringify({
          error: 'diagnosis_unavailable',
          message: 'AI diagnosis assist is temporarily unavailable. Please retry or proceed with manual assessment.',
        })}\n\n`,
      );
      res.end();
    }
  }

  /**
   * Non-streaming version for REST clients.
   */
  async suggestDifferential(text: string, patientId: string, tenantId?: string) {
    try {
      return await this.cdssService.diagnosisAssist(
        {
          patientId,
          symptoms: [text],
          clinicalNotes: text,
          context: 'streaming_diagnosis',
          specialty: 'primary_care',
          module: 'diagnostic_workup',
        },
        true,
        tenantId,
      );
    } catch (e: any) {
      this.logger.warn(`Diagnosis suggest failed: ${e?.message}`);
      return { suggested_diagnoses: [], error: 'CDSS unavailable' };
    }
  }
}
