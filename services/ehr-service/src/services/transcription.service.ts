/**
 * Transcription Service
 * Handles speech-to-text conversion using Whisper API
 */

import { Injectable, Logger } from '@nestjs/common';
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
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly WHISPER_API_URL = process.env.WHISPER_API_URL || 'https://api.openai.com/v1/audio/transcriptions';
  private readonly WHISPER_API_KEY = process.env.OPENAI_API_KEY || process.env.WHISPER_API_KEY;
  private readonly USE_LOCAL_WHISPER = process.env.USE_LOCAL_WHISPER === 'true';
  private readonly LOCAL_WHISPER_URL = process.env.LOCAL_WHISPER_URL || 'http://localhost:8000/transcribe';

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
   * Transcribe using self-hosted Whisper instance
   * Useful for privacy-sensitive deployments or cost savings
   */
  private async transcribeWithLocalWhisper(
    audioFile: Express.Multer.File,
    options: TranscriptionOptions,
  ): Promise<TranscriptionResult> {
    try {
      const formData = new FormData();
      formData.append('audio', audioFile.buffer, {
        filename: audioFile.originalname || 'recording.wav',
        contentType: audioFile.mimetype || 'audio/wav',
      });

      // Different local Whisper APIs use different parameter names
      // Try 'audio' first (our custom server), then 'audio_file' (common format)
      if (this.LOCAL_WHISPER_URL.includes('/transcribe')) {
        // Our custom FastAPI server format
        formData.append('audio', audioFile.buffer, {
          filename: audioFile.originalname || 'recording.wav',
          contentType: audioFile.mimetype || 'audio/wav',
        });
      } else {
        // Generic format (whisper-asr-webservice, etc.)
        formData.append('audio_file', audioFile.buffer, {
          filename: audioFile.originalname || 'recording.wav',
          contentType: audioFile.mimetype || 'audio/wav',
        });
      }

      if (options.language && options.language !== 'auto') {
        formData.append('language', options.language);
      }

      if (options.temperature !== undefined) {
        formData.append('temperature', options.temperature.toString());
      }

      if (options.prompt) {
        formData.append('prompt', options.prompt);
      }

      const response = await axios.post(this.LOCAL_WHISPER_URL, formData, {
        headers: formData.getHeaders(),
        timeout: 120000, // 2 minute timeout for local processing
      });

      // Handle different response formats from different Whisper API implementations
      const responseData = response.data;
      
      // Format 1: Our custom server (returns text, language, segments)
      if (responseData.text) {
        return {
          text: responseData.text || '',
          language: responseData.language || options.language || 'en',
          segments: responseData.segments || [],
          confidence: responseData.confidence,
        };
      }
      
      // Format 2: whisper-asr-webservice (returns text directly or in data field)
      if (responseData.data && responseData.data.text) {
        return {
          text: responseData.data.text || '',
          language: responseData.data.language || options.language || 'en',
          segments: responseData.data.segments || [],
        };
      }
      
      // Format 3: Direct text response
      if (typeof responseData === 'string') {
        return {
          text: responseData,
          language: options.language || 'en',
        };
      }

      // Fallback
      return {
        text: JSON.stringify(responseData),
        language: options.language || 'en',
      };
    } catch (error: any) {
      this.logger.error(`Local Whisper error: ${error.message}`, error.response?.data);
      throw new Error(`Local Whisper error: ${error.message}`);
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
