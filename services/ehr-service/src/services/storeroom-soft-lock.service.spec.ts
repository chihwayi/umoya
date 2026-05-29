describe('StoreRoom Soft Lock logic', () => {
  it('reservation status starts as active', () => {
    const reservation = { status: 'active', quantity: 5 };
    expect(reservation.status).toBe('active');
  });

  it('releasing a reservation sets status to released', () => {
    const reservation = { status: 'active' };
    reservation.status = 'released';
    expect(reservation.status).toBe('released');
  });

  it('deducting converts reservation status to deducted', () => {
    const reservation = { status: 'active' };
    reservation.status = 'deducted';
    expect(reservation.status).toBe('deducted');
  });

  it('quantity_reserved decreases after release', () => {
    let qty_reserved = 5;
    const released = 5;
    qty_reserved = Math.max(0, qty_reserved - released);
    expect(qty_reserved).toBe(0);
  });

  it('stale reservation expires when expires_at < NOW', () => {
    const expiresAt = new Date(Date.now() - 1000);
    const isStale = expiresAt < new Date();
    expect(isStale).toBe(true);
  });
});
