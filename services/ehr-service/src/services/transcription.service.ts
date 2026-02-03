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

export interface TranscriptionOptions {
  language?: 'en' | 'sn' | 'nd' | 'auto';
  temperature?: number;
  prompt?: string;
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
  private readonly WHISPER_API_URL = process.env.WHISPER_API_URL || 'https://api.openai.com/v1/audio/transcriptions';
  private readonly WHISPER_API_KEY = process.env.OPENAI_API_KEY || process.env.WHISPER_API_KEY;
  // Default to true for CDSS service integration
  private readonly USE_LOCAL_WHISPER = process.env.USE_LOCAL_WHISPER !== 'false'; 
  private readonly LOCAL_WHISPER_URL = process.env.LOCAL_WHISPER_URL;

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
  ): Promise<TranscriptionResult> {
    try {
      const {
        language = 'auto',
        temperature = 0.0,
        prompt = 'This is a medical consultation between a doctor and patient. Medical terminology, vitals, symptoms, and diagnoses should be transcribed accurately.',
      } = options;

      // Use local Whisper if configured, otherwise use OpenAI API
      if (this.USE_LOCAL_WHISPER) {
        return await this.transcribeWithLocalWhisper(audioFile, { language, temperature, prompt });
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

      const response = await axios.post(this.LOCAL_WHISPER_URL, formData, {
        headers: formData.getHeaders(),
        timeout: 300000, // 5 minute timeout for local processing
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const responseData = response.data;
      
      // Handle CDSS Service response format
      // { "transcription": { "text": "...", "language": "...", "segments": [...] }, "soap_note": "...", "audio_url": "..." }
      if (responseData.transcription) {
        return {
          text: responseData.transcription.text || '',
          language: responseData.transcription.language || options.language || 'en',
          segments: responseData.transcription.segments || [],
          soap_note: responseData.soap_note,
          audio_url: responseData.audio_url
        };
      }
      
      // Fallback for other formats (legacy/generic)
      if (responseData.text) {
        return {
          text: responseData.text || '',
          language: responseData.language || options.language || 'en',
          segments: responseData.segments || [],
          confidence: responseData.confidence,
        };
      }
      
      // Format 2: whisper-asr-webservice
      if (responseData.data && responseData.data.text) {
        return {
          text: responseData.data.text || '',
          language: responseData.data.language || options.language || 'en',
          segments: responseData.data.segments || [],
        };
      }
      
      throw new Error('Unknown response format from local Whisper service');
    } catch (error: any) {
      this.logger.error(`Local Whisper API error: ${error.message}`, error.response?.data);
      throw new Error(`Local Whisper API error: ${error.message}`);
    }
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
