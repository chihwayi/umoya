/**
 * Transcription Service
 * Handles speech-to-text conversion using Whisper API
 */

import { Injectable, Logger } from '@nestjs/common';
import 'multer'; // Ensure multer types are loaded
import * as FormData from 'form-data';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { config } from '@medicore/config';

export interface TranscriptionOptions {
  language?: 'en' | 'sn' | 'nd' | 'auto';
  temperature?: number;
  prompt?: string;
}

export interface TranscriptionRequestContext {
  tenantId?: string;
  authorization?: string;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  confidence?: number;
  soap_note?: string;
  audio_url?: string;
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly WHISPER_API_URL = config.ai.transcription.apiUrl;
  private readonly WHISPER_API_KEY = config.ai.transcription.apiKey;
  // Default to true for CDSS service integration
  private readonly USE_LOCAL_WHISPER = config.ai.transcription.useLocal; 
  private readonly LOCAL_WHISPER_URL = config.ai.transcription.localUrl;

  constructor() {
    if (this.USE_LOCAL_WHISPER && !this.LOCAL_WHISPER_URL) {
      this.logger.warn('LOCAL_WHISPER_URL is not set, but USE_LOCAL_WHISPER is true.');
    }
  }

  /**
   * Transcribe audio file using Whisper
   * Supports both OpenAI Whisper API and self-hosted Whisper instances
   */
  async transcribe(
    audioFile: Express.Multer.File,
    options: TranscriptionOptions = {},
    requestContext: TranscriptionRequestContext = {},
  ): Promise<TranscriptionResult> {
    try {
      const {
        language = 'auto',
        temperature = 0.0,
        prompt = 'This is a medical consultation between a doctor and patient. Medical terminology, vitals, symptoms, and diagnoses should be transcribed accurately.',
      } = options;

      // Use local Whisper if configured, otherwise use OpenAI API
      if (this.USE_LOCAL_WHISPER) {
        return await this.transcribeWithLocalWhisper(audioFile, { language, temperature, prompt }, requestContext);
      } else {
        return await this.transcribeWithOpenAI(audioFile, { language, temperature, prompt });
      }
    } catch (error: any) {
      this.logger.error(`Transcription failed: ${error.message}`, error.stack);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * Transcribe using OpenAI Whisper API
   */
  private async transcribeWithOpenAI(
    audioFile: Express.Multer.File,
    options: TranscriptionOptions,
  ): Promise<TranscriptionResult> {
    if (!this.WHISPER_API_KEY) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY or WHISPER_API_KEY environment variable.');
    }

    try {
      // Create form data
      const formData = new FormData();
      
      // Create a readable stream from the buffer
      formData.append('file', audioFile.buffer, {
        filename: audioFile.originalname || 'recording.wav',
        contentType: audioFile.mimetype || 'audio/wav',
      });

      formData.append('model', 'whisper-1');
      
      if (options.language && options.language !== 'auto') {
        // Map language codes
        const languageMap: Record<string, string> = {
          'en': 'en',
          'sn': 'sn', // Shona
          'nd': 'nd', // Ndebele
        };
        formData.append('language', languageMap[options.language] || 'en');
      }

      if (options.temperature !== undefined) {
        formData.append('temperature', options.temperature.toString());
      }

      if (options.prompt) {
        formData.append('prompt', options.prompt);
      }

      // Call OpenAI Whisper API
      const response = await axios.post(this.WHISPER_API_URL, formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${this.WHISPER_API_KEY}`,
        },
        timeout: 60000, // 60 second timeout
      });

      return {
        text: response.data.text || '',
        language: response.data.language || options.language || 'en',
        segments: response.data.segments,
      };
    } catch (error: any) {
      this.logger.error(`OpenAI Whisper API error: ${error.message}`, error.response?.data);
      throw new Error(`OpenAI Whisper API error: ${error.message}`);
    }
  }

  /**
   * Transcribe using self-hosted Whisper instance (CDSS Service)
   */
  private async transcribeWithLocalWhisper(
    audioFile: Express.Multer.File,
    options: TranscriptionOptions,
    requestContext: TranscriptionRequestContext = {},
  ): Promise<TranscriptionResult> {
    try {
      const formData = new FormData();
      // CDSS Service expects 'file' parameter
      formData.append('file', audioFile.buffer, {
        filename: audioFile.originalname || 'recording.wav',
        contentType: audioFile.mimetype || 'audio/wav',
      });

      // CDSS Service parameters
      formData.append('generate_soap', 'true');
      
      if (options.language && options.language !== 'auto') {
        formData.append('language', options.language);
      }

      if (options.temperature !== undefined) {
        formData.append('temperature', options.temperature.toString());
      }

      this.logger.log(`Sending transcription request to ${this.LOCAL_WHISPER_URL}`);

      const headers: Record<string, string> = {
        ...(formData.getHeaders() as Record<string, string>),
      };
      if (requestContext.tenantId) {
        headers['X-Tenant-ID'] = requestContext.tenantId;
      }
      if (requestContext.authorization) {
        headers['Authorization'] = requestContext.authorization;
      }

      const response = await axios.post(this.LOCAL_WHISPER_URL, formData, {
        headers,
        timeout: 300000, // 5 minute timeout for local processing
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      return this.parseLocalWhisperResponse(response.data, options.language || 'en');
    } catch (error: any) {
      this.logger.error(`Local Whisper API error: ${error.message}`, error.response?.data);
      throw new Error(`Local Whisper API error: ${error.message}`);
    }
  }

  private parseLocalWhisperResponse(responseData: any, fallbackLanguage: string): TranscriptionResult {
    // Preferred CDSS contract
    const nested = responseData?.transcription;
    if (nested && typeof nested === 'object') {
      const text = this.requireNonEmptyString(nested.text, 'transcription.text');
      return {
        text,
        language: this.normalizeLanguage(nested.language, fallbackLanguage),
        segments: this.normalizeSegments(nested.segments),
        confidence: this.normalizeConfidence(nested.language_probability ?? nested.confidence),
        soap_note: responseData?.soap_note,
        audio_url: this.normalizeOptionalString(responseData?.audio_url),
      };
    }

    // Legacy flat contract
    if (typeof responseData?.text === 'string') {
      return {
        text: this.requireNonEmptyString(responseData.text, 'text'),
        language: this.normalizeLanguage(responseData?.language, fallbackLanguage),
        segments: this.normalizeSegments(responseData?.segments),
        confidence: this.normalizeConfidence(responseData?.confidence),
        soap_note: responseData?.soap_note,
        audio_url: this.normalizeOptionalString(responseData?.audio_url),
      };
    }

    // whisper-asr-webservice style
    if (typeof responseData?.data?.text === 'string') {
      return {
        text: this.requireNonEmptyString(responseData.data.text, 'data.text'),
        language: this.normalizeLanguage(responseData?.data?.language, fallbackLanguage),
        segments: this.normalizeSegments(responseData?.data?.segments),
        confidence: this.normalizeConfidence(responseData?.data?.confidence),
      };
    }

    throw new Error('Invalid transcription response contract from local Whisper service');
  }

  private normalizeLanguage(value: any, fallbackLanguage: string): string {
    const lang = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return lang || fallbackLanguage || 'en';
  }

  private normalizeOptionalString(value: any): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private normalizeConfidence(value: any): number | undefined {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return undefined;
    }
    return Math.max(0, Math.min(1, num));
  }

  private normalizeSegments(rawSegments: any): Array<{ start: number; end: number; text: string }> {
    if (!Array.isArray(rawSegments)) {
      return [];
    }
    const segments: Array<{ start: number; end: number; text: string }> = [];
    for (const seg of rawSegments) {
      const text = typeof seg?.text === 'string' ? seg.text.trim() : '';
      const start = Number(seg?.start);
      const end = Number(seg?.end);
      if (!text || !Number.isFinite(start) || !Number.isFinite(end)) {
        continue;
      }
      segments.push({ start, end, text });
    }
    return segments;
  }

  private requireNonEmptyString(value: any, fieldName: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Invalid transcription response contract: ${fieldName} must be a non-empty string`);
    }
    return value.trim();
  }

  /**
   * Format transcription text for medical context
   */
  formatTranscription(text: string): string {
    if (!text || text.trim().length === 0) {
      return '';
    }

    let formatted = text.trim();

    // Capitalize first letter
    if (formatted.length > 0) {
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }

    // Ensure sentence ends with punctuation
    if (formatted.length > 0 && !/[.!?]/.test(formatted.slice(-1))) {
      formatted += '.';
    }

    // Fix common medical abbreviations
    const abbreviations: Record<string, string> = {
      ' bp ': ' blood pressure ',
      ' hr ': ' heart rate ',
      ' temp ': ' temperature ',
      ' spo2 ': ' oxygen saturation ',
      ' rr ': ' respiratory rate ',
      ' bpm ': ' beats per minute ',
    };

    for (const [abbr, full] of Object.entries(abbreviations)) {
      formatted = formatted.replace(new RegExp(abbr, 'gi'), full);
    }

    return formatted;
  }
}
