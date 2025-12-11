/**
 * Voice Recording Service
 * Handles audio recording for voice consultations
 */

import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { Platform, PermissionsAndroid } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

export interface RecordingOptions {
  sampleRate?: number; // Default: 16000 (Whisper standard)
  channels?: number; // Default: 1 (mono)
  bitRate?: number; // Default: 128000
  format?: 'mp3' | 'wav'; // Default: 'wav'
}

export interface RecordingResult {
  uri: string;
  duration: number; // in milliseconds
  fileSize: number; // in bytes
}

class VoiceRecordingService {
  private audioRecorderPlayer: AudioRecorderPlayer;
  private isRecording: boolean = false;
  private recordingPath: string | null = null;
  private startTime: number = 0;

  constructor() {
    this.audioRecorderPlayer = new AudioRecorderPlayer();
  }

  /**
   * Request microphone permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'Medicore needs access to your microphone to record consultations.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const result = await request(PERMISSIONS.IOS.MICROPHONE);
        return result === RESULTS.GRANTED;
      }
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return false;
    }
  }

  /**
   * Check if microphone permission is granted
   */
  async checkPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        return granted;
      } else {
        const result = await check(PERMISSIONS.IOS.MICROPHONE);
        return result === RESULTS.GRANTED;
      }
    } catch (error) {
      console.error('Error checking microphone permission:', error);
      return false;
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(options: RecordingOptions = {}): Promise<string> {
    try {
      // Check permissions first
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          throw new Error('Microphone permission denied');
        }
      }

      if (this.isRecording) {
        throw new Error('Recording already in progress');
      }

      const {
        sampleRate = 16000,
        channels = 1,
        bitRate = 128000,
        format = 'wav',
      } = options;

      const audioSet = {
        AudioEncoderAndroid: format === 'mp3' ? 3 : 0, // 0 = AAC, 3 = MP3
        AudioSourceAndroid: 1, // MIC
        AVModeIOSOption: 'measurement',
        AVEncoderAudioQualityKeyIOS: 'high',
        AVNumberOfChannelsKeyIOS: channels,
        AVFormatIDKeyIOS: format === 'mp3' ? 'mp3' : 'wav',
        OutputFormatAndroid: format === 'mp3' ? 3 : 0,
        SampleRateAndroid: sampleRate,
        ChannelsAndroid: channels,
        BitRateAndroid: bitRate,
      };

      const path = Platform.select({
        ios: `voice_consultation_${Date.now()}.${format}`,
        android: `sdcard/voice_consultation_${Date.now()}.${format}`,
      });

      const uri = await this.audioRecorderPlayer.startRecorder(path!, audioSet);
      
      this.recordingPath = uri;
      this.isRecording = true;
      this.startTime = Date.now();

      return uri;
    } catch (error: any) {
      console.error('Error starting recording:', error);
      throw new Error(`Failed to start recording: ${error.message}`);
    }
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<RecordingResult> {
    try {
      if (!this.isRecording) {
        throw new Error('No recording in progress');
      }

      const result = await this.audioRecorderPlayer.stopRecorder();
      this.audioRecorderPlayer.removeRecordBackListener();
      
      const duration = Date.now() - this.startTime;
      this.isRecording = false;

      // Get file size (would need to implement file system check)
      const fileSize = 0; // TODO: Implement file size check

      return {
        uri: result,
        duration,
        fileSize,
      };
    } catch (error: any) {
      console.error('Error stopping recording:', error);
      throw new Error(`Failed to stop recording: ${error.message}`);
    } finally {
      this.isRecording = false;
    }
  }

  /**
   * Pause recording
   */
  async pauseRecording(): Promise<void> {
    try {
      if (!this.isRecording) {
        throw new Error('No recording in progress');
      }
      await this.audioRecorderPlayer.pauseRecorder();
    } catch (error: any) {
      console.error('Error pausing recording:', error);
      throw new Error(`Failed to pause recording: ${error.message}`);
    }
  }

  /**
   * Resume recording
   */
  async resumeRecording(): Promise<void> {
    try {
      if (!this.isRecording) {
        throw new Error('No recording in progress');
      }
      await this.audioRecorderPlayer.resumeRecorder();
    } catch (error: any) {
      console.error('Error resuming recording:', error);
      throw new Error(`Failed to resume recording: ${error.message}`);
    }
  }

  /**
   * Get current recording status
   */
  getRecordingStatus(): {
    isRecording: boolean;
    duration: number;
    path: string | null;
  } {
    return {
      isRecording: this.isRecording,
      duration: this.isRecording ? Date.now() - this.startTime : 0,
      path: this.recordingPath,
    };
  }

  /**
   * Cancel current recording
   */
  async cancelRecording(): Promise<void> {
    try {
      if (this.isRecording) {
        await this.stopRecording();
        // Delete the recording file
        // TODO: Implement file deletion
      }
      this.recordingPath = null;
      this.isRecording = false;
    } catch (error) {
      console.error('Error canceling recording:', error);
    }
  }
}

export default new VoiceRecordingService();
