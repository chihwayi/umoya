import { ProInterpretationService } from './pro-interpretation.service';

describe('ProInterpretationService', () => {
  const svc = new ProInterpretationService();

  describe('PHQ-9', () => {
    it('score 0 → minimal', () => {
      const r = svc.interpret('PHQ-9', 0);
      expect(r.severity).toBe('minimal');
      expect(r.colorHex).toBe('#22c55e');
    });
    it('score 10 → moderate', () => {
      expect(svc.interpret('PHQ-9', 10).severity).toBe('moderate');
    });
    it('score 20 → severe', () => {
      expect(svc.interpret('PHQ-9', 20).severity).toBe('severe');
    });
    it('contains patientMessage and clinicianSummary', () => {
      const r = svc.interpret('PHQ-9', 14);
      expect(r.patientMessage.length).toBeGreaterThan(10);
      expect(r.clinicianSummary.length).toBeGreaterThan(10);
    });
  });

  describe('GAD-7', () => {
    it('score 15 → severe', () => {
      expect(svc.interpret('GAD-7', 15).severity).toBe('severe');
    });
    it('score 5 → mild', () => {
      expect(svc.interpret('GAD-7', 5).severity).toBe('mild');
    });
  });

  describe('AUDIT', () => {
    it('score 0 → minimal (low risk)', () => {
      expect(svc.interpret('AUDIT', 0).severity).toBe('minimal');
    });
    it('score 20 → severe (possible dependence)', () => {
      expect(svc.interpret('AUDIT', 20).severity).toBe('severe');
    });
  });

  describe('WHO-5', () => {
    it('score 80 → minimal (good wellbeing)', () => {
      expect(svc.interpret('WHO-5', 80).severity).toBe('minimal');
    });
    it('score 20 → severe (poor wellbeing)', () => {
      expect(svc.interpret('WHO-5', 20).severity).toBe('severe');
    });
  });

  describe('unknown questionnaire', () => {
    it('returns fallback with minimal severity', () => {
      const r = svc.interpret('UNKNOWN-SCALE', 42);
      expect(r.severity).toBe('minimal');
      expect(r.label).toBe('Score recorded');
    });
  });

  describe('case insensitivity', () => {
    it('phq-9 lowercase resolves to PHQ-9 ranges', () => {
      expect(svc.interpret('phq-9', 10).severity).toBe('moderate');
    });
  });

  it('all 12 scales have at least one range', () => {
    const codes = ['PHQ-9', 'PHQ-2', 'GAD-7', 'WHO-5', 'AUDIT', 'FACT-G', 'ESAS', 'PSS', 'KCCQ-12', 'MFIS-5', 'DES-II', 'CORE-10'];
    for (const code of codes) {
      const r = svc.interpret(code, 10);
      expect(r.label).not.toBe('Score recorded');
    }
  });
});
