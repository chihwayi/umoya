import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Optional } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TranscriptionService } from '../services/transcription.service';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export interface VoiceCommand {
  type: string;
  data: Record<string, any>;
}

@WebSocketGateway({ namespace: '/voice', cors: { origin: '*' } })
export class VoiceTranscriptionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(VoiceTranscriptionGateway.name);
  private audioBuffers = new Map<string, Buffer[]>();

  constructor(@Optional() private readonly transcriptionService?: TranscriptionService) {}

  handleConnection(client: Socket) {
    this.audioBuffers.set(client.id, []);
    this.logger.log(`Voice client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.audioBuffers.delete(client.id);
    this.logger.log(`Voice client disconnected: ${client.id}`);
  }

  @SubscribeMessage('audio_chunk')
  async handleAudioChunk(
    client: Socket,
    payload: { audio: string; format?: string; tenantId?: string },
  ) {
    try {
      const buffer = Buffer.from(payload.audio, 'base64');
      const buffers = this.audioBuffers.get(client.id) || [];
      buffers.push(buffer);
      this.audioBuffers.set(client.id, buffers);

      const totalSize = buffers.reduce((sum, b) => sum + b.length, 0);
      if (totalSize > 32768) {
        await this.processAndEmit(client, buffers);
        this.audioBuffers.set(client.id, []);
      }
    } catch (e: any) {
      client.emit('transcription_error', { error: e.message });
    }
  }

  @SubscribeMessage('audio_end')
  async handleAudioEnd(client: Socket) {
    const buffers = this.audioBuffers.get(client.id) || [];
    if (buffers.length > 0) {
      await this.processAndEmit(client, buffers);
      this.audioBuffers.set(client.id, []);
    }
  }

  private async processAndEmit(client: Socket, buffers: Buffer[]) {
    if (!this.transcriptionService) {
      client.emit('transcription_error', { error: 'Transcription service not available' });
      return;
    }

    const combined = Buffer.concat(buffers);
    const tmpPath = path.join(os.tmpdir(), `voice_${client.id}_${Date.now()}.webm`);

    try {
      fs.writeFileSync(tmpPath, combined);
      const fakeMulterFile = {
        path: tmpPath,
        originalname: 'voice.webm',
        mimetype: 'audio/webm',
        buffer: combined,
        size: combined.length,
      } as any;

      const result = await this.transcriptionService.transcribe(fakeMulterFile, { language: 'auto' });
      const command = this.parseVoiceCommand(result.text);
      client.emit('transcription', {
        text: result.text,
        command,
        timestamp: Date.now(),
      });
    } catch (e: any) {
      client.emit('transcription_error', { error: e.message });
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }

  parseVoiceCommand(text: string): VoiceCommand | null {
    const lower = text.toLowerCase().trim();
    if (!lower) return null;

    const prescribeMatch = lower.match(
      /prescribe\s+(.+?)\s+(\d+\s*(?:mg|ml|mcg|units?|g))\s*(.*)/i,
    );
    if (prescribeMatch) {
      return {
        type: 'prescribe',
        data: {
          medication: prescribeMatch[1].trim(),
          dose: prescribeMatch[2].trim(),
          frequency: prescribeMatch[3]?.trim() || '',
        },
      };
    }

    const orderMatch = lower.match(/order\s+(.+)/i);
    if (orderMatch) {
      return { type: 'order_lab', data: { test: orderMatch[1].trim() } };
    }

    const bpMatch = lower.match(
      /(?:vitals?|record)\s+(?:blood pressure|bp)\s+(\d+)\s*(?:over|\/)\s*(\d+)/i,
    );
    if (bpMatch) {
      return {
        type: 'record_vitals',
        data: { type: 'blood_pressure', systolic: parseInt(bpMatch[1], 10), diastolic: parseInt(bpMatch[2], 10) },
      };
    }

    const tempMatch = lower.match(
      /(?:vitals?|record)\s+(?:temperature|temp)\s+(\d+\.?\d*)/i,
    );
    if (tempMatch) {
      return {
        type: 'record_vitals',
        data: { type: 'temperature', value: parseFloat(tempMatch[1]) },
      };
    }

    const noteMatch = lower.match(/note\s+(.+)/i);
    if (noteMatch) {
      return { type: 'add_note', data: { text: noteMatch[1].trim() } };
    }

    const diagnoseMatch = lower.match(/diagnos[ei]s?\s+(.+)/i);
    if (diagnoseMatch) {
      return { type: 'add_diagnosis', data: { condition: diagnoseMatch[1].trim() } };
    }

    return null;
  }
}
