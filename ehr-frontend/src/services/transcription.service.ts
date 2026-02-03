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
  transcription: {
    text: string;
    language: string;
    language_probability: number;
    duration: number;
  };
  soap_note?: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
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
      formData.append('file', audioFile); // Changed 'audio' to 'file' to match backend
      formData.append('generate_soap', 'true'); // Request SOAP note generation
      
      if (language !== 'auto') {
        formData.append('language', language);
      }
      
      // Note: Backend currently might not support temperature/prompt in the simple /transcribe endpoint
      // but we keep them for future extensibility or if we update backend to accept them.

      const response = await ehrAxios.post('/transcribe', formData, { // Changed endpoint to /transcribe
        headers: {
          'X-Tenant-ID': tenantSlug,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
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
