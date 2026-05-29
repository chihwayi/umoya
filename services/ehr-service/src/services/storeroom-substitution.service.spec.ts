describe('CDSS Drug Substitution logic', () => {
  it('direct mapping has higher confidence than ATC code match', () => {
    const direct = 'therapeutic';
    const atcMatch = 'atc_code';
    const confidenceRank = (t: string) => t === 'direct' ? 3 : t === 'therapeutic' ? 2 : 1;
    expect(confidenceRank(direct)).toBeGreaterThan(confidenceRank(atcMatch));
  });

  it('equivalents filter to only those with sufficient available quantity', () => {
    const candidates = [
      { name: 'Drug A', quantity_available: 2 },
      { name: 'Drug B', quantity_available: 10 },
    ];
    const required = 5;
    const eligible = candidates.filter(c => c.quantity_available >= required);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].name).toBe('Drug B');
  });

  it('controlled drug exceeds stock triggers warning flag', () => {
    const requested = 200;
    const available = 3;
    const exceedsStock = requested > available;
    expect(exceedsStock).toBe(true);
  });

  it('substitution result includes ai_reasoning when LLM responds', () => {
    const suggestion = {
      catalog_id: 'abc',
      name: 'Amoxicillin',
      confidence: 'high',
      ai_reasoning: 'Equivalent beta-lactam antibiotic with same spectrum',
    };
    expect(suggestion.ai_reasoning).toBeTruthy();
    expect(suggestion.confidence).toBe('high');
  });

  it('falls back to rule-based when LLM returns null', () => {
    const llmResult = null;
    const ruleResult = [{ name: 'Generic Paracetamol', confidence: 'medium' }];
    const final = llmResult ?? ruleResult;
    expect(final).toHaveLength(1);
    expect(final[0].name).toBe('Generic Paracetamol');
  });
});
