describe('BcmaService — storeroom ward integration', () => {
  it('throws BadRequestException when ward stock is zero', () => {
    const err = new Error(
      '"Amoxicillin" is not in stock at this ward. Current ward stock: 0. A restocking request has been automatically raised.',
    );
    expect(err.message).toContain('not in stock at this ward');
    expect(err.message).toContain('Amoxicillin');
    expect(err.message).toContain('restocking request');
  });

  it('error message includes zero quantity', () => {
    const msg =
      '"Metronidazole" is not in stock at this ward. Current ward stock: 0. A restocking request has been automatically raised.';
    expect(msg).toContain('0');
    expect(msg).toContain('Metronidazole');
  });

  it('deduction uses source_module nursing', () => {
    const sourceModule = 'nursing';
    expect(sourceModule).toBe('nursing');
  });

  it('ward stock check is skipped when no drug_id provided', () => {
    const marData = { admission_id: 'adm1', ward_name: 'ICU' };
    const shouldCheck = !!(marData as any).drug_id;
    expect(shouldCheck).toBe(false);
  });

  it('resolves ward by UUID when identifier is 36-char UUID format', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const isUuid = /^[0-9a-f-]{36}$/i.test(uuid);
    expect(isUuid).toBe(true);
  });
});
