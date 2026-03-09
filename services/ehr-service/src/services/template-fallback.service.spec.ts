import { TemplateFallbackService } from './template-fallback.service';

describe('TemplateFallbackService', () => {
  let service: TemplateFallbackService;

  beforeEach(() => {
    service = new TemplateFallbackService();
  });

  describe('generateClinicalNote', () => {
    it('should include all 4 SOAP sections when full data is provided', () => {
      const result = service.generateClinicalNote({
        patientName: 'John Doe',
        date: '2025-06-15',
        soap: {
          subjective: 'Patient reports headache for 3 days.',
          objective: 'BP 130/85, alert and oriented.',
          assessment: 'Tension headache, rule out migraine.',
          plan: 'Trial of acetaminophen, follow up in 2 weeks.',
        },
      });

      expect(result.noteText).toContain('SUBJECTIVE');
      expect(result.noteText).toContain('OBJECTIVE');
      expect(result.noteText).toContain('ASSESSMENT');
      expect(result.noteText).toContain('PLAN');
      expect(result.noteText).toContain('Patient reports headache');
      expect(result.noteText).toContain('BP 130/85');
      expect(result.noteText).toContain('Tension headache');
      expect(result.noteText).toContain('acetaminophen');
    });

    it('should show "Not documented." for empty SOAP fields', () => {
      const result = service.generateClinicalNote({});

      expect(result.noteText).toContain('SUBJECTIVE');
      expect(result.noteText).toContain('OBJECTIVE');
      expect(result.noteText).toContain('ASSESSMENT');
      expect(result.noteText).toContain('PLAN');

      const notDocumentedCount = (result.noteText.match(/Not documented\./g) || []).length;
      expect(notDocumentedCount).toBe(4);
    });

    it('should include diagnoses when provided', () => {
      const result = service.generateClinicalNote({
        diagnoses: ['Hypertension', 'Type 2 Diabetes'],
      });

      expect(result.noteText).toContain('Hypertension');
      expect(result.noteText).toContain('Type 2 Diabetes');
      expect(result.noteText).toContain('Diagnoses:');
    });

    it('should include patient name when provided', () => {
      const result = service.generateClinicalNote({
        patientName: 'Jane Smith',
      });

      expect(result.noteText).toContain('Jane Smith');
      expect(result.noteText).toContain('Patient: Jane Smith');
    });

    it('should always have source "template"', () => {
      const result = service.generateClinicalNote({});
      expect(result.source).toBe('template');
    });

    it('should include the provided date', () => {
      const result = service.generateClinicalNote({ date: '2025-03-09' });
      expect(result.noteText).toContain('Date: 2025-03-09');
    });

    it('should use current date when none provided', () => {
      const result = service.generateClinicalNote({});
      const today = new Date().toISOString().split('T')[0];
      expect(result.noteText).toContain(`Date: ${today}`);
    });

    it('should include visit summary if provided', () => {
      const result = service.generateClinicalNote({
        visitSummary: 'Routine follow-up, stable condition.',
      });

      expect(result.noteText).toContain('VISIT SUMMARY');
      expect(result.noteText).toContain('Routine follow-up');
    });

    it('should not include patient line when no name', () => {
      const result = service.generateClinicalNote({});
      expect(result.noteText).not.toContain('Patient:');
    });

    it('should not include diagnoses line when array is empty', () => {
      const result = service.generateClinicalNote({ diagnoses: [] });
      expect(result.noteText).not.toContain('Diagnoses:');
    });
  });

  describe('generateReferralLetter', () => {
    it('should contain recipient, patient name, reason, and sender when all provided', () => {
      const result = service.generateReferralLetter({
        patientName: 'John Doe',
        patientDob: '1985-05-20',
        recipientLabel: 'Dr. Cardiologist',
        referralReason: 'Persistent chest pain requiring evaluation',
        senderName: 'Dr. Primary',
        date: '2025-06-15',
      });

      expect(result.letterText).toContain('Dr. Cardiologist');
      expect(result.letterText).toContain('John Doe');
      expect(result.letterText).toContain('1985-05-20');
      expect(result.letterText).toContain('Persistent chest pain');
      expect(result.letterText).toContain('Dr. Primary');
      expect(result.letterText).toContain('Date: 2025-06-15');
    });

    it('should use "Specialist" default when no recipient provided', () => {
      const result = service.generateReferralLetter({
        patientName: 'Jane Smith',
      });

      expect(result.letterText).toContain('To: Specialist');
    });

    it('should use "Referring Physician" default when no sender provided', () => {
      const result = service.generateReferralLetter({
        patientName: 'Jane Smith',
      });

      expect(result.letterText).toContain('Referring Physician');
    });

    it('should always have source "template"', () => {
      const result = service.generateReferralLetter({ patientName: 'Test' });
      expect(result.source).toBe('template');
    });

    it('should include SOAP details when provided', () => {
      const result = service.generateReferralLetter({
        patientName: 'Test Patient',
        soap: {
          subjective: 'Reports chronic back pain.',
          objective: 'Limited range of motion.',
          assessment: 'Lumbar disc herniation.',
          plan: 'Refer to orthopedics.',
        },
      });

      expect(result.letterText).toContain('History: Reports chronic back pain.');
      expect(result.letterText).toContain('Examination findings: Limited range of motion.');
      expect(result.letterText).toContain('Clinical assessment: Lumbar disc herniation.');
      expect(result.letterText).toContain('Current plan: Refer to orthopedics.');
    });

    it('should produce valid letter with minimal fields', () => {
      const result = service.generateReferralLetter({
        patientName: 'Minimal Patient',
      });

      expect(result.letterText).toContain('Minimal Patient');
      expect(result.letterText).toContain('Dear Colleague');
      expect(result.letterText).toContain('Yours sincerely');
      expect(result.letterText).toContain('Specialist');
      expect(result.letterText).toContain('Referring Physician');
    });

    it('should include default reason text when no reason given', () => {
      const result = service.generateReferralLetter({ patientName: 'Test' });
      expect(result.letterText).toContain('Please see clinical details below.');
    });

    it('should not include DOB parenthetical when not provided', () => {
      const result = service.generateReferralLetter({ patientName: 'Test' });
      expect(result.letterText).not.toContain('DOB:');
    });
  });
});
