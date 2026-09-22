/* iHotel AV Scheduler — cloud sync logic that needs no network (pure functions, tested in Node).
 *
 * The app's data is flattened into "records": key ("events/ev_123") -> JSON string.
 * Merging works record by record with three copies:
 *    L = what this browser has now
 *    B = what this browser last saw in the cloud (the "base")
 *    R = what the cloud has now
 */
(function (root) {
  const IH = (root.IH = root.IH || {});
  const M = (IH.Merge = {});

  // JSON with sorted keys, so the same data always gives the same string.
  M.stable = (v) => {
    if (Array.isArray(v)) return '[' + v.map(M.stable).join(',') + ']';
    if (v && typeof v === 'object') {
      return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + M.stable(v[k])).join(',') + '}';
    }
    return JSON.stringify(v === undefined ? null : v);
  };

  const COLLECTIONS = ['staff', 'rooms', 'inventory', 'events', 'audits'];
  M.COLLECTIONS = COLLECTIONS;

  // state -> { key: json }
  M.toRecords = (state) => {
    const out = {};
    COLLECTIONS.forEach((c) => (state[c] || []).forEach((r) => { if (r && r.id) out[`${c}/${r.id}`] = M.stable(r); }));
    Object.entries(state.schedules || {}).forEach(([wk, sc]) => { out[`schedules/${wk}`] = M.stable(sc); });
    out['settings/main'] = M.stable(state.settings || {});
    const meta = state.meta || {};
    out['meta/main'] = M.stable({ firstRun: !!meta.firstRun, sampleLoaded: !!meta.sampleLoaded, invConfirmed: !!meta.invConfirmed });
    return out;
  };

  // { key: json } -> plain state fragment (feed to Store.normalize). `localMeta` keeps per-device fields.
  M.fromRecords = (map, localMeta) => {
    const st = { staff: [], rooms: [], inventory: [], events: [], audits: [], schedules: {}, settings: undefined, meta: Object.assign({}, localMeta || {}) };
    Object.entries(map).forEach(([key, json]) => {
      const i = key.indexOf('/');
      const col = key.slice(0, i), id = key.slice(i + 1);
      let v;
      try { v = JSON.parse(json); } catch (e) { return; }
      if (COLLECTIONS.includes(col)) st[col].push(v);
      else if (col === 'schedules') st.schedules[id] = v;
      else if (col === 'settings' && id === 'main') st.settings = v;
      else if (col === 'meta' && id === 'main') Object.assign(st.meta, v);
    });
    const byOrd = (a, b) => (a.ord ?? 0) - (b.ord ?? 0) || String(a.id).localeCompare(String(b.id));
    ['staff', 'rooms', 'inventory'].forEach((c) => st[c].sort(byOrd));
    st.audits.sort((a, b) => String(a.month).localeCompare(String(b.month)) || String(a.id).localeCompare(String(b.id)));
    if (st.settings === undefined) delete st.settings;
    return st;
  };

  /**
   * Three-way merge. Returns
   *   push:        { key: json }  to write to the cloud
   *   remove:      [key]          to delete from the cloud
   *   apply:       { key: json }  to take into this browser
   *   deleteLocal: [key]          to delete from this browser
   *   conflicts:   [key]          edited in both places (the cloud copy wins, except when the cloud deleted it)
   *   final:       { key: json }  the agreed state (becomes the new base)
   */
  M.three = (L, B, R) => {
    const plan = { push: {}, remove: [], apply: {}, deleteLocal: [], conflicts: [], final: {} };
    const keys = new Set([...Object.keys(L), ...Object.keys(B), ...Object.keys(R)]);
    keys.forEach((k) => {
      const l = L[k], b = B[k], r = R[k];
      let fin;
      if (l === r) fin = l;
      else if (l === b) { // only the cloud changed
        if (r === undefined) plan.deleteLocal.push(k); else plan.apply[k] = r;
        fin = r;
      } else if (r === b) { // only this browser changed
        if (l === undefined) plan.remove.push(k); else plan.push[k] = l;
        fin = l;
      } else { // both changed, differently
        plan.conflicts.push(k);
        if (r === undefined) { plan.push[k] = l; fin = l; } // cloud deleted it but it was edited here: keep the edit
        else { plan.apply[k] = r; fin = r; }
      }
      if (fin !== undefined) plan.final[k] = fin;
    });
    return plan;
  };

  // Is there any real difference between two record maps? (ignores the always-present settings/meta rows)
  M.differs = (A, B) => {
    const keys = new Set([...Object.keys(A), ...Object.keys(B)]);
    for (const k of keys) if (A[k] !== B[k]) return true;
    return false;
  };
  // A browser that has never been used: no events, staff or audits.
  M.isPristine = (state) => !(state.events || []).length && !(state.staff || []).length && !(state.audits || []).length;
  M.count = (map, col) => Object.keys(map).filter((k) => k.startsWith(col + '/')).length;
})(typeof window !== 'undefined' ? window : globalThis);
