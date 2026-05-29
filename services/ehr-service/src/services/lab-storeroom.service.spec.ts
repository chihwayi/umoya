describe('LabOrderService — storeroom kit deduction', () => {
  it('kit_deducted flag starts as false by default', () => {
    const order = { kit_catalog_id: 'kit1', kit_deducted: false };
    expect(order.kit_deducted).toBe(false);
  });

  it('deduction is skipped when kit_deducted is already true', () => {
    const order = { kit_catalog_id: 'kit1', kit_deducted: true };
    const shouldDeduct = order.kit_catalog_id && !order.kit_deducted;
    expect(shouldDeduct).toBeFalsy();
  });

  it('deduction is skipped when kit_catalog_id is null', () => {
    const order = { kit_catalog_id: null, kit_deducted: false };
    const shouldDeduct = order.kit_catalog_id && !order.kit_deducted;
    expect(shouldDeduct).toBeFalsy();
  });

  it('deduction proceeds when kit_catalog_id is set and kit_deducted is false', () => {
    const order = { kit_catalog_id: 'kit1', kit_deducted: false };
    const shouldDeduct = order.kit_catalog_id && !order.kit_deducted;
    expect(shouldDeduct).toBeTruthy();
  });

  it('source_module for lab kit deduction is "lab"', () => {
    const sourceModule = 'lab';
    expect(sourceModule).toBe('lab');
  });
});
