/**
 * Transcription Service for EHR Web Frontend
 * Handles speech-to-text conversion using Whisper API
 */

import { ehrAxios } from './api';

export interface TranscriptionOptions {
  language?: 'en' | 'sn' | 'nd' | 'auto';
  temperature?: number;
  prompt?: string;
}

export interface TranscriptionResult {
  text: string;
  rawText: string;
  language: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  confidence?: number;
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
      
      if (temperature !== undefined) {
        formData.append('temperature', temperature.toString());
      }
      
      if (prompt) {
        formData.append('prompt', prompt);
      }

      const response = await ehrAxios.post('/transcription/whisper', formData, {
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Transcription error:', error);
      throw new Error(`Transcription failed: ${error.response?.data?.message || error.message}`);
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
