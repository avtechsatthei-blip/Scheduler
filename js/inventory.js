/* iHotel AV Scheduler — equipment check (pure functions; no DOM) */
(function (root) {
  const IH = (root.IH = root.IH || {});
  const U = IH.U;
  const Inv = (IH.Inv = {});

  // Highest number of an item in use at the same moment, and which events cause it.
  function peak(intervals) {
    let best = { peak: 0, at: null, events: [] };
    for (const iv of intervals) {
      const t = iv.s;
      const active = intervals.filter((x) => x.s <= t && x.e > t);
      const sum = active.reduce((a, x) => a + x.qty, 0);
      if (sum > best.peak) {
        best = { peak: sum, at: [Math.max(...active.map((x) => x.s)), Math.min(...active.map((x) => x.e))], events: active.map((x) => x.ev) };
      }
    }
    return best;
  }

  Inv.analyze = (state, weekKey) => {
    const st = state.settings;
    const invByKey = {};
    state.inventory.forEach((i) => (invByKey[U.itemKey(i.name)] = i));
    const dates = U.weekDates(weekKey);
    const usage = {}; // key -> { name, byDate: {date: peakInfo} }
    for (const date of dates) {
      const evs = state.events.filter((e) => e.date === date);
      const perItem = {};
      for (const ev of evs) {
        const [s, e] = IH.Sched.eventWindow(ev, st);
        for (const it of ev.items || []) {
          if (it.builtIn || !it.qty) continue;
          const k = U.itemKey(it.name);
          (perItem[k] = perItem[k] || { name: it.name, list: [] }).list.push({ s, e, qty: +it.qty, ev });
        }
      }
      for (const [k, v] of Object.entries(perItem)) {
        usage[k] = usage[k] || { name: v.name, byDate: {} };
        usage[k].byDate[date] = peak(v.list);
      }
    }

    const alerts = [];
    const rows = [];
    let rentalCost = 0;
    const roomName = (ev) => (state.rooms.find((r) => r.id === ev.roomId) || {}).name || '';
    Object.entries(usage).forEach(([k, u]) => {
      const inv = invByKey[k];
      const own = inv ? +inv.qty || 0 : 0, out = inv ? +inv.out || 0 : 0;
      const have = Math.max(0, own - out); // units that actually work
      const outNote = out ? ` (${out} out of service)` : '';
      let weekPeak = 0, weekPeakDate = null, worst = 'ok';
      Object.entries(u.byDate).forEach(([date, p]) => {
        if (p.peak > weekPeak) { weekPeak = p.peak; weekPeakDate = date; }
        const evNames = p.events.map((e) => `${e.name}${roomName(e) ? ' (' + roomName(e) + ')' : ''}`);
        const when = p.at ? U.fmtRange(U.fromMin(p.at[0]), U.fromMin(p.at[1])) : '';
        if (!inv) {
          worst = 'short';
          alerts.push({ level: 'short', kind: 'missing', item: u.name, date, peak: p.peak, have: 0, need: p.peak, when, events: evNames, rentCost: 0, text: `${u.name} isn't in your inventory list. ${p.peak} needed ${U.fmtDay(date)}.` });
        } else if (p.peak > have) {
          const need = p.peak - have;
          const cost = need * (+inv.rentCost || 0);
          rentalCost += inv.rentable ? cost : 0;
          worst = 'short';
          alerts.push({ level: 'short', kind: 'short', item: u.name, date, peak: p.peak, have, need, when, events: evNames, rentable: inv.rentable, rentCost: cost, text: `Short ${need} ${u.name}${need > 1 ? 's' : ''} on ${U.fmtDay(date)}: ${p.peak} in use at ${when}, ${have} on hand${outNote}.` + (inv.rentable ? ` Rent ${need}${cost ? ' (about $' + cost + ')' : ''}.` : '') });
        } else if (have > 0 && p.peak >= Math.ceil((have * st.lowStockPct) / 100)) {
          if (worst === 'ok') worst = 'low';
          alerts.push({ level: 'low', kind: 'low', item: u.name, date, peak: p.peak, have, need: 0, when, events: evNames, rentCost: 0, text: `${u.name} is running low on ${U.fmtDay(date)}: ${p.peak} of ${have} in use at ${when}.` });
        }
      });
      rows.push({ key: k, name: u.name, have, own, out, inInventory: !!inv, weekPeak, weekPeakDate, status: worst, byDate: Object.fromEntries(Object.entries(u.byDate).map(([d, p]) => [d, p.peak])) });
    });
    // items in inventory that aren't used this week
    state.inventory.forEach((i) => {
      if (!usage[U.itemKey(i.name)]) rows.push({ key: U.itemKey(i.name), name: i.name, have: Math.max(0, (+i.qty || 0) - (+i.out || 0)), own: +i.qty || 0, out: +i.out || 0, inInventory: true, weekPeak: 0, weekPeakDate: null, status: 'idle', byDate: {} });
    });
    rows.sort((a, b) => ({ short: 0, low: 1, ok: 2, idle: 3 }[a.status] - { short: 0, low: 1, ok: 2, idle: 3 }[b.status]) || a.name.localeCompare(b.name));
    const rank = { short: 0, low: 1 };
    alerts.sort((a, b) => rank[a.level] - rank[b.level] || a.date.localeCompare(b.date));
    return { rows, alerts, rentalCost, dates };
  };
})(typeof window !== 'undefined' ? window : globalThis);
