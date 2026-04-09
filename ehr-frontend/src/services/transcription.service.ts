/**
 * Transcription Service for EHR Web Frontend
 * Handles speech-to-text conversion using Whisper API
 */

import { ehrAxios } from './api';

/**
 * Supported Whisper language codes — SADC-first, then broader Africa, then global.
 * 'auto' enables Whisper's built-in language detection.
 */
export type WhisperLanguageCode =
  // SADC tier-1
  | 'en' | 'af' | 'sw' | 'pt' | 'fr' | 'sn' | 'nd' | 'zu' | 'xh' | 'mg' | 'ny' | 'ln'
  // Broader Africa tier-2
  | 'am' | 'ha' | 'yo' | 'so' | 'rw' | 'lg' | 'om' | 'ti' | 'tn' | 'st' | 'ss' | 'ts' | 've' | 'nr'
  // Global tier-3
  | 'ar' | 'es' | 'hi' | 'zh' | 'ru' | 'de' | 'it' | 'ja' | 'ko' | 'nl'
  // Special
  | 'auto';

export interface TranscriptionOptions {
  language?: WhisperLanguageCode;
  temperature?: number;
  prompt?: string;
}

export interface TranscriptionResult {
  transcription: {
    text: string;
    language: string;
    language_probability: number;
    duration: number;
    segments?: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  };
  soap_note?: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  audio_url?: string;
}

class TranscriptionService {
  /**
   * Transcribe audio file using Whisper API
   */
  async transcribe(
    audioFile: File,
    options: TranscriptionOptions = {},
    token: string,
    tenantSlug: string,
  ): Promise<TranscriptionResult> {
    try {
      const {
        language = 'auto',
        temperature = 0.0,
        prompt = 'This is a medical consultation between a doctor and patient. Medical terminology, vitals, symptoms, and diagnoses should be transcribed accurately.',
      } = options;

      const formData = new FormData();
      formData.append('audio', audioFile);
      
      if (language !== 'auto') {
        formData.append('language', language);
      }
      formData.append('temperature', temperature.toString());
      formData.append('prompt', prompt);

      const response = await ehrAxios.post('/transcription/whisper', formData, {
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = response.data || {};
      if (data.transcription) {
        return data as TranscriptionResult;
      }

      return {
        transcription: {
          text: data.text || data.rawText || '',
          language: data.language || 'en',
          language_probability: typeof data.confidence === 'number' ? data.confidence : 0,
          duration: typeof data.duration === 'number' ? data.duration : 0,
          segments: data.segments || [],
        },
        soap_note: data.soap_note,
        audio_url: data.audio_url,
      };
    } catch (error: any) {
      console.error('Transcription error:', error);
      throw new Error(`Transcription failed: ${error.response?.data?.detail || error.message}`);
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

    return formatted;
  }
}

export default new TranscriptionService();
