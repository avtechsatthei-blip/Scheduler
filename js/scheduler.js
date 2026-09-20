/* iHotel AV Scheduler — scheduling engine (pure functions; no DOM) */
(function (root) {
  const IH = (root.IH = root.IH || {});
  const U = IH.U;
  const S = (IH.Sched = {});
  const UNFILLED = 1e6;

  /* =====================================================================
   * 1. What has to be covered
   * ===================================================================== */
  S.needsAV = (ev) => !ev.noAV && ((ev.items && ev.items.length > 0) || (ev.tech && ev.tech.count > 0));

  // The window staff actually need to be around: event hours plus your before/after buffers.
  S.eventWindow = (ev, st) => {
    const s = U.toMin(ev.start);
    let e = U.toMin(ev.end);
    if (e == null || e <= s) e = Math.min(1440, s + 60);
    return [Math.max(0, s - st.bufferBeforeMin), Math.min(1440, e + st.bufferAfterMin)];
  };

  function splitChunks(s, e, maxMin, handoff) {
    const len = e - s;
    if (len <= maxMin) return [[s, e]];
    const k = Math.ceil(len / maxMin);
    const step = len / k;
    const out = [];
    for (let i = 0; i < k; i++) {
      const a = Math.round(s + i * step) - (i > 0 ? handoff : 0);
      const b = Math.round(s + (i + 1) * step);
      out.push([Math.max(0, a), b]);
    }
    return out;
  }

  // Put non-overlapping intervals into "lanes" so one person can work a lane back-to-back.
  function packLanes(intervals, gapMin, maxMin) {
    const sorted = intervals.slice().sort((a, b) => a.s - b.s || a.e - b.e);
    const lanes = [];
    for (const iv of sorted) {
      let best = null;
      let bestGap = Infinity;
      for (const lane of lanes) {
        const last = lane[lane.length - 1];
        const gap = iv.s - last.e;
        if (gap >= 0 && gap <= gapMin && iv.e - lane[0].s <= maxMin && gap < bestGap) {
          best = lane;
          bestGap = gap;
        }
      }
      if (best) best.push(iv);
      else lanes.push([iv]);
    }
    return lanes;
  }

  // Turns the week's events into a list of shifts that need a person.
  S.requirements = (state, weekKey) => {
    const st = state.settings;
    const maxMin = st.maxDayHrs * 60;
    const minMin = st.minDayHrs * 60;
    const gap = st.bridgeGapHrs * 60;
    const reqs = [];
    for (const date of U.weekDates(weekKey)) {
      const evs = state.events.filter((e) => e.date === date && S.needsAV(e));
      if (!evs.length) continue;
      const wins = evs.map((ev) => ({ ev, w: S.eventWindow(ev, st) })).sort((a, b) => a.w[0] - b.w[0]);

      // Base coverage: someone owns the rooms all day (overlapping events share one person).
      const blocks = [];
      for (const { ev, w } of wins) {
        const last = blocks[blocks.length - 1];
        if (last && (w[0] <= last.e || (w[0] - last.e <= gap && Math.max(last.e, w[1]) - last.s <= maxMin))) {
          last.e = Math.max(last.e, w[1]);
          last.evs.push(ev);
        } else blocks.push({ s: w[0], e: w[1], evs: [ev] });
      }
      let n = 0;
      for (const b of blocks) {
        for (const [cs, ce] of splitChunks(b.s, b.e, maxMin, st.handoffMin)) {
          const evIds = b.evs.filter((ev) => { const w = S.eventWindow(ev, st); return w[0] < ce && w[1] > cs; }).map((ev) => ev.id);
          for (let c = 0; c < Math.max(1, st.baseCrew); c++) reqs.push({ date, kind: 'coverage', s: cs, e: ce, eventIds: evIds, key: `${date}|coverage|${n++}` });
        }
      }

      // In-room techs: each one is an extra person for the hours the tech is needed.
      const techIv = [];
      for (const ev of evs) {
        const count = (ev.tech && ev.tech.count) || 0;
        if (!count) continue;
        const base = S.eventWindow(ev, st);
        const ts = ev.tech.start ? Math.max(0, U.toMin(ev.tech.start) - st.bufferBeforeMin) : base[0];
        const te = ev.tech.end ? Math.min(1440, U.toMin(ev.tech.end) + st.bufferAfterMin) : base[1];
        for (let i = 0; i < count; i++) {
          for (const [cs, ce] of splitChunks(ts, te, maxMin, st.handoffMin)) techIv.push({ s: cs, e: ce, ev });
        }
      }
      let t = 0;
      for (const lane of packLanes(techIv, gap, maxMin)) {
        reqs.push({
          date,
          kind: 'tech',
          s: lane[0].s,
          e: lane[lane.length - 1].e,
          eventIds: [...new Set(lane.map((x) => x.ev.id))],
          key: `${date}|tech|${t++}`,
        });
      }
    }
    // Pad short needs up to the minimum shift length.
    for (const r of reqs) {
      r.needS = r.s;
      r.needE = r.e;
      if (r.e - r.s < minMin) {
        r.e = Math.min(1440, r.s + minMin);
        if (r.e - r.s < minMin) r.s = Math.max(0, r.e - minMin);
      }
    }
    reqs.sort((a, b) => a.date.localeCompare(b.date) || a.s - b.s || a.kind.localeCompare(b.kind));
    return reqs;
  };

  /* =====================================================================
   * 2. Rules for a single shift
   * ===================================================================== */
  const norm = (sh) => {
    const s = typeof sh.s === 'number' ? sh.s : U.toMin(sh.start);
    const e = typeof sh.e === 'number' ? sh.e : U.toMin(sh.end);
    return { id: sh.id, staffId: sh.staffId || null, date: sh.date, s, e, len: e - s, abs: U.dayNum(sh.date) * 1440 + s, kind: sh.kind, eventIds: sh.eventIds || [], locked: !!sh.locked };
  };
  S.norm = norm;

  S.onDayOff = (staff, date) => (staff.daysOff || []).some((d) => d.start && date >= d.start && date <= (d.end || d.start));
  S.dayOffNote = (staff, date) => {
    const d = (staff.daysOff || []).find((x) => x.start && date >= x.start && date <= (x.end || x.start));
    return d ? d.note || '' : '';
  };

  function cfgFrom(state) {
    const st = state.settings;
    return { minRest: st.minRestHrs * 60, maxDay: st.maxDayHrs * 60, defMaxWeek: st.maxWeekHrs * 60 };
  }

  // Returns a reason string if `it` can't be worked by `staff`, else null.
  function checkAgainst(it, staff, others, cfg, weekSet, opts) {
    opts = opts || { weekly: true, daily: true };
    if (!staff.active) return 'inactive';
    const av = staff.avail && staff.avail[U.dow(it.date)];
    if (av && av.on === false) return 'unavailable that weekday';
    if (S.onDayOff(staff, it.date)) return 'requested day off';
    if (it.kind === 'tech' && staff.canTech === false) return 'not an in-room tech';
    let dayMin = it.len;
    let weekMin = weekSet.has(it.date) ? it.len : 0;
    for (const o of others) {
      if (o.id === it.id) continue;
      const os = o.abs, oe = o.abs + o.len, as = it.abs, ae = it.abs + it.len;
      if (as < oe && os < ae) return 'overlaps another shift';
      const gap = as >= oe ? as - oe : os - ae;
      if (gap < cfg.minRest) return 'less than the minimum rest between shifts';
      if (o.date === it.date) dayMin += o.len;
      if (weekSet.has(o.date)) weekMin += o.len;
    }
    if (opts.daily && dayMin > cfg.maxDay) return 'over the daily maximum';
    const maxWeek = staff.maxWeek ? staff.maxWeek * 60 : cfg.defMaxWeek;
    if (opts.weekly && weekMin > maxWeek) return 'over the weekly maximum';
    return null;
  }
  S.checkAgainst = checkAgainst;

  function prefMiss(staff, it) {
    const av = staff.avail && staff.avail[U.dow(it.date)];
    if (!av || (!av.from && !av.to)) return 0;
    const f = av.from ? U.toMin(av.from) : 0;
    const t = av.to ? U.toMin(av.to) : 1440;
    return Math.min(it.len, Math.max(0, f - it.s) + Math.max(0, it.e - t));
  }

  /* =====================================================================
   * 3. Building schedules
   * ===================================================================== */
  S.PROFILES = [
    { key: 'balanced', name: 'Balanced', desc: 'Spreads hours fairly and honors preferred hours.', w: { deficit: 3, balance: 1, pref: 1.5, ot: 5, days: 15, person: 0, cont: 2 } },
    { key: 'preferred', name: 'Preferred hours first', desc: 'Keeps people inside their preferred windows wherever it can.', w: { deficit: 1.5, balance: 0.3, pref: 8, ot: 5, days: 15, person: 0, cont: 1 } },
    { key: 'required', name: 'Hit required hours', desc: 'Gets as many people as possible to their weekly minimum.', w: { deficit: 12, balance: 0.4, pref: 1, ot: 5, days: 15, person: 0, cont: 1 } },
    { key: 'lean', name: 'Lean crew', desc: 'Uses the fewest people and keeps the same faces on the same event.', w: { deficit: 0.5, balance: -0.25, pref: 1.5, ot: 10, days: 20, person: 25, cont: 4 } },
  ];

  function solve(ctx, profile, rng, jitter) {
    const { items, staff, fixedByStaff, cfg, weekSet } = ctx;
    const w = profile.w;
    const OT = ctx.overtime * 60;
    const fixedInWeek = ctx.fixedInWeek;

    const others = (staffId, exclude, assign) => {
      const out = (fixedByStaff[staffId] || []).slice();
      for (const it of items) if (it !== exclude && assign[it.id] === staffId) out.push(it);
      return out;
    };
    const feasible = (it, s, assign) => !checkAgainst(it, s, others(s.id, it, assign), cfg, weekSet);

    const objective = (assign) => {
      let cost = 0;
      const per = {};
      staff.forEach((s) => (per[s.id] = { min: 0, dates: new Set(), miss: 0 }));
      for (const f of fixedInWeek) if (per[f.staffId]) { per[f.staffId].min += f.len; per[f.staffId].dates.add(f.date); }
      const evDates = new Map();
      for (const it of items) {
        const sid = assign[it.id];
        if (!sid) { cost += UNFILLED; continue; }
        const p = per[sid];
        p.min += it.len;
        p.dates.add(it.date);
        p.miss += prefMiss(ctx.staffById[sid], it);
        for (const eid of it.eventIds) {
          const k = sid + '|' + eid;
          if (!evDates.has(k)) evDates.set(k, new Set());
          evDates.get(k).add(it.date);
        }
      }
      for (const s of staff) {
        const p = per[s.id];
        const h = p.min / 60;
        const minW = s.minWeek || 0;
        if (h < minW) cost += w.deficit * (minW - h) ** 2;
        cost += (w.balance * h * h) / 10;
        if (p.min > OT) cost += w.ot * (h - OT / 60) ** 2;
        if (p.dates.size > 5) cost += w.days * (p.dates.size - 5);
        if (p.min > 0) cost += w.person;
        cost += (w.pref * p.miss) / 60;
      }
      for (const set of evDates.values()) if (set.size > 1) cost -= w.cont * (set.size - 1);
      return cost;
    };

    // --- greedy build: hardest shift first, cheapest eligible person each time
    const assign = {};
    const remaining = new Set(items);
    while (remaining.size) {
      let pick = null, pickC = null, pickScore = Infinity;
      for (const it of remaining) {
        const c = staff.filter((s) => feasible(it, s, assign));
        const score = c.length * 10000 - it.len + (jitter ? rng() * 50 : 0);
        if (score < pickScore) { pick = it; pickC = c; pickScore = score; }
      }
      remaining.delete(pick);
      if (!pickC.length) { assign[pick.id] = null; continue; }
      let bestS = null, bestV = Infinity;
      for (const s of pickC) {
        assign[pick.id] = s.id;
        const v = objective(assign) + (jitter ? rng() * jitter : 0);
        if (v < bestV) { bestV = v; bestS = s; }
      }
      assign[pick.id] = bestS.id;
    }

    // --- local search: move a shift to someone else, or swap two shifts
    let cur = objective(assign);
    for (let pass = 0; pass < 6; pass++) {
      let improved = false;
      const order = items.slice().sort(() => rng() - 0.5);
      for (const it of order) {
        let was = assign[it.id];
        for (const s of staff) {
          if (s.id === was) continue;
          assign[it.id] = s.id;
          if (feasible(it, s, assign)) {
            const v = objective(assign);
            if (v < cur - 1e-9) { cur = v; improved = true; was = s.id; continue; }
          }
          assign[it.id] = was;
        }
      }
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i], b = items[j];
          const sa = assign[a.id], sb = assign[b.id];
          if (sa === sb) continue;
          assign[a.id] = sb;
          assign[b.id] = sa;
          const okA = !sb || feasible(a, ctx.staffById[sb], assign);
          const okB = !sa || feasible(b, ctx.staffById[sa], assign);
          if (okA && okB) {
            const v = objective(assign);
            if (v < cur - 1e-9) { cur = v; improved = true; continue; }
          }
          assign[a.id] = sa;
          assign[b.id] = sb;
        }
      }
      if (!improved) break;
    }
    return { assign, cost: cur };
  }

  // Main entry: returns several distinct schedule options for the week.
  S.generate = (state, weekKey, opts) => {
    opts = opts || {};
    const st = state.settings;
    const cfg = cfgFrom(state);
    const weekSet = new Set(U.weekDates(weekKey));
    const existing = ((state.schedules[weekKey] || {}).shifts || []).map((x) => ({ ...x }));
    const locked = existing.filter((x) => x.locked && x.staffId);
    const allReqs = S.requirements(state, weekKey);
    const lockedN = locked.map(norm);
    const reqs = allReqs.filter((r) => {
      const need = r.needE - r.needS || 1;
      return !lockedN.some((l) => l.date === r.date && l.kind === r.kind && Math.min(l.e, r.needE) - Math.max(l.s, r.needS) >= need * 0.5);
    });
    const items = reqs.map((r, i) => ({ id: 'g' + i, staffId: null, date: r.date, s: r.s, e: r.e, len: r.e - r.s, abs: U.dayNum(r.date) * 1440 + r.s, kind: r.kind, eventIds: r.eventIds }));

    const staff = state.staff.filter((s) => s.active);
    const staffById = {};
    state.staff.forEach((s) => (staffById[s.id] = s));

    // shifts from neighboring weeks matter for rest rules
    const fixed = lockedN.slice();
    [U.addDays(weekKey, -7), U.addDays(weekKey, 7)].forEach((k) => {
      ((state.schedules[k] || {}).shifts || []).forEach((x) => { if (x.staffId) fixed.push(norm(x)); });
    });
    const fixedByStaff = {};
    fixed.forEach((f) => (fixedByStaff[f.staffId] = (fixedByStaff[f.staffId] || []).concat([f])));
    const fixedInWeek = fixed.filter((f) => weekSet.has(f.date));

    const ctx = { items, staff, staffById, fixedByStaff, fixedInWeek, cfg, weekSet, overtime: st.overtimeHrs };
    const options = [];
    const seen = new Map();
    const restarts = opts.restarts || 8;
    S.PROFILES.forEach((profile, pi) => {
      let best = null;
      for (let r = 0; r < restarts; r++) {
        const rng = U.mulberry(1000 * (pi + 1) + r * 17 + (opts.seed || 0));
        const res = solve(ctx, profile, rng, r === 0 ? 0 : 20);
        if (!best || res.cost < best.cost) best = res;
      }
      const sig = items.map((it) => best.assign[it.id] || '-').join(',');
      if (seen.has(sig)) { seen.get(sig).alsoMatches.push(profile.name); return; }
      const shifts = existing.filter((x) => x.locked && x.staffId).concat(
        items.map((it, i) => ({
          id: U.uid('sh'), staffId: best.assign[it.id] || null, date: it.date, start: U.fromMin(it.s), end: U.fromMin(it.e),
          kind: it.kind, eventIds: it.eventIds, locked: false, needStart: U.fromMin(reqs[i].needS), needEnd: U.fromMin(reqs[i].needE),
        }))
      );
      const opt = { key: profile.key, name: profile.name, desc: profile.desc, shifts, alsoMatches: [] };
      seen.set(sig, opt);
      options.push(opt);
    });
    // Tight weeks can make every strategy land on the same answer; offer a few valid alternates anyway.
    const balanced = S.PROFILES[0];
    for (let a = 0; options.length < 3 && a < 12; a++) {
      const res = solve(ctx, balanced, U.mulberry(7777 + a * 31 + (opts.seed || 0)), 250);
      const sig = items.map((it) => res.assign[it.id] || '-').join(',');
      if (seen.has(sig)) continue;
      const shifts = existing.filter((x) => x.locked && x.staffId).concat(
        items.map((it, i) => ({
          id: U.uid('sh'), staffId: res.assign[it.id] || null, date: it.date, start: U.fromMin(it.s), end: U.fromMin(it.e),
          kind: it.kind, eventIds: it.eventIds, locked: false, needStart: U.fromMin(reqs[i].needS), needEnd: U.fromMin(reqs[i].needE),
        }))
      );
      const opt = { key: 'alt' + a, name: 'Alternate ' + (options.filter((o) => o.key.startsWith('alt')).length + 1), desc: 'A different arrangement that still follows every rule.', shifts, alsoMatches: [] };
      seen.set(sig, opt);
      options.push(opt);
    }
    options.forEach((o) => {
      o.summary = S.summary(state, weekKey, o.shifts);
      o.issues = S.validate(state, weekKey, o.shifts);
    });
    return options;
  };

  /* =====================================================================
   * 4. Checking a schedule (used for generated options and manual edits)
   * ===================================================================== */
  S.weekMinutes = (shifts, weekKey) => {
    const set = new Set(U.weekDates(weekKey));
    const m = {};
    shifts.forEach((sh) => {
      if (!sh.staffId || !set.has(sh.date)) return;
      const n = norm(sh);
      m[sh.staffId] = (m[sh.staffId] || 0) + n.len;
    });
    return m;
  };

  S.summary = (state, weekKey, shifts) => {
    const mins = S.weekMinutes(shifts, weekKey);
    const total = shifts.length;
    const filled = shifts.filter((s) => s.staffId).length;
    let assignedMin = 0, missMin = 0;
    shifts.forEach((sh) => {
      if (!sh.staffId) return;
      const n = norm(sh);
      assignedMin += n.len;
      const st = state.staff.find((x) => x.id === sh.staffId);
      if (st) missMin += prefMiss(st, n);
    });
    const ot = state.settings.overtimeHrs * 60;
    let under = 0, over = 0;
    state.staff.filter((s) => s.active).forEach((s) => {
      const m = mins[s.id] || 0;
      if (m < (s.minWeek || 0) * 60) under++;
      if (m > ot) over += (m - ot) / 60;
    });
    return {
      total, filled, open: total - filled,
      coveragePct: total ? Math.round((filled / total) * 100) : 100,
      totalHours: assignedMin / 60,
      prefPct: assignedMin ? Math.round(((assignedMin - missMin) / assignedMin) * 100) : 100,
      people: Object.keys(mins).length,
      underMin: under,
      overtimeHrs: Math.round(over * 10) / 10,
    };
  };

  function describe(state, sh) {
    const evs = (sh.eventIds || []).map((id) => state.events.find((e) => e.id === id)).filter(Boolean);
    const names = [...new Set(evs.map((e) => e.name))].join(', ');
    const rooms = [...new Set(evs.map((e) => (state.rooms.find((r) => r.id === e.roomId) || {}).name).filter(Boolean))].join(', ');
    return `${U.fmtDay(sh.date)} ${U.fmtRange(sh.start, sh.end)}${sh.kind === 'tech' ? ' (in-room tech)' : ''}${rooms ? ' · ' + rooms : ''}${names && !rooms ? ' · ' + names : ''}`;
  }
  S.describe = describe;

  S.validate = (state, weekKey, shifts) => {
    const issues = [];
    const cfg = cfgFrom(state);
    const weekSet = new Set(U.weekDates(weekKey));
    const staffById = {};
    state.staff.forEach((s) => (staffById[s.id] = s));
    const all = shifts.filter((s) => s.staffId).map(norm);
    [U.addDays(weekKey, -7), U.addDays(weekKey, 7)].forEach((k) => ((state.schedules[k] || {}).shifts || []).forEach((x) => { if (x.staffId) all.push(norm(x)); }));
    const byStaff = {};
    all.forEach((n) => (byStaff[n.staffId] = (byStaff[n.staffId] || []).concat([n])));
    const pairSeen = new Set();

    shifts.forEach((sh) => {
      if (!sh.staffId) {
        issues.push({ level: 'error', type: 'open', shiftId: sh.id, date: sh.date, text: `Open shift, nobody available: ${describe(state, sh)}` });
        return;
      }
      const st = staffById[sh.staffId];
      if (!st) { issues.push({ level: 'error', type: 'staff', shiftId: sh.id, date: sh.date, text: `Shift assigned to a removed staff member: ${describe(state, sh)}` }); return; }
      const n = norm(sh);
      const reason = checkAgainst(n, st, byStaff[st.id] || [], cfg, weekSet, { weekly: false, daily: false });
      if (reason) {
        const other = (byStaff[st.id] || []).find((o) => {
          if (o.id === n.id) return false;
          const gap = n.abs >= o.abs + o.len ? n.abs - (o.abs + o.len) : o.abs - (n.abs + n.len);
          return (n.abs < o.abs + o.len && o.abs < n.abs + n.len) || gap < cfg.minRest;
        });
        const key = [n.id, other && other.id].sort().join('~') + reason;
        if (reason.startsWith('overlaps') || reason.startsWith('less than')) { if (pairSeen.has(key)) return; pairSeen.add(key); }
        const type = reason.startsWith('requested') ? 'dayoff' : reason.startsWith('unavailable') ? 'unavail' : reason.startsWith('not an') ? 'tech' : reason.startsWith('less') ? 'rest' : 'conflict';
        issues.push({ level: 'error', type, shiftId: sh.id, staffId: st.id, date: sh.date, text: `${st.name}: ${reason} (${describe(state, sh)})` });
      }
      const miss = prefMiss(st, n);
      if (miss >= 30) issues.push({ level: 'info', type: 'pref', shiftId: sh.id, staffId: st.id, date: sh.date, text: `${st.name} works ${U.hrs(miss)} outside preferred hours on ${U.fmtDay(sh.date)}` });
    });

    // per-person totals
    const mins = S.weekMinutes(shifts, weekKey);
    state.staff.filter((s) => s.active).forEach((s) => {
      const m = mins[s.id] || 0;
      const max = (s.maxWeek || state.settings.maxWeekHrs) * 60;
      if (m > max) issues.push({ level: 'error', type: 'weekly-max', staffId: s.id, text: `${s.name} is scheduled ${U.hrs(m)}, over their ${U.hrs(max)} weekly maximum` });
      if (m < (s.minWeek || 0) * 60) issues.push({ level: 'warn', type: 'weekly-min', staffId: s.id, text: `${s.name} is at ${U.hrs(m)}, under their ${U.hrs(s.minWeek * 60)} weekly minimum` });
      const perDay = {};
      shifts.forEach((sh) => { if (sh.staffId === s.id) perDay[sh.date] = (perDay[sh.date] || 0) + norm(sh).len; });
      Object.entries(perDay).forEach(([d, v]) => { if (v > cfg.maxDay) issues.push({ level: 'error', type: 'daily-max', staffId: s.id, date: d, text: `${s.name} is scheduled ${U.hrs(v)} on ${U.fmtDay(d)}, over the ${U.hrs(cfg.maxDay)} daily maximum` }); });
    });

    // coverage gaps (things that lost coverage after manual edits, not just open shifts)
    issues.push(...S.coverageGaps(state, weekKey, shifts));
    const rank = { error: 0, warn: 1, info: 2 };
    issues.sort((a, b) => rank[a.level] - rank[b.level]);
    return issues;
  };

  // Minute-by-minute check that every event's needs are covered by an assigned or open shift.
  S.coverageGaps = (state, weekKey, shifts) => {
    const st = state.settings;
    const out = [];
    for (const date of U.weekDates(weekKey)) {
      const evs = state.events.filter((e) => e.date === date && S.needsAV(e));
      if (!evs.length) continue;
      const baseNeed = new Uint8Array(1441), techNeed = new Uint8Array(1441);
      for (const ev of evs) {
        const [a, b] = S.eventWindow(ev, st);
        for (let m = a; m < b; m++) baseNeed[m] = Math.max(1, st.baseCrew);
        const c = (ev.tech && ev.tech.count) || 0;
        if (c) {
          const ts = ev.tech.start ? Math.max(0, U.toMin(ev.tech.start) - st.bufferBeforeMin) : a;
          const te = ev.tech.end ? Math.min(1440, U.toMin(ev.tech.end) + st.bufferAfterMin) : b;
          for (let m = ts; m < te; m++) techNeed[m] += c;
        }
      }
      const dayShifts = shifts.filter((s) => s.date === date).map(norm);
      const scan = (need, kind, label) => {
        let start = null, worst = 0;
        for (let m = 0; m <= 1440; m++) {
          let short = 0;
          if (m < 1440 && need[m]) {
            const have = dayShifts.filter((s) => s.kind === kind && s.s <= m && s.e > m).length;
            short = Math.max(0, need[m] - have);
          }
          if (short && start == null) { start = m; worst = short; }
          else if (short) worst = Math.max(worst, short);
          if (!short && start != null) {
            out.push({ level: 'error', type: 'coverage', date, text: `${label} gap on ${U.fmtDay(date)} ${U.fmtRange(U.fromMin(start), U.fromMin(m))}: short ${worst}` });
            start = null;
          }
        }
      };
      scan(baseNeed, 'coverage', 'Room coverage');
      scan(techNeed, 'tech', 'In-room tech');
    }
    return out;
  };

  // In-room tech billing estimate for the week.
  S.techBilling = (state, weekKey) => {
    const st = state.settings;
    let hours = 0, total = 0;
    for (const ev of S.eventsIn(state, weekKey)) {
      const c = (ev.tech && ev.tech.count) || 0;
      if (!c) continue;
      const s = U.toMin(ev.tech.start || ev.start), e = U.toMin(ev.tech.end || ev.end);
      const h = Math.max(st.techMinBillHrs, (e - s) / 60);
      hours += h * c;
      total += h * c * st.techRate;
    }
    return { hours, total };
  };
  S.eventsIn = (state, weekKey) => {
    const set = new Set(U.weekDates(weekKey));
    return state.events.filter((e) => set.has(e.date));
  };
})(typeof window !== 'undefined' ? window : globalThis);
