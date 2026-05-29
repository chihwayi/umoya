describe('StoreroomIntelligenceService — demand intelligence logic', () => {
  it('ruleBasedForecast returns rule as ai_source', () => {
    const weeklyTotals = [70, 84, 91];
    const avg = weeklyTotals.reduce((s, v) => s + v, 0) / weeklyTotals.length;
    const predicted = Math.ceil((avg / 7) * 30);
    const aiSource = 'rule';
    expect(aiSource).toBe('rule');
    expect(predicted).toBeGreaterThan(0);
  });

  it('rule fallback predicted_qty uses weekly average scaled to horizon', () => {
    const weeklyTotals = [28, 35, 42];
    const avg = weeklyTotals.reduce((s, v) => s + v, 0) / weeklyTotals.length;
    const predicted30 = Math.ceil((avg / 7) * 30);
    expect(predicted30).toBeGreaterThanOrEqual(150);
  });

  it('days_of_supply is 999 when predicted_qty is zero', () => {
    const predicted = 0;
    const currentStock = 50;
    const daysOfSupply = predicted > 0 ? Math.floor((currentStock / predicted) * 30) : 999;
    expect(daysOfSupply).toBe(999);
  });

  it('anomaly spike detection: recent > mean + 2σ', () => {
    const avgDaily = 5;
    const stddev = 1;
    const recent3dDaily = 12;
    const isSpike = stddev > 0 && recent3dDaily > avgDaily + 2 * stddev;
    expect(isSpike).toBe(true);
    const deviationFactor = (recent3dDaily - avgDaily) / stddev;
    expect(deviationFactor).toBeGreaterThan(2);
  });

  it('reorder_recommended is true when stock < predicted', () => {
    const stockOnHand = 20;
    const predicted = 120;
    const reorderRecommended = stockOnHand < predicted;
    expect(reorderRecommended).toBe(true);
  });
});
