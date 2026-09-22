/* iHotel AV Scheduler — monthly equipment audits (pure functions; no DOM) */
(function (root) {
  const IH = (root.IH = root.IH || {});
  const U = IH.U;
  const A = (IH.Audit = {});

  A.monthKey = (iso) => String(iso || U.today()).slice(0, 7);
  A.monthLabel = (key) => {
    const [y, m] = String(key).split('-').map(Number);
    return `${U.MONL[(m || 1) - 1]} ${y}`;
  };
  A.find = (state, month) => (state.audits || []).filter((a) => a.month === month).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).pop() || null;

  const cmp = (a, b) => String(a || '').toLowerCase().localeCompare(String(b || '').toLowerCase());
  const walkOrder = (a, b) => cmp(a.location, b.location) || cmp(a.category, b.category) || cmp(a.name, b.name);

  // Start an audit: one line per item, expected = what the inventory says you own.
  A.create = (state, o) => {
    o = o || {};
    const date = o.date || U.today();
    const lines = state.inventory
      .filter((i) => i.condition !== 'Retired')
      .map((i) => ({
        id: U.uid('al'), itemId: i.id, name: i.name, category: i.category || '', model: i.model || '', assetTag: i.assetTag || '', serial: i.serial || '',
        location: i.location || '', expected: +i.qty || 0, counted: null, out: +i.out || 0, condition: i.condition || 'Good', notes: '',
      }))
      .sort(walkOrder);
    return { id: U.uid('aud'), month: o.month || A.monthKey(date), date, auditor: o.auditor || '', status: 'open', notes: '', lines, extras: [], createdAt: Date.now(), closedAt: null, applied: false };
  };

  A.variance = (line) => (line.counted == null || line.counted === '' ? null : +line.counted - +line.expected);
  A.progress = (a) => ({ done: a.lines.filter((l) => l.counted != null && l.counted !== '').length, total: a.lines.length });

  A.summary = (a) => {
    const counted = a.lines.filter((l) => l.counted != null && l.counted !== '');
    const disc = counted.filter((l) => +l.counted !== +l.expected).map((l) => ({ line: l, diff: +l.counted - +l.expected }));
    const byCat = {};
    a.lines.forEach((l) => {
      const c = (byCat[l.category || 'Uncategorized'] = byCat[l.category || 'Uncategorized'] || { expected: 0, counted: 0, items: 0 });
      c.items++; c.expected += +l.expected || 0;
      if (l.counted != null && l.counted !== '') c.counted += +l.counted || 0;
    });
    return {
      items: a.lines.length, counted: counted.length, uncounted: a.lines.length - counted.length,
      expectedUnits: a.lines.reduce((t, l) => t + (+l.expected || 0), 0),
      countedUnits: counted.reduce((t, l) => t + (+l.counted || 0), 0),
      countedExpected: counted.reduce((t, l) => t + (+l.expected || 0), 0),
      discrepancies: disc,
      missingUnits: disc.filter((d) => d.diff < 0).reduce((t, d) => t - d.diff, 0),
      extraUnits: disc.filter((d) => d.diff > 0).reduce((t, d) => t + d.diff, 0),
      needsAttention: counted.filter((l) => (+l.out || 0) > 0 || l.condition === 'Needs repair' || l.condition === 'Retired'),
      extras: (a.extras || []).filter((x) => String(x.name || '').trim()),
      byCategory: byCat,
    };
  };

  // Close the audit. Optionally write what was counted back into the inventory.
  A.finalize = (state, a, o) => {
    o = o || {};
    a.lines.forEach((l) => {
      if (l.counted == null || l.counted === '') return;
      const item = state.inventory.find((i) => i.id === l.itemId);
      if (!item) return;
      item.lastAudit = a.date;
      if (o.applyCounts) {
        item.qty = Math.max(0, +l.counted || 0);
        item.out = Math.max(0, Math.min(item.qty, +l.out || 0));
        if (l.condition) item.condition = l.condition;
      }
    });
    if (o.addExtras) {
      (a.extras || []).filter((x) => String(x.name || '').trim()).forEach((x) => {
        state.inventory.push(IH.Store.newItem({ name: x.name.trim(), qty: Math.max(1, +x.qty || 1), location: x.location || '', category: x.category || '', notes: x.notes || '', lastAudit: a.date }));
      });
    }
    a.status = 'done';
    a.closedAt = Date.now();
    a.applied = !!o.applyCounts;
    return A.summary(a);
  };
})(typeof window !== 'undefined' ? window : globalThis);
