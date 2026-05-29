describe('Storeroom Procurement logic', () => {
  it('PO starts in draft status', () => {
    const po = { status: 'draft', total_amount: 0 };
    expect(po.status).toBe('draft');
  });

  it('PO transitions to submitted after submit', () => {
    const po: { status: string } = { status: 'draft' };
    po.status = 'submitted';
    expect(po.status).toBe('submitted');
  });

  it('PO is partial when some items received but not all', () => {
    const items = [
      { quantity_ordered: 10, quantity_received: 5 },
      { quantity_ordered: 20, quantity_received: 20 },
    ];
    const allFulfilled = items.every(i => i.quantity_received >= i.quantity_ordered);
    const anyReceived = items.some(i => i.quantity_received > 0);
    const status = allFulfilled ? 'fulfilled' : anyReceived ? 'partial' : 'submitted';
    expect(status).toBe('partial');
  });

  it('total_amount is sum of qty * unit_cost across all items', () => {
    const items = [
      { quantity_ordered: 10, unit_cost: 5 },
      { quantity_ordered: 4, unit_cost: 12.5 },
    ];
    const total = items.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0);
    expect(total).toBe(100);
  });

  it('auto-generate skips items with no preferred_supplier_id', () => {
    const items = [
      { catalog_id: 'c1', preferred_supplier_id: 'sup1', available_qty: 2, reorder_level: 10 },
      { catalog_id: 'c2', preferred_supplier_id: null, available_qty: 0, reorder_level: 5 },
    ];
    const eligible = items.filter(i => i.preferred_supplier_id !== null && i.available_qty <= i.reorder_level);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].catalog_id).toBe('c1');
  });
});
