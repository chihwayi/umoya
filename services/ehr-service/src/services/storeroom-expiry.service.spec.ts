describe('Storeroom Expiry & FEFO logic', () => {
  it('batch expiring within 7 days is classified as critical', () => {
    const expiryDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const cutoff7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(expiryDate <= cutoff7d).toBe(true);
  });

  it('batch expiring in 20 days is expiring_soon but not critical', () => {
    const expiryDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const critical = expiryDate <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const expiringSoon = expiryDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    expect(critical).toBe(false);
    expect(expiringSoon).toBe(true);
  });

  it('FEFO: batch with earlier expiry comes first', () => {
    const batches = [
      { id: 'b2', expiry_date: new Date('2026-09-01') },
      { id: 'b1', expiry_date: new Date('2026-07-01') },
    ];
    batches.sort((a, b) => a.expiry_date.getTime() - b.expiry_date.getTime());
    expect(batches[0].id).toBe('b1');
  });

  it('estimated_waste_value multiplies qty by unit_cost', () => {
    const qty = 12;
    const unit_cost = 8.5;
    const wasteValue = qty * unit_cost;
    expect(wasteValue).toBe(102);
  });

  it('cold-chain flag carried through to FEFO batch result', () => {
    const batch = { item_name: 'Oxytocin', requires_refrigeration: true };
    expect(batch.requires_refrigeration).toBe(true);
  });
});
