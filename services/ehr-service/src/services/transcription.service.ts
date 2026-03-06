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
    confidence?: number;
    speaker?: string;
    speakerRole?: 'doctor' | 'patient' | 'unknown';
    speakerLabel?: string;
    diarizationConfidence?: number;
  }>;
  confidence?: number;
  soap_note?: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    original_language_detected?: string;
  };
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
        try {
          return await this.transcribeWithLocalWhisper(audioFile, { language, temperature, prompt }, requestContext);
        } catch (localError: any) {
          if (this.WHISPER_API_KEY) {
            this.logger.warn(
              `Local Whisper failed at ${this.resolveLocalWhisperUrl()}, falling back to OpenAI Whisper: ${localError?.message || localError}`,
            );
            return await this.transcribeWithOpenAI(audioFile, { language, temperature, prompt });
          }
          throw localError;
        }
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
      const targetUrl = this.resolveLocalWhisperUrl();
      const isWhisperCpp = this.isWhisperCppInferenceUrl(targetUrl);
      const formData = new FormData();
      // Both whisper.cpp and internal CDSS local server expect multipart "file"
      formData.append('file', audioFile.buffer, {
        filename: audioFile.originalname || 'recording.wav',
        contentType: audioFile.mimetype || 'audio/wav',
      });

      if (isWhisperCpp) {
        // whisper.cpp contract
        formData.append('response_format', 'verbose_json');
        if (options.temperature !== undefined) {
          formData.append('temperature', options.temperature.toString());
        }
        if (options.language && options.language !== 'auto') {
          formData.append('language', options.language);
        }
        if (options.prompt) {
          formData.append('prompt', options.prompt);
        }
      } else {
        // Existing CDSS-local whisper contract
        formData.append('generate_soap', 'true');

        if (options.language && options.language !== 'auto') {
          formData.append('language', options.language);
        }

        if (options.temperature !== undefined) {
          formData.append('temperature', options.temperature.toString());
        }
      }

      this.logger.log(`Sending transcription request to ${targetUrl}`);

      const headers: Record<string, string> = {
        ...(formData.getHeaders() as Record<string, string>),
      };
      if (requestContext.tenantId) {
        headers['X-Tenant-ID'] = requestContext.tenantId;
      }
      if (requestContext.authorization) {
        headers['Authorization'] = requestContext.authorization;
      }

      const response = await axios.post(targetUrl, formData, {
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
    // Text-only contract
    if (typeof responseData === 'string' && responseData.trim().length > 0) {
      return {
        text: this.requireNonEmptyString(responseData, 'text'),
        language: this.normalizeLanguage(fallbackLanguage, fallbackLanguage),
        segments: [],
      };
    }

    // Preferred CDSS contract
    const nested = responseData?.transcription;
    if (nested && typeof nested === 'object') {
      const text = this.requireNonEmptyString(nested.text, 'transcription.text');
      return {
        text,
        language: this.normalizeLanguage(nested.language, fallbackLanguage),
        segments: this.normalizeSegments(nested.segments),
        confidence: this.normalizeConfidence(nested.language_probability ?? nested.confidence),
        soap_note: this.normalizeSoapNote(responseData?.soap_note),
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
        soap_note: this.normalizeSoapNote(responseData?.soap_note),
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

  private resolveLocalWhisperUrl(): string {
    const raw = String(this.LOCAL_WHISPER_URL || '').trim();
    if (!raw) {
      return 'http://127.0.0.1:8080/inference';
    }
    try {
      const parsed = new URL(raw);
      if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname === '') {
        parsed.pathname = '/inference';
      }
      return parsed.toString().replace(/\/$/, '');
    } catch {
      // Non-URL fallback; preserve explicit path if present
      const normalized = raw.replace(/\/+$/, '');
      if (/\/(inference|transcribe)$/.test(normalized)) {
        return normalized;
      }
      return `${normalized}/inference`;
    }
  }

  private isWhisperCppInferenceUrl(url: string): boolean {
    return /\/inference$/i.test(String(url || '').replace(/\/+$/, ''));
  }

  private normalizeLanguage(value: any, fallbackLanguage: string): string {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
    const fallback = typeof fallbackLanguage === 'string' ? fallbackLanguage.trim().toLowerCase() : 'en';
    const map: Record<string, string> = {
      en: 'en',
      eng: 'en',
      english: 'en',
      sn: 'sn',
      shona: 'sn',
      nd: 'nd',
      ndebele: 'nd',
      auto: 'en',
    };
    return map[raw] || map[fallback] || 'en';
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

  private normalizeSoapNote(value: any): TranscriptionResult['soap_note'] {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Invalid transcription response contract: soap_note must be an object');
    }

    const normalizeField = (field: string): string => {
      const raw = value?.[field];
      if (typeof raw === 'string' && raw.trim().length > 0) {
        return raw.trim();
      }
      return 'Not provided';
    };

    return {
      subjective: normalizeField('subjective'),
      objective: normalizeField('objective'),
      assessment: normalizeField('assessment'),
      plan: normalizeField('plan'),
      original_language_detected: this.normalizeLanguage(
        value?.original_language_detected,
        'en',
      ),
    };
  }

  private normalizeSegments(rawSegments: any): Array<{
    start: number;
    end: number;
    text: string;
    confidence?: number;
    speaker?: string;
    speakerRole?: 'doctor' | 'patient' | 'unknown';
    speakerLabel?: string;
    diarizationConfidence?: number;
  }> {
    if (!Array.isArray(rawSegments)) {
      return [];
    }
    const segments: Array<{
      start: number;
      end: number;
      text: string;
      confidence?: number;
      speaker?: string;
      speakerRole?: 'doctor' | 'patient' | 'unknown';
      speakerLabel?: string;
      diarizationConfidence?: number;
    }> = [];
    for (const seg of rawSegments) {
      const text = typeof seg?.text === 'string' ? seg.text.trim() : '';
      const start = Number(seg?.start);
      const end = Number(seg?.end);
      if (!text || !Number.isFinite(start) || !Number.isFinite(end)) {
        continue;
      }
      const confidence = Number(seg?.confidence);
      const speakerRaw = typeof seg?.speaker === 'string' ? seg.speaker.trim() : '';
      const speakerLabelRaw = typeof seg?.speaker_label === 'string' ? seg.speaker_label.trim() : '';
      const speakerRoleRaw = typeof seg?.speaker_role === 'string' ? seg.speaker_role.trim().toLowerCase() : '';
      segments.push({
        start,
        end,
        text,
        confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : undefined,
        speaker: speakerRaw || undefined,
        speakerLabel: speakerLabelRaw || undefined,
        speakerRole:
          speakerRoleRaw === 'doctor' || speakerRoleRaw === 'patient' || speakerRoleRaw === 'unknown'
            ? (speakerRoleRaw as 'doctor' | 'patient' | 'unknown')
            : undefined,
        diarizationConfidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : undefined,
      });
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
