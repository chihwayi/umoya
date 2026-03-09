import { Injectable } from '@nestjs/common';

export interface TemplateNoteResult {
  noteText: string;
  source: 'template';
}

export interface TemplateLetterResult {
  letterText: string;
  source: 'template';
}

@Injectable()
export class TemplateFallbackService {
  generateClinicalNote(data: {
    patientName?: string;
    date?: string;
    soap?: {
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
    };
    visitSummary?: string;
    diagnoses?: string[];
  }): TemplateNoteResult {
    const lines = [
      'CLINICAL NOTE',
      `Date: ${data.date || new Date().toISOString().split('T')[0]}`,
      data.patientName ? `Patient: ${data.patientName}` : null,
      '',
      '--- SUBJECTIVE ---',
      data.soap?.subjective || 'Not documented.',
      '',
      '--- OBJECTIVE ---',
      data.soap?.objective || 'Not documented.',
      '',
      '--- ASSESSMENT ---',
      data.soap?.assessment || 'Not documented.',
      data.diagnoses?.length ? `Diagnoses: ${data.diagnoses.join('; ')}` : null,
      '',
      '--- PLAN ---',
      data.soap?.plan || 'Not documented.',
      '',
      data.visitSummary ? `--- VISIT SUMMARY ---\n${data.visitSummary}` : null,
    ]
      .filter((line) => line !== null)
      .join('\n');

    return { noteText: lines, source: 'template' };
  }

  generateReferralLetter(data: {
    patientName: string;
    patientDob?: string;
    recipientLabel?: string;
    referralReason?: string;
    soap?: {
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
    };
    senderName?: string;
    date?: string;
  }): TemplateLetterResult {
    const lines = [
      `Date: ${data.date || new Date().toISOString().split('T')[0]}`,
      '',
      `To: ${data.recipientLabel || 'Specialist'}`,
      '',
      `Re: Referral of ${data.patientName}${data.patientDob ? ` (DOB: ${data.patientDob})` : ''}`,
      '',
      'Dear Colleague,',
      '',
      'I am writing to refer the above patient for your evaluation and management.',
      '',
      `Reason for referral: ${data.referralReason || 'Please see clinical details below.'}`,
      '',
      data.soap?.subjective ? `History: ${data.soap.subjective}` : null,
      data.soap?.objective ? `Examination findings: ${data.soap.objective}` : null,
      data.soap?.assessment ? `Clinical assessment: ${data.soap.assessment}` : null,
      data.soap?.plan ? `Current plan: ${data.soap.plan}` : null,
      '',
      'Thank you for seeing this patient. Please do not hesitate to contact me for further information.',
      '',
      'Yours sincerely,',
      data.senderName || 'Referring Physician',
    ]
      .filter((line) => line !== null)
      .join('\n');

    return { letterText: lines, source: 'template' };
  }
}
