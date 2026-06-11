import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * S224 — Switch wire-format adapter: X12 EDI serialization for medical-aid
 * switches that don't speak JSON/FHIR.
 *
 * - generate837PForClaim: renders a claim (with its S216 itemised tariff lines,
 *   member/dependant/plan identifiers) as an X12 837P professional-claim
 *   interchange, downloadable for upload to a switch portal.
 * - parse835: parses an X12 835 remittance advice into reconciliation lines for
 *   the S217 importRemittance pipeline.
 *
 * Segment terminator `~`, element separator `*`, component separator `:`.
 * Per-switch XML dialects/transport remain spec-blocked (see roadmap S224).
 */
@Injectable()
export class EdiSerializerService {
  private pad(value: string | number, length: number): string {
    return String(value ?? '').padEnd(length, ' ').slice(0, length);
  }

  private controlNumber(): string {
    return String(Date.now()).slice(-9);
  }

  private formatDate(date: Date, long = false): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return long ? `${y}${m}${d}` : `${String(y).slice(2)}${m}${d}`;
  }

  private formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
  }

  /** Strip characters that would corrupt X12 framing. */
  private clean(value: any): string {
    return String(value ?? '').replace(/[*~:]/g, ' ').trim();
  }

  async generate837PForClaim(
    tenantDb: DataSource,
    claimId: string,
  ): Promise<{ filename: string; content: string; claimNumber: string }> {
    const [claim] = await tenantDb.query(
      `SELECT c.*, p.first_name, p.last_name, p.date_of_birth, p.gender, p.patient_number
       FROM medical_aid_claims c
       LEFT JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1`,
      [claimId],
    );
    if (!claim) throw new NotFoundException(`Claim ${claimId} not found`);

    const lines = await tenantDb.query(
      `SELECT tariff_code, description, quantity, unit_amount, line_amount, icd10_code
       FROM medical_aid_claim_lines WHERE claim_id = $1 ORDER BY created_at ASC`,
      [claimId],
    );

    const now = new Date();
    const ctrl = this.controlNumber();
    const senderId = this.clean(process.env.EDI_SENDER_ID || 'UMOYA');
    const receiverId = this.clean(claim.medical_aid_name || 'PAYER').toUpperCase();
    const clinicName = this.clean(process.env.CLINIC_NAME || 'Umoya Health');
    const clinicNpi = this.clean(process.env.CLINIC_REGISTRATION_NO || '0000000000');

    const segments: string[] = [];
    segments.push(
      `ISA*00*${this.pad('', 10)}*00*${this.pad('', 10)}*ZZ*${this.pad(senderId, 15)}*ZZ*${this.pad(receiverId, 15)}*${this.formatDate(now)}*${this.formatTime(now)}*^*00501*${ctrl}*0*P*:`,
    );
    segments.push(`GS*HC*${senderId}*${receiverId}*${this.formatDate(now, true)}*${this.formatTime(now)}*${ctrl}*X*005010X222A1`);
    segments.push(`ST*837*0001*005010X222A1`);
    segments.push(`BHT*0019*00*${this.clean(claim.claim_number)}*${this.formatDate(now, true)}*${this.formatTime(now)}*CH`);

    // 1000A submitter / 1000B receiver
    segments.push(`NM1*41*2*${clinicName}*****46*${senderId}`);
    segments.push(`NM1*40*2*${receiverId}*****46*${receiverId}`);

    // 2000A billing provider
    segments.push(`HL*1**20*1`);
    segments.push(`NM1*85*2*${clinicName}*****XX*${clinicNpi}`);

    // 2000B subscriber (member). Dependant code is carried in SBR/PAT semantics:
    // when a dependant code is present the patient is a dependant of the member.
    const isDependant = Boolean(claim.dependant_code && String(claim.dependant_code).trim() !== '' && String(claim.dependant_code).trim() !== '00');
    segments.push(`HL*2*1*22*${isDependant ? '1' : '0'}`);
    segments.push(`SBR*P*${isDependant ? '' : '18'}*${this.clean(claim.plan_name)}******CI`);
    segments.push(`NM1*IL*1*${this.clean(claim.last_name)}*${this.clean(claim.first_name)}****MI*${this.clean(claim.member_number)}`);
    if (claim.date_of_birth) {
      const dob = new Date(claim.date_of_birth);
      const genderCode = String(claim.gender || '').toLowerCase().startsWith('m') ? 'M' : String(claim.gender || '').toLowerCase().startsWith('f') ? 'F' : 'U';
      segments.push(`DMG*D8*${this.formatDate(dob, true)}*${genderCode}`);
    }
    if (isDependant) {
      segments.push(`HL*3*2*23*0`);
      segments.push(`PAT*19`);
      segments.push(`NM1*QC*1*${this.clean(claim.last_name)}*${this.clean(claim.first_name)}`);
      segments.push(`REF*1W*${this.clean(claim.dependant_code)}`);
    }

    // 2300 claim
    const claimAmount = Number(claim.claim_amount || 0).toFixed(2);
    segments.push(`CLM*${this.clean(claim.claim_number)}*${claimAmount}***11:B:1*Y*A*Y*Y`);

    const diagnosisCodes: string[] = [
      ...(claim.primary_diagnosis_code ? [claim.primary_diagnosis_code] : []),
      ...((Array.isArray(claim.diagnosis_codes) ? claim.diagnosis_codes : []) as string[]),
      ...lines.map((l: any) => l.icd10_code).filter(Boolean),
    ]
      .map((code) => this.clean(code))
      .filter((code, index, all) => code && all.indexOf(code) === index)
      .slice(0, 12);
    if (diagnosisCodes.length > 0) {
      segments.push(
        `HI*${diagnosisCodes.map((code, i) => `${i === 0 ? 'ABK' : 'ABF'}:${code.replace(/\./g, '')}`).join('*')}`,
      );
    }

    // 2400 service lines (S216 itemised tariff lines; single summary line fallback)
    const serviceLines = lines.length > 0
      ? lines
      : [{ tariff_code: '0001', description: 'Consultation', quantity: 1, line_amount: claim.claim_amount, unit_amount: claim.claim_amount }];
    const serviceDate = this.formatDate(claim.submission_date ? new Date(claim.submission_date) : now, true);
    serviceLines.forEach((line: any, index: number) => {
      segments.push(`LX*${index + 1}`);
      segments.push(
        `SV1*HC:${this.clean(line.tariff_code || '0000')}*${Number(line.line_amount || 0).toFixed(2)}*UN*${Number(line.quantity || 1)}***1`,
      );
      segments.push(`DTP*472*D8*${serviceDate}`);
    });

    // Trailers (SE counts ST..SE inclusive)
    const stIndex = segments.findIndex((segment) => segment.startsWith('ST*'));
    const segmentCount = segments.length - stIndex + 1;
    segments.push(`SE*${segmentCount}*0001`);
    segments.push(`GE*1*${ctrl}`);
    segments.push(`IEA*1*${ctrl}`);

    return {
      filename: `claim-${this.clean(claim.claim_number)}-837p.edi`,
      content: segments.join('~\n') + '~',
      claimNumber: claim.claim_number,
    };
  }

  /** Is this content an X12 interchange (vs CSV/JSON)? */
  isX12(content: string): boolean {
    return String(content || '').trimStart().startsWith('ISA*');
  }

  /**
   * Parse an X12 835 remittance advice into S217 reconciliation lines.
   * CLP: CLP01 claim no, CLP02 status (1/2/3 paid, 4 denied, 22 reversal),
   * CLP03 charged, CLP04 paid. CAS adjustment reasons become the line reason.
   */
  parse835(content: string): {
    remittanceReference: string | null;
    lines: Array<{ claimNumber: string; claimedAmount: number; paidAmount: number; status?: string; reason?: string }>;
  } {
    const segments = String(content || '')
      .split('~')
      .map((segment) => segment.trim().replace(/^\n+/, ''))
      .filter(Boolean);

    let remittanceReference: string | null = null;
    const lines: Array<{ claimNumber: string; claimedAmount: number; paidAmount: number; status?: string; reason?: string }> = [];
    let current: any = null;

    for (const segment of segments) {
      const parts = segment.split('*');
      const tag = parts[0];

      if (tag === 'TRN' && parts[2]) {
        remittanceReference = parts[2];
      }
      if (tag === 'CLP') {
        if (current) lines.push(current);
        const statusCode = parts[2];
        const denied = statusCode === '4';
        current = {
          claimNumber: parts[1],
          claimedAmount: Number(parts[3]) || 0,
          paidAmount: Number(parts[4]) || 0,
          status: denied ? 'rejected' : undefined,
          reason: undefined,
        };
      }
      if (tag === 'CAS' && current && parts[1] && parts[2]) {
        const reason = `Adjustment ${parts[1]}-${parts[2]}${parts[3] ? ` (${parts[3]})` : ''}`;
        current.reason = current.reason ? `${current.reason}; ${reason}` : reason;
      }
    }
    if (current) lines.push(current);

    return { remittanceReference, lines };
  }
}
