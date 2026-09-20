/* Schedule: generate options, preview, apply, edit shifts, export */
(function (root) {
  const IH = root.IH, U = IH.U, UI = IH.UI, Store = IH.Store, Sched = IH.Sched;
  const { esc, icon: ic } = UI;
  const mem = (UI.mem.sched = { options: {}, preview: {}, drag: null });

  const cfgOf = (st) => ({ minRest: st.settings.minRestHrs * 60, maxDay: st.settings.maxDayHrs * 60, defMaxWeek: st.settings.maxWeekHrs * 60 });
  const sigOf = (reqs) => reqs.map((r) => `${r.date}|${r.kind}|${r.s}|${r.e}`).join(';');

  function roomLabel(state, sh) {
    const names = [];
    (sh.eventIds || []).forEach((id) => {
      const ev = state.events.find((e) => e.id === id);
      const r = ev && state.rooms.find((x) => x.id === ev.roomId);
      if (r && !names.includes(r.name)) names.push(r.name);
    });
    if (!names.length) return sh.kind === 'tech' ? 'In-room tech' : 'Room coverage';
    return names.length > 2 ? `${names.length} rooms` : names.join(', ');
  }

  // Why can't this person take this shift? (null = fine)
  function reasonFor(staff, sh, shifts, wk) {
    const st = Store.state;
    const n = Sched.norm(sh);
    const weekSet = new Set(U.weekDates(wk));
    const others = shifts.filter((x) => x.staffId === staff.id && x.id !== sh.id).map(Sched.norm);
    [U.addDays(wk, -7), U.addDays(wk, 7)].forEach((k) => ((st.schedules[k] || {}).shifts || []).forEach((x) => { if (x.staffId === staff.id) others.push(Sched.norm(x)); }));
    return Sched.checkAgainst(n, staff, others, cfgOf(st), weekSet, { weekly: true, daily: true });
  }

  function optionRank(o) {
    const e = o.issues.filter((i) => i.level === 'error').length;
    return e * 1000 + o.summary.open * 100 + o.summary.underMin * 10 - o.summary.prefPct / 100 + o.summary.overtimeHrs;
  }

  /* ======================= render ======================= */
  UI.Views.schedule = {
    title: 'Schedule',
    render() {
      const st = Store.state, wk = UI.weekKey;
      const saved = st.schedules[wk] || null;
      const opts = mem.options[wk] || null;
      const pk = mem.preview[wk] || null;
      const previewOpt = opts && pk ? opts.find((o) => o.key === pk) : null;
      const shifts = previewOpt ? previewOpt.shifts : saved ? saved.shifts : null;
      const reqs = Sched.requirements(st, wk);
      const hasShifts = shifts && shifts.length;

      const top = UI.pageTop('Schedule', 'Who works when',
        `${UI.weekNav()}${hasShifts && !previewOpt ? `<button class="btn" data-act="sched-copy">${ic('copy', 'sm')} Copy as text</button><button class="btn" data-act="sched-print">${ic('print', 'sm')} Print</button>` : ''}${saved && !previewOpt ? `<button class="btn ghost danger" data-act="sched-clear">${ic('trash', 'sm')} Clear</button>` : ''}
         <button class="btn" data-act="pptx-open">${ic('deck', 'sm')} PowerPoint</button>
         <button class="btn primary" data-act="sched-gen" ${reqs.length ? '' : 'disabled'}>${ic('wand', 'sm')} ${saved || opts ? 'Rebuild options' : 'Build options'}</button>`);

      const s = st.settings;
      const rules = `<div class="row wrap noprint" style="gap:6px;margin-bottom:16px">
        <span class="chip">${ic('clock', 'sm')} Shifts ${s.minDayHrs}–${s.maxDayHrs}h</span>
        <span class="chip">${s.minRestHrs}h rest between shifts</span>
        <span class="chip">${s.bufferBeforeMin} min before · ${s.bufferAfterMin} min after events</span>
        <span class="chip">+1 person per in-room tech</span>
        <a href="#/settings" class="small" style="margin-left:4px" data-act="go" data-view="settings">Change rules</a></div>`;

      if (!reqs.length && !hasShifts) {
        return top + `<div class="card pad empty"><h3>Nothing to staff this week</h3><p>No event this week needs AV. Add events, or pick another week.</p>
          <div class="row" style="justify-content:center"><button class="btn primary" data-act="ev-new">${ic('plus', 'sm')} Add event</button></div></div>`;
      }

      let html = top + rules;

      // stale schedule warning
      if (saved && !previewOpt && saved.sig && saved.sig !== sigOf(reqs)) {
        html += `<div class="callout warn noprint" style="margin-bottom:16px">${ic('alert')}<div class="grow"><b>Events changed since this schedule was built.</b> Coverage may no longer match. Rebuild to refresh (shifts you locked stay put).</div><button class="btn xs" data-act="sched-gen">Rebuild</button></div>`;
      }
      if (!st.staff.filter((x) => x.active).length) {
        html += `<div class="callout bad" style="margin-bottom:16px">${ic('alert')}<div class="grow">You haven't added any active staff yet, so every shift will come out open.</div><button class="btn xs" data-act="go" data-view="staff">Add staff</button></div>`;
      }

      // options
      if (opts) {
        const best = opts.slice().sort((a, b) => optionRank(a) - optionRank(b))[0];
        html += `<div class="row" style="margin-bottom:10px"><h3 style="font-size:16px">${UI.plural(opts.length, 'option')}</h3><span class="muted small">Click one to preview it below. Nothing is saved until you use it.</span></div>
          <div class="optgrid" style="margin-bottom:22px">${opts.map((o) => {
            const su = o.summary, errs = o.issues.filter((i) => i.level === 'error').length;
            const mins = Sched.weekMinutes(o.shifts, wk);
            const people = st.staff.filter((x) => mins[x.id]);
            const mx = Math.max(1, ...people.map((x) => mins[x.id]));
            return `<button class="opt ${pk === o.key ? 'sel' : ''}" data-act="opt-preview" data-key="${o.key}">
              <div class="ttl">${esc(o.name)} ${best === o ? '<span class="tag ok">Best fit</span>' : ''}${saved && saved.optionName === o.name && !saved.edited ? '<span class="tag navy">In use</span>' : ''}</div>
              <div class="dsc">${esc(o.desc)}${o.alsoMatches.length ? ` <span class="tiny">(Also what ${esc(o.alsoMatches.join(', '))} produced.)</span>` : ''}</div>
              <div class="meter"><span class="muted">Shifts covered</span><b>${su.filled}/${su.total}</b>
                <span class="muted">Staff hours</span><b>${Math.round(su.totalHours * 10) / 10}h · ${su.people} people</b>
                <span class="muted">Inside preferred hours</span><b>${su.prefPct}%</b>
                <span class="muted">Under weekly minimum</span><b>${su.underMin ? su.underMin + ' people' : 'nobody'}</b>
                <span class="muted">Rule problems</span><b style="color:${errs ? 'var(--bad)' : 'var(--ok)'}">${errs || 'None'}</b></div>
              <div class="bars">${people.map((x) => `<i style="height:${Math.max(6, (mins[x.id] / mx) * 100)}%;background:${x.color}" title="${esc(x.name)} ${U.hrs(mins[x.id])}"></i>`).join('')}</div></button>`;
          }).join('')}</div>`;
      }

      if (previewOpt) {
        html += `<div class="callout info noprint" style="margin-bottom:14px">${ic('info')}<div class="grow"><b>Previewing ${esc(previewOpt.name)}.</b> This isn't saved yet${saved ? ', and using it replaces your current schedule (locked shifts are kept)' : ''}.</div>
          <button class="btn xs" data-act="opt-cancel">Close preview</button><button class="btn xs primary" data-act="opt-use">Use this option</button></div>`;
      }

      if (!hasShifts) {
        const hrs = reqs.reduce((a, r) => a + (r.e - r.s), 0) / 60;
        html += `<div class="card pad"><div class="row top"><div class="grow"><h3>${UI.plural(reqs.length, 'shift')} need covering, about ${Math.round(hrs)} staff-hours</h3>
          <p class="muted" style="margin:6px 0 0">Press <b>Build options</b> and you'll get several complete schedules to compare. Or look at the plan first:</p></div>
          <button class="btn primary" data-act="sched-gen">${ic('wand', 'sm')} Build options</button></div>
          <details class="plain" style="margin-top:12px"><summary>Coverage plan</summary>
          <table class="tbl tight" style="margin-top:8px"><thead><tr><th>Day</th><th>Time</th><th>Type</th><th>Rooms</th></tr></thead><tbody>${reqs.map((r) => `<tr><td>${U.fmtDay(r.date)}</td><td>${U.fmtRange(U.fromMin(r.s), U.fromMin(r.e))}</td><td>${r.kind === 'tech' ? '<span class="tag navy">In-room tech</span>' : 'Room coverage'}</td><td class="small">${esc(roomLabel(st, { eventIds: r.eventIds, kind: r.kind }))}</td></tr>`).join('')}</tbody></table></details></div>`;
        return html;
      }

      html += grid(shifts, !previewOpt);
      const issues = Sched.validate(st, wk, shifts);
      html += issuesCard(issues, shifts);
      return html;
    },
  };

  function grid(shifts, editable) {
    const st = Store.state, wk = UI.weekKey;
    const dates = U.weekDates(wk);
    const mins = Sched.weekMinutes(shifts, wk);
    const issues = Sched.validate(st, wk, shifts);
    const badIds = new Set(issues.filter((i) => i.level === 'error' && i.shiftId).map((i) => i.shiftId));
    const staff = st.staff.filter((x) => x.active || shifts.some((sh) => sh.staffId === x.id));
    const open = shifts.filter((x) => !x.staffId);
    const today = U.today();
    const chip = (sh, s) => {
      const c = s ? s.color : '#c43d2b';
      return `<button class="shift ${sh.kind === 'tech' ? 'tech' : ''} ${s ? '' : 'open'} ${badIds.has(sh.id) ? 'bad' : ''} ${editable ? '' : 'ro'}" style="--sc:${c};--sb:${s ? U.tint(c, 0.86) : ''}" ${editable ? `data-act="sh-edit" data-id="${sh.id}" draggable="true"` : ''}>
        <b>${sh.locked ? `<span class="lk">${ic('lock', 'sm')}</span>` : ''}<span class="tm">${U.fmtRange(sh.start, sh.end)}</span></b><span>${esc(roomLabel(st, sh))}</span></button>`;
    };
    const head = `<tr><th class="who">Staff</th>${dates.map((d) => {
      const dayHrs = shifts.filter((x) => x.date === d && x.staffId).reduce((a, x) => a + Sched.norm(x).len, 0);
      return `<th class="${d === today ? 'today' : ''}">${U.DOW[U.dow(d)]}<span class="dn">${U.parseDate(d).getDate()}</span><span class="tiny" style="letter-spacing:0;text-transform:none;font-weight:600">${dayHrs ? U.hrs(dayHrs) : ''}</span></th>`;
    }).join('')}<th>Week</th></tr>`;
    const openRow = open.length ? `<tr class="openrow"><td class="who"><div class="row"><span class="avatar" style="background:var(--bad)">!</span><div><b style="color:var(--bad)">Open shifts</b><div class="tiny muted">${open.length} unfilled</div></div></div></td>
      ${dates.map((d) => `<td data-staff="" data-date="${d}">${open.filter((x) => x.date === d).map((x) => chip(x, null)).join('')}</td>`).join('')}<td class="hrs"></td></tr>` : '';
    const rows = staff.map((s) => {
      const m = mins[s.id] || 0;
      const min = (s.minWeek || 0) * 60, max = (s.maxWeek || st.settings.maxWeekHrs) * 60;
      const cls = m > max ? 'over' : m < min ? 'under' : '';
      return `<tr><td class="who"><div class="row"><span class="avatar" style="background:${s.color}">${esc(UI.initials(s.name))}</span><div><b>${esc(s.name)}</b><div class="tiny muted">${esc(s.role || '')}${s.active ? '' : ' · inactive'}</div></div></div></td>
        ${dates.map((d) => {
          const list = shifts.filter((x) => x.staffId === s.id && x.date === d).sort((a, b) => a.start.localeCompare(b.start));
          const dayOff = Sched.onDayOff(s, d), unavail = s.avail && s.avail[U.dow(d)] && s.avail[U.dow(d)].on === false;
          return `<td data-staff="${s.id}" data-date="${d}" class="${!list.length && (dayOff || unavail) ? 'off' : ''}">${list.map((x) => chip(x, s)).join('')}${!list.length && dayOff ? `<div class="offl">Day off${Sched.dayOffNote(s, d) ? ': ' + esc(Sched.dayOffNote(s, d)) : ''}</div>` : ''}${editable ? `<button class="btn xs ghost addbtn" data-act="sh-add" data-staff="${s.id}" data-date="${d}" title="Add a shift">${ic('plus', 'sm')}</button>` : ''}</td>`;
        }).join('')}
        <td class="hrs"><b>${m ? U.hrs(m) : '–'}</b><div class="tiny muted">${s.minWeek || 0}–${Math.round(max / 60)}h</div><div class="hrsbar ${cls}"><i style="width:${Math.min(100, (m / Math.max(1, max)) * 100)}%"></i></div></td></tr>`;
    }).join('');
    return `<div class="card scroll-x"><table class="sgrid" id="sgrid"><thead>${head}</thead><tbody>${openRow}${rows}</tbody></table></div>
      ${editable ? '<div class="small muted noprint" style="margin-top:8px">Click a shift to change who works it or its times. Drag a shift to another person on the same day. Lock a shift and it stays put when you rebuild.</div>' : ''}`;
  }

  function issuesCard(issues, shifts) {
    if (!issues.length) return `<div class="callout ok" style="margin-top:18px">${ic('check')}<div><b>Every rule checks out.</b> All shifts are covered, nobody is over their limits, and nobody is in a close-then-open.</div></div>`;
    const by = { error: [], warn: [], info: [] };
    issues.forEach((i) => by[i.level].push(i));
    const icn = { error: 'alert', warn: 'alert', info: 'info' };
    const label = { error: 'Problems', warn: 'Worth a look', info: 'Notes' };
    return `<div class="card pad" style="margin-top:18px">${['error', 'warn', 'info'].filter((k) => by[k].length).map((k) => `<div style="margin-bottom:8px"><div class="row" style="margin-bottom:2px"><h3 style="font-size:14px">${label[k]}</h3><span class="tag ${k === 'error' ? 'bad' : k === 'warn' ? 'warn' : 'info'}">${by[k].length}</span></div>
      ${by[k].slice(0, k === 'info' ? 6 : 30).map((i) => `<div class="issue ${k}">${ic(icn[k])}<div>${esc(i.text)}</div></div>`).join('')}${k === 'info' && by[k].length > 6 ? `<div class="small muted">and ${by[k].length - 6} more</div>` : ''}</div>`).join('')}</div>`;
  }

  UI.Views.schedule.mount = (main) => {
    const g = UI.$('#sgrid', main);
    if (!g) return;
    g.addEventListener('dragstart', (e) => {
      const b = e.target.closest('.shift[data-id]');
      if (!b) return;
      const sc = Store.state.schedules[UI.weekKey];
      const sh = sc && sc.shifts.find((x) => x.id === b.dataset.id);
      mem.drag = sh ? { id: sh.id, date: sh.date } : null;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', b.dataset.id);
    });
    g.addEventListener('dragover', (e) => {
      const td = e.target.closest('td[data-date]');
      if (td && mem.drag && td.dataset.date === mem.drag.date && td.dataset.staff !== undefined) { e.preventDefault(); UI.$$('.dropok', g).forEach((x) => x !== td && x.classList.remove('dropok')); td.classList.add('dropok'); }
    });
    g.addEventListener('dragend', () => { UI.$$('.dropok', g).forEach((x) => x.classList.remove('dropok')); mem.drag = null; });
    g.addEventListener('drop', (e) => {
      const td = e.target.closest('td[data-date]');
      UI.$$('.dropok', g).forEach((x) => x.classList.remove('dropok'));
      if (!td || !mem.drag) return;
      e.preventDefault();
      if (td.dataset.date !== mem.drag.date) { UI.toast('Shifts stay on their own day. Click the shift to change its times.', 'bad'); return; }
      const id = mem.drag.id; mem.drag = null;
      assign(id, td.dataset.staff || null);
    });
  };

  function assign(id, staffId) {
    const wk = UI.weekKey;
    const sc = Store.state.schedules[wk];
    const sh = sc.shifts.find((x) => x.id === id);
    if (!sh || sh.staffId === (staffId || null)) return;
    const who = staffId ? Store.staffById(staffId) : null;
    const why = who ? reasonFor(who, sh, sc.shifts.map((x) => (x.id === id ? { ...x, staffId } : x)), wk) : null;
    patchShift(id, { staffId: staffId || null });
    if (why) UI.toast(`${who.name}: ${why}. The problem is listed below.`, 'bad'); else UI.toast(who ? `Moved to ${who.name}` : 'Shift is now open', 'ok');
  }

  function patchShift(id, patch) {
    Store.update((s) => {
      const sc = s.schedules[UI.weekKey];
      const sh = sc.shifts.find((x) => x.id === id);
      if (sh) Object.assign(sh, patch);
      sc.edited = true;
    });
  }

  /* ======================= actions ======================= */
  UI.Acts['sched-gen'] = (el) => {
    const wk = UI.weekKey;
    if (el) el.disabled = true;
    setTimeout(() => {
      try {
        const opts = Sched.generate(Store.state, wk);
        mem.options[wk] = opts;
        mem.preview[wk] = opts.slice().sort((a, b) => optionRank(a) - optionRank(b))[0].key;
        UI.view = 'schedule';
        UI.render();
        UI.toast(`Built ${UI.plural(opts.length, 'option')}`, 'ok');
      } catch (e) { console.error(e); UI.toast('Could not build a schedule: ' + e.message, 'bad'); if (el) el.disabled = false; }
    }, 30);
  };
  UI.Acts['opt-preview'] = (el) => { mem.preview[UI.weekKey] = el.dataset.key; UI.rerender(); };
  UI.Acts['opt-cancel'] = () => { mem.preview[UI.weekKey] = null; UI.rerender(); };
  UI.Acts['opt-use'] = () => {
    const wk = UI.weekKey;
    const o = (mem.options[wk] || []).find((x) => x.key === mem.preview[wk]);
    if (!o) return;
    mem.preview[wk] = null; // before update(), which re-renders right away
    Store.update((s) => { s.schedules[wk] = { shifts: U.clone(o.shifts), optionName: o.name, savedAt: Date.now(), sig: sigOf(Sched.requirements(s, wk)), edited: false }; });
    UI.toast(`Saved ${o.name} as this week's schedule`, 'ok');
  };
  UI.Acts['sched-clear'] = async () => {
    if (await UI.confirm({ title: 'Clear this schedule?', message: 'The saved schedule for this week will be removed. Your events are not touched.', ok: 'Clear it', danger: true })) {
      mem.options[UI.weekKey] = null; mem.preview[UI.weekKey] = null;
      Store.update((s) => { delete s.schedules[UI.weekKey]; });
    }
  };
  UI.Acts['sched-print'] = () => window.print();
  UI.Acts['sched-copy'] = async () => {
    const st = Store.state, wk = UI.weekKey, sc = st.schedules[wk];
    if (!sc) return;
    const mins = Sched.weekMinutes(sc.shifts, wk);
    const lines = [`AV schedule, ${U.fmtWeek(wk)}`, ''];
    st.staff.forEach((s) => {
      const mine = sc.shifts.filter((x) => x.staffId === s.id).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
      if (!mine.length) return;
      lines.push(`${s.name} (${U.hrs(mins[s.id] || 0)})`);
      mine.forEach((x) => lines.push(`  ${U.fmtDay(x.date)}  ${U.fmtRange(x.start, x.end)}  ${roomLabel(st, x)}${x.kind === 'tech' ? ' (in-room tech)' : ''}`));
      lines.push('');
    });
    const open = sc.shifts.filter((x) => !x.staffId);
    if (open.length) { lines.push('OPEN'); open.forEach((x) => lines.push(`  ${U.fmtDay(x.date)}  ${U.fmtRange(x.start, x.end)}  ${roomLabel(st, x)}`)); }
    const text = lines.join('\n').trim();
    try { await navigator.clipboard.writeText(text); UI.toast('Schedule copied. Paste it into a text or email.', 'ok'); }
    catch (e) { UI.modal({ title: 'Copy the schedule', body: `<textarea class="in" style="min-height:260px" readonly>${esc(text)}</textarea>`, actions: [{ label: 'Done', cls: 'primary' }] }); }
  };

  /* ---------- shift editor ---------- */
  UI.Acts['sh-edit'] = (el) => {
    const sc = Store.state.schedules[UI.weekKey];
    const sh = sc && sc.shifts.find((x) => x.id === el.dataset.id);
    if (sh) openShift(sh);
  };
  UI.Acts['sh-add'] = (el) => {
    const st = Store.state;
    openShift({ id: null, staffId: el.dataset.staff || null, date: el.dataset.date, start: st.settings.defaultStart, end: U.fromMin(Math.min(1440, U.toMin(st.settings.defaultStart) + st.settings.minDayHrs * 60)), kind: 'coverage', eventIds: [], locked: false });
  };

  function openShift(sh) {
    const st = Store.state, wk = UI.weekKey;
    const isNew = !sh.id;
    const sc = st.schedules[wk] || { shifts: [] };
    const evs = (sh.eventIds || []).map((id) => st.events.find((e) => e.id === id)).filter(Boolean);
    const body = `<div class="form-grid" id="shf">
      <div class="span-12">${UI.field('Who', `<select class="in" name="staff"></select>`)}<div id="why" class="small" style="margin-top:6px"></div></div>
      <div class="span-4">${UI.field('Day', `<select class="in" name="date">${U.weekDates(wk).map((d) => UI.opt(d, U.fmtLong(d), d === sh.date)).join('')}</select>`)}</div>
      <div class="span-4 keep-half">${UI.field('Starts', `<input class="in" type="time" name="start" value="${sh.start}">`)}</div>
      <div class="span-4 keep-half">${UI.field('Ends', `<input class="in" type="time" name="end" value="${sh.end}">`)}</div>
      <div class="span-6">${UI.field('Type', `<select class="in" name="kind">${UI.opt('coverage', 'Room coverage', sh.kind !== 'tech')}${UI.opt('tech', 'In-room tech', sh.kind === 'tech')}</select>`)}</div>
      <div class="span-6" style="align-self:end"><label class="check"><span class="switch"><input type="checkbox" name="locked" ${sh.locked ? 'checked' : ''}><i></i></span> Lock this shift <span class="muted small" style="font-weight:500">(kept when you rebuild)</span></label></div>
      ${evs.length ? `<div class="span-12"><div class="small muted"><b style="color:var(--navy)">Covers:</b> ${evs.map((e) => `${esc(e.name)} in ${esc(UI.roomName(e.roomId))} (${U.fmtRange(e.start, e.end)})`).join('; ')}${sh.needStart ? `<br>Needed ${U.fmtRange(sh.needStart, sh.needEnd)} including your before/after buffers.` : ''}</div></div>` : ''}
    </div>`;
    const m = UI.modal({
      title: isNew ? 'Add a shift' : 'Edit shift', body,
      left: !isNew ? `<button class="btn danger sm" data-del>${ic('trash', 'sm')} Delete shift</button>` : '',
      actions: [{ label: 'Cancel' }, { label: isNew ? 'Add shift' : 'Save', cls: 'primary', icon: 'check', run: () => save() }],
      onMount: (mm) => {
        const el = mm.el;
        el.addEventListener('input', refresh); el.addEventListener('change', refresh);
        el.addEventListener('click', async (e) => {
          if (!e.target.closest('[data-del]')) return;
          mm.close();
          if (await UI.confirm({ title: 'Delete this shift?', message: 'The shift is removed from the schedule. Rebuild if you want it back.', ok: 'Delete', danger: true })) {
            Store.update((s) => { const c = s.schedules[wk]; c.shifts = c.shifts.filter((x) => x.id !== sh.id); c.edited = true; });
          }
        });
        refresh(null, true);
      },
    });

    function cur() {
      const v = UI.formVals(UI.$('#shf', m.el));
      return { staffId: v.staff || null, date: v.date, start: v.start, end: v.end, kind: v.kind, locked: !!v.locked };
    }
    function refresh(e, first) {
      const c = cur();
      const sel = UI.$('[name=staff]', m.el);
      const draft = Object.assign({}, sh, c, { id: sh.id || '__new' });
      const others = sc.shifts;
      if (first || (e && ['start', 'end', 'date', 'kind'].includes(e.target.name))) {
        const keep = first ? (sh.staffId || '') : sel.value;
        sel.innerHTML = UI.opt('', 'Unassigned (open shift)', !keep) + st.staff.filter((x) => x.active || x.id === sh.staffId).map((x) => {
          const r = U.toMin(draft.end) > U.toMin(draft.start) ? reasonFor(x, draft, others, wk) : null;
          return UI.opt(x.id, x.name + (r ? ` — ${r}` : ''), x.id === keep);
        }).join('');
      }
      const who = c.staffId ? Store.staffById(c.staffId) : null;
      const why = UI.$('#why', m.el);
      if (U.toMin(c.end) <= U.toMin(c.start)) why.innerHTML = `<span style="color:var(--bad)">${ic('alert', 'sm')} End time has to be after the start time.</span>`;
      else if (!who) why.innerHTML = '<span class="muted">Nobody assigned. It will show as an open shift.</span>';
      else {
        const r = reasonFor(who, draft, others, wk);
        why.innerHTML = r ? `<span style="color:var(--bad)">${ic('alert', 'sm')} ${esc(who.name)}: ${esc(r)}. You can still save it; the problem will be listed.</span>` : `<span style="color:var(--ok)">${ic('check', 'sm')} ${esc(who.name)} can work this without breaking a rule.</span>`;
      }
    }

    function save() {
      const c = cur();
      if (U.toMin(c.end) <= U.toMin(c.start)) { UI.toast('End time has to be after the start time', 'bad'); return false; }
      Store.update((s) => {
        let c2 = s.schedules[wk];
        if (!c2) c2 = s.schedules[wk] = { shifts: [], optionName: 'Custom', savedAt: Date.now(), sig: '', edited: true };
        if (isNew) c2.shifts.push({ id: U.uid('sh'), ...c, eventIds: [], needStart: c.start, needEnd: c.end });
        else Object.assign(c2.shifts.find((x) => x.id === sh.id), c);
        c2.edited = true;
      });
      UI.toast(isNew ? 'Shift added' : 'Shift updated', 'ok');
    }
  }

  /* ---------- PowerPoint dialog (used from Week and Schedule) ---------- */
  UI.Acts['pptx-open'] = () => {
    const st = Store.state;
    const keys = [...new Set(Store.allWeekKeys().concat([UI.weekKey]))].sort();
    UI.modal({
      title: 'Export to PowerPoint', narrow: true,
      body: `<div class="col" style="gap:14px">
        <div><div class="small" style="font-weight:700;color:var(--navy);margin-bottom:6px">Weeks to include</div>
          <div class="col" style="gap:6px;max-height:210px;overflow:auto">${keys.map((k) => `<label class="check"><input type="checkbox" name="wk" value="${k}" ${k === UI.weekKey ? 'checked' : ''}> ${esc(U.fmtWeek(k))} <span class="muted small" style="font-weight:500">${UI.plural(Store.eventsInWeek(k).length, 'event')}${st.schedules[k] ? ' · schedule saved' : ''}</span></label>`).join('')}</div></div>
        <label class="check"><span class="switch"><input type="checkbox" name="signs" checked><i></i></span> Add a room sign slide for each event</label>
        <div class="row wrap"><div class="seg" id="ppt-mode"><button type="button" class="on" data-m="edit">Editable text</button><button type="button" data-m="pic">Exact picture</button></div>
          <select class="in sm" name="theme" style="max-width:190px">${Object.entries(IH.Sign.THEMES).map(([k, t]) => UI.opt(k, t.label, k === st.settings.signTheme)).join('')}</select></div>
        <div class="small muted">Editable text lets you change words in PowerPoint. It uses the Montserrat font, so install it if signs look different. Exact picture looks identical to the PNG but can't be edited.</div></div>`,
      actions: [{ label: 'Cancel' }, {
        label: 'Download .pptx', cls: 'primary', icon: 'download',
        run: async (m, btn) => {
          const weekKeys = UI.$$('[name=wk]:checked', m.el).map((x) => x.value).sort();
          if (!weekKeys.length) { UI.toast('Pick at least one week', 'bad'); return false; }
          const mode = UI.$('#ppt-mode .on', m.el).dataset.m;
          btn.disabled = true;
          try {
            await IH.Sign.ready();
            await IH.Pptx.export(Store.state, { weekKeys, includeSigns: UI.$('[name=signs]', m.el).checked, signTheme: UI.$('[name=theme]', m.el).value, signAsImage: mode === 'pic' });
            UI.toast('PowerPoint downloaded', 'ok');
          } catch (e) { console.error(e); UI.toast('Could not build the PowerPoint: ' + e.message, 'bad'); btn.disabled = false; return false; }
        },
      }],
      onMount: (m) => { UI.$('#ppt-mode', m.el).onclick = (e) => { const b = e.target.closest('button'); if (!b) return; UI.$$('#ppt-mode button', m.el).forEach((x) => x.classList.toggle('on', x === b)); }; },
    });
  };
  UI.Acts['week-pptx'] = UI.Acts['pptx-open'];
})(typeof window !== 'undefined' ? window : globalThis);
