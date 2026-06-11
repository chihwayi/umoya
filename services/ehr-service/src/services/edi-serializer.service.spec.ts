import { EdiSerializerService } from './edi-serializer.service';

describe('EdiSerializerService (S224 switch wire-format)', () => {
  const service = new EdiSerializerService();

  const makeDs = (claim: any, lines: any[] = []) =>
    ({
      query: jest.fn(async (sql: string) => {
        if (/FROM medical_aid_claims/.test(sql)) return claim ? [claim] : [];
        if (/FROM medical_aid_claim_lines/.test(sql)) return lines;
        return [];
      }),
    }) as any;

  const baseClaim = {
    id: 'claim-uuid-1',
    claim_number: 'CLM00000042',
    claim_amount: '125.50',
    medical_aid_name: 'cimas',
    member_number: 'MBR-778899',
    dependant_code: '01',
    plan_name: 'Gold',
    primary_diagnosis_code: 'K02.1',
    diagnosis_codes: ['K02.1', 'K04.0'],
    first_name: 'Kaylee',
    last_name: 'Dube',
    date_of_birth: '1990-05-12',
    gender: 'female',
    patient_number: 'DUM779410549',
    submission_date: null,
  };

  it('generates a structurally complete 837P with envelopes, member, dependant, diagnoses, and tariff lines', async () => {
    const ds = makeDs(baseClaim, [
      { tariff_code: '8301', description: 'Amalgam filling', quantity: 1, unit_amount: '45.00', line_amount: '45.00', icd10_code: 'K02.1' },
      { tariff_code: '8501', description: 'Dental x-ray', quantity: 2, unit_amount: '20.00', line_amount: '40.00', icd10_code: null },
    ]);

    const result = await service.generate837PForClaim(ds, 'claim-uuid-1');

    expect(result.filename).toBe('claim-CLM00000042-837p.edi');
    const segments = result.content.split('~').map((s) => s.trim()).filter(Boolean);

    // Envelopes open and close consistently
    expect(segments[0]).toMatch(/^ISA\*00\*/);
    expect(segments[1]).toMatch(/^GS\*HC\*/);
    expect(segments[2]).toBe('ST*837*0001*005010X222A1');
    expect(segments[segments.length - 1]).toMatch(/^IEA\*1\*/);
    expect(segments[segments.length - 2]).toMatch(/^GE\*1\*/);

    // SE count matches ST..SE inclusive
    const stIndex = segments.findIndex((s) => s.startsWith('ST*'));
    const seIndex = segments.findIndex((s) => s.startsWith('SE*'));
    const declaredCount = Number(segments[seIndex].split('*')[1]);
    expect(declaredCount).toBe(seIndex - stIndex + 1);

    // Member + dependant identifiers
    expect(result.content).toContain('NM1*IL*1*Dube*Kaylee****MI*MBR-778899');
    expect(result.content).toContain('REF*1W*01'); // dependant code
    expect(result.content).toContain('SBR*P**Gold');
    expect(result.content).toContain('DMG*D8*19900512*F');

    // Claim + diagnoses (dots stripped, primary ABK then ABF)
    expect(result.content).toContain('CLM*CLM00000042*125.50');
    expect(result.content).toContain('HI*ABK:K021*ABF:K040');

    // Tariff service lines with quantities
    expect(result.content).toContain('LX*1');
    expect(result.content).toContain('SV1*HC:8301*45.00*UN*1');
    expect(result.content).toContain('SV1*HC:8501*40.00*UN*2');
  });

  it('falls back to a single summary service line when the claim has no itemised lines', async () => {
    const ds = makeDs({ ...baseClaim, dependant_code: '00' }, []);
    const result = await service.generate837PForClaim(ds, 'claim-uuid-1');

    expect(result.content).toContain('LX*1');
    expect(result.content).toContain('SV1*HC:0001*125.50*UN*1');
    // dependant code 00 = the member themselves — no dependant loop
    expect(result.content).not.toContain('REF*1W*');
  });

  it('detects X12 interchanges vs CSV', () => {
    expect(service.isX12('ISA*00*...')).toBe(true);
    expect(service.isX12('claim_number,paid_amount\nCLM1,10')).toBe(false);
  });

  it('parses an 835 remittance into reconciliation lines for importRemittance', () => {
    const edi835 = [
      'ISA*00*          *00*          *ZZ*CIMAS          *ZZ*UMOYA          *260611*1200*^*00501*000000905*0*P*:',
      'GS*HP*CIMAS*UMOYA*20260611*1200*905*X*005010X221A1',
      'ST*835*0001',
      'TRN*1*REMIT-2026-0042*1CIMAS',
      'CLP*CLM00000042*1*125.50*125.50*0*MC*ICN-1',
      'CLP*CLM00000043*1*80.00*60.00*20*MC*ICN-2',
      'CAS*CO*45*20.00',
      'CLP*CLM00000044*4*50.00*0*50*MC*ICN-3',
      'CAS*PR*96*50.00',
      'SE*9*0001',
      'GE*1*905',
      'IEA*1*000000905',
    ].join('~\n') + '~';

    const parsed = service.parse835(edi835);

    expect(parsed.remittanceReference).toBe('REMIT-2026-0042');
    expect(parsed.lines).toHaveLength(3);
    expect(parsed.lines[0]).toMatchObject({ claimNumber: 'CLM00000042', claimedAmount: 125.5, paidAmount: 125.5 });
    expect(parsed.lines[1]).toMatchObject({
      claimNumber: 'CLM00000043',
      claimedAmount: 80,
      paidAmount: 60,
      reason: expect.stringContaining('CO-45'),
    });
    // CLP02=4 → denied
    expect(parsed.lines[2]).toMatchObject({ claimNumber: 'CLM00000044', paidAmount: 0, status: 'rejected' });
  });
});
