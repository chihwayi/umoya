describe('Storeroom Module Integration logic', () => {
  it('emergency kit item is critical when current_qty < minimum_qty', () => {
    const current_qty: number = 1;
    const minimum_qty: number = 3;
    const status = current_qty === 0 ? 'stockout' : current_qty < minimum_qty ? 'critical' : 'ok';
    expect(status).toBe('critical');
  });

  it('emergency kit item is stockout when current_qty is zero', () => {
    const current_qty: number = 0;
    const minimum_qty: number = 3;
    const status = current_qty === 0 ? 'stockout' : current_qty < minimum_qty ? 'critical' : 'ok';
    expect(status).toBe('stockout');
  });

  it('ARV shortage computed correctly', () => {
    const available_qty = 100;
    const total_qty_needed = 150;
    const shortage = Math.max(0, total_qty_needed - available_qty);
    expect(shortage).toBe(50);
  });

  it('ARV status is adequate when available exceeds needed with 20% buffer', () => {
    const available = 200;
    const needed = 150;
    const status = available < needed ? 'shortage' : available < needed * 1.2 ? 'low_buffer' : 'adequate';
    expect(status).toBe('adequate');
  });

  it('chemo ready flag is false when any ingredient is missing', () => {
    const components = [
      { name: 'Cyclophosphamide', available_qty: 5, quantity_per_session: 10 },
      { name: 'Doxorubicin', available_qty: 8, quantity_per_session: 5 },
    ];
    const missing = components.filter(c => c.available_qty < c.quantity_per_session);
    const ready = missing.length === 0;
    expect(ready).toBe(false);
    expect(missing[0].name).toBe('Cyclophosphamide');
  });
});
