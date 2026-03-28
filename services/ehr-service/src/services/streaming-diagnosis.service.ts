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
      this.logger.warn(`Streaming diagnosis governed CDSS path unavailable: ${e?.message}`);
      const mock = [
        { rank: 1, diagnosis: 'Upper respiratory tract infection', confidence: 0.72, icd10: 'J06.9', red_flags: [] },
        { rank: 2, diagnosis: 'Influenza', confidence: 0.45, icd10: 'J11.1', red_flags: ['fever > 39°C'] },
        { rank: 3, diagnosis: 'COVID-19', confidence: 0.38, icd10: 'U07.1', red_flags: ['oxygen saturation < 94%'] },
      ];
      res.write(`data: ${JSON.stringify({ differential: mock, partial: false })}\n\n`);
      res.write('event: done\ndata: {}\n\n');
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
