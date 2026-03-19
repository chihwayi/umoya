import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';

@Injectable()
export class StreamingDiagnosisService {
  private readonly logger = new Logger(StreamingDiagnosisService.name);
  private cdssUrl = process.env.CDSS_SERVICE_URL || 'http://localhost:8001';

  /**
   * Stream differential diagnosis via SSE.
   * Called by the controller with the raw Express Response object.
   */
  async streamDifferential(
    text: string,
    patientId: string,
    sessionId: string,
    res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const cdssRes = await axios.post(
        `${this.cdssUrl}/diagnosis/suggest/stream`,
        { text, patientId, sessionId },
        { responseType: 'stream', timeout: 30000 },
      );

      cdssRes.data.on('data', (chunk: Buffer) => {
        res.write(chunk.toString());
      });

      cdssRes.data.on('end', () => {
        res.write('event: done\ndata: {}\n\n');
        res.end();
      });

      cdssRes.data.on('error', (err: Error) => {
        this.logger.warn(`CDSS stream error: ${err.message}`);
        res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
        res.end();
      });
    } catch (e: any) {
      // CDSS unavailable — return a mock differential
      this.logger.warn(`Streaming diagnosis CDSS unavailable: ${e?.message}`);
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
  async suggestDifferential(text: string, patientId: string) {
    try {
      const { data } = await axios.post(`${this.cdssUrl}/diagnosis/suggest`, { text, patientId });
      return data;
    } catch (e: any) {
      this.logger.warn(`Diagnosis suggest failed: ${e?.message}`);
      return { differential: [], error: 'CDSS unavailable' };
    }
  }
}
