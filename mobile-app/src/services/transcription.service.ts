/**
 * Transcription Service
 * Handles speech-to-text conversion using Whisper or Vosk
 */

import { ehrApi } from '../config/api';
import { API_ENDPOINTS } from '../config/api';

export interface TranscriptionOptions {
  language?: 'en' | 'sn' | 'nd' | 'auto'; // English, Shona, Ndebele, Auto-detect
  model?: 'whisper' | 'vosk'; // Transcription model to use
  temperature?: number; // 0.0 to 1.0, lower = more deterministic
  prompt?: string; // Context prompt for better accuracy
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

class TranscriptionService {
  private readonly WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
  private readonly WHISPER_MODEL = 'whisper-1'; // Use Whisper API

  /**
   * Transcribe audio file using Whisper API
   * Note: For production, you may want to run Whisper locally or use a self-hosted instance
   */
  async transcribeWithWhisper(
    audioUri: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    try {
      const {
        language = 'auto',
        temperature = 0.0,
        prompt = 'This is a medical consultation between a doctor and patient. Medical terminology, vitals, symptoms, and diagnoses should be transcribed accurately.',
      } = options;

      // For now, we'll use a backend endpoint that handles Whisper
      // This keeps API keys secure on the backend
      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/wav',
        name: 'recording.wav',
      } as any);
      formData.append('language', language === 'auto' ? '' : language);
      formData.append('temperature', temperature.toString());
      formData.append('prompt', prompt);

      // Use backend endpoint for transcription
      const response = await ehrApi.post(API_ENDPOINTS.TRANSCRIPTION.WHISPER, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return {
        text: response.data.text || '',
        language: response.data.language || language,
        segments: response.data.segments,
        confidence: response.data.confidence,
      };
    } catch (error: any) {
      console.error('Error transcribing with Whisper:', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  /**
   * Transcribe audio using Vosk (offline, fallback)
   * Note: Requires Vosk model files to be bundled with app
   */
  async transcribeWithVosk(
    audioUri: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    try {
      // Vosk implementation would go here
      // This requires native module integration
      // For now, fallback to backend endpoint
      
      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/wav',
        name: 'recording.wav',
      } as any);
      formData.append('language', options.language || 'en');

      // TODO: Create backend endpoint /api/transcription/vosk
      const response = await ehrApi.post('/api/transcription/vosk', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return {
        text: response.data.text || '',
        language: response.data.language || options.language || 'en',
        segments: response.data.segments,
        confidence: response.data.confidence,
      };
    } catch (error: any) {
      console.error('Error transcribing with Vosk:', error);
      throw new Error(`Vosk transcription failed: ${error.message}`);
    }
  }

  /**
   * Main transcription method - tries Whisper first, falls back to Vosk
   */
  async transcribe(
    audioUri: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    const { model = 'whisper' } = options;

    try {
      if (model === 'whisper') {
        return await this.transcribeWithWhisper(audioUri, options);
      } else {
        return await this.transcribeWithVosk(audioUri, options);
      }
    } catch (error) {
      // Fallback to Vosk if Whisper fails
      if (model === 'whisper') {
        console.warn('Whisper failed, falling back to Vosk');
        return await this.transcribeWithVosk(audioUri, options);
      }
      throw error;
    }
  }

  /**
   * Format transcription for medical context
   */
  formatTranscription(text: string): string {
    // Basic formatting:
    // - Capitalize sentences
    // - Fix common medical abbreviations
    // - Add punctuation where needed
    
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
