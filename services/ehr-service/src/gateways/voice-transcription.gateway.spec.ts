import { VoiceTranscriptionGateway } from './voice-transcription.gateway';

describe('VoiceTranscriptionGateway', () => {
  let gateway: VoiceTranscriptionGateway;

  beforeEach(() => {
    gateway = new VoiceTranscriptionGateway();
  });

  describe('parseVoiceCommand', () => {
    it('should parse prescribe command with medication, dose, and frequency', () => {
      const result = gateway.parseVoiceCommand(
        'prescribe amoxicillin 500mg three times daily',
      );

      expect(result).not.toBeNull();
      expect(result!.type).toBe('prescribe');
      expect(result!.data.medication).toBe('amoxicillin');
      expect(result!.data.dose).toBe('500mg');
      expect(result!.data.frequency).toContain('three times daily');
    });

    it('should parse order lab command', () => {
      const result = gateway.parseVoiceCommand('order CBC');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('order_lab');
      expect(result!.data.test).toBe('cbc');
    });

    it('should parse blood pressure vitals command', () => {
      const result = gateway.parseVoiceCommand(
        'vitals blood pressure 120 over 80',
      );

      expect(result).not.toBeNull();
      expect(result!.type).toBe('record_vitals');
      expect(result!.data.systolic).toBe(120);
      expect(result!.data.diastolic).toBe(80);
    });

    it('should parse temperature vitals command', () => {
      const result = gateway.parseVoiceCommand('vitals temperature 38.5');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('record_vitals');
      expect(result!.data.type).toBe('temperature');
      expect(result!.data.value).toBe(38.5);
    });

    it('should parse note command', () => {
      const result = gateway.parseVoiceCommand(
        'note patient reports improvement',
      );

      expect(result).not.toBeNull();
      expect(result!.type).toBe('add_note');
      expect(result!.data.text).toContain('patient reports improvement');
    });

    it('should parse diagnosis command', () => {
      const result = gateway.parseVoiceCommand('diagnosis hypertension');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('add_diagnosis');
      expect(result!.data.condition).toBe('hypertension');
    });

    it('should return null for unrecognized speech', () => {
      const result = gateway.parseVoiceCommand('hello doctor');
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = gateway.parseVoiceCommand('');
      expect(result).toBeNull();
    });

    it('should be case-insensitive', () => {
      const result = gateway.parseVoiceCommand('ORDER CBC');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('order_lab');
    });

    it('should parse BP with slash separator', () => {
      const result = gateway.parseVoiceCommand(
        'vitals blood pressure 130/90',
      );

      expect(result).not.toBeNull();
      expect(result!.type).toBe('record_vitals');
      expect(result!.data.systolic).toBe(130);
      expect(result!.data.diastolic).toBe(90);
    });

    it('should parse prescribe with ml units', () => {
      const result = gateway.parseVoiceCommand(
        'prescribe ibuprofen 200ml twice daily',
      );

      expect(result).not.toBeNull();
      expect(result!.type).toBe('prescribe');
      expect(result!.data.medication).toBe('ibuprofen');
      expect(result!.data.dose).toBe('200ml');
    });

    it('should parse "diagnose" variant', () => {
      const result = gateway.parseVoiceCommand('diagnose diabetes mellitus');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('add_diagnosis');
      expect(result!.data.condition).toBe('diabetes mellitus');
    });

    it('should parse order with multi-word test name', () => {
      const result = gateway.parseVoiceCommand(
        'order comprehensive metabolic panel',
      );

      expect(result).not.toBeNull();
      expect(result!.type).toBe('order_lab');
      expect(result!.data.test).toBe('comprehensive metabolic panel');
    });

    it('should parse integer temperature', () => {
      const result = gateway.parseVoiceCommand('vitals temperature 37');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('record_vitals');
      expect(result!.data.value).toBe(37);
    });

    it('should return null for whitespace-only input', () => {
      expect(gateway.parseVoiceCommand('   ')).toBeNull();
    });

    it('should handle "record" prefix for blood pressure', () => {
      const result = gateway.parseVoiceCommand(
        'record blood pressure 115 over 75',
      );

      expect(result).not.toBeNull();
      expect(result!.type).toBe('record_vitals');
      expect(result!.data.systolic).toBe(115);
      expect(result!.data.diastolic).toBe(75);
    });
  });
});
