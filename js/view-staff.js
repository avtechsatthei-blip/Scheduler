/* Staff: cards + editor (hours, availability windows, days off) */
(function (root) {
  const IH = root.IH, U = IH.U, UI = IH.UI, Store = IH.Store;
  const { esc, icon: ic } = UI;

  const dayOrder = () => { const w = Store.state.settings.weekStart; return [0, 1, 2, 3, 4, 5, 6].map((i) => (i + w) % 7); };

  function windowText(s) {
    const on = dayOrder().filter((d) => s.avail[d] && s.avail[d].on !== false);
    if (!on.length) return 'No days available';
    const wins = new Set(on.map((d) => `${s.avail[d].from || ''}|${s.avail[d].to || ''}`));
    if (wins.size === 1) {
      const [f, t] = [...wins][0].split('|');
      if (!f && !t) return 'Any hours';
      return `Prefers ${f ? U.fmtTime(f) : 'open'}–${t ? U.fmtTime(t) : 'close'}`;
    }
    return 'Hours vary by day';
  }

  UI.Views.staff = {
    title: 'Staff',
    render() {
      const st = Store.state;
      const top = UI.pageTop('Staff', 'Who can work when', `<button class="btn primary" data-act="staff-new">${ic('plus', 'sm')} Add staff</button>`);
      if (!st.staff.length) {
        return top + `<div class="card pad empty"><h3>No staff yet</h3><p>Add each person once: their weekly hours, the days and times they like to work, and any days off. The scheduler uses all of it.</p>
          <div class="row" style="justify-content:center"><button class="btn primary" data-act="staff-new">${ic('plus', 'sm')} Add staff</button></div></div>`;
      }
      const today = U.today();
      return top + `<div class="cards">${st.staff.map((s) => {
        const offs = (s.daysOff || []).filter((d) => (d.end || d.start) >= today);
        return `<div class="card pcard ${s.active ? '' : 'off'}" data-act="staff-edit" data-id="${s.id}">
          <div class="row"><span class="avatar" style="background:${s.color}">${esc(UI.initials(s.name))}</span>
            <div class="grow"><div class="nm">${esc(s.name)}</div><div class="small muted">${esc(s.role || '')}${s.active ? '' : ' · inactive'}</div></div>
            ${s.canTech === false ? '<span class="tag gray" title="Not scheduled for in-room tech shifts">no tech</span>' : ''}</div>
          <div class="days7">${dayOrder().map((d) => `<span class="${s.avail[d] && s.avail[d].on !== false ? 'on' : ''}" title="${U.DOWL[d]}">${U.DOW[d][0]}</span>`).join('')}</div>
          <div style="margin-top:10px">
            <div class="kv"><span class="muted">Weekly hours</span><b>${s.minWeek || 0}–${s.maxWeek || st.settings.maxWeekHrs}h</b></div>
            <div class="kv"><span class="muted">Preferred</span><b>${esc(windowText(s))}</b></div>
            <div class="kv"><span class="muted">Days off coming up</span><b>${offs.length || 'None'}</b></div></div></div>`;
      }).join('')}</div>`;
    },
  };
  UI.Acts['staff-new'] = () => openEditor(null);
  UI.Acts['staff-edit'] = (el) => { const s = Store.staffById(el.dataset.id); if (s) openEditor(s); };

  function openEditor(existing) {
    const st = Store.state;
    const isNew = !existing;
    const color0 = U.STAFF_COLORS[st.staff.length % U.STAFF_COLORS.length];
    const s0 = existing ? U.clone(existing) : Store.newStaff({ name: '', color: color0, minWeek: 0, maxWeek: null });
    let color = s0.color;
    let off = (s0.daysOff || []).map((d) => ({ ...d }));

    const availRows = dayOrder().map((d) => {
      const a = s0.avail[d] || { on: true, from: '', to: '' };
      return `<label class="check" style="font-weight:700">${U.DOWL[d].slice(0, 3)}</label>
        <span class="switch"><input type="checkbox" name="on${d}" ${a.on !== false ? 'checked' : ''}><i></i></span>
        <input class="in sm" type="time" name="from${d}" value="${a.from || ''}" aria-label="${U.DOWL[d]} earliest">
        <input class="in sm" type="time" name="to${d}" value="${a.to || ''}" aria-label="${U.DOWL[d]} latest">`;
    }).join('');

    const body = `<div class="form-grid" id="stf">
      <div class="span-6">${UI.field('Name', `<input class="in" name="name" value="${esc(s0.name)}" placeholder="Full name" autocomplete="off">`)}</div>
      <div class="span-6">${UI.field('Role', `<input class="in" name="role" value="${esc(s0.role || '')}" placeholder="AV tech, Lead, Student…">`)}</div>
      <div class="span-12"><div class="small" style="font-weight:700;color:var(--navy);margin-bottom:6px">Color on the schedule</div>
        <div class="swatches" id="sw">${U.STAFF_COLORS.map((c) => `<button type="button" data-c="${c}" style="background:${c}" class="${c === color ? 'on' : ''}" aria-label="Color ${c}"></button>`).join('')}</div></div>
      <div class="span-4 keep-half">${UI.field('Weekly minimum (hours)', `<input class="in" type="number" min="0" max="80" step="0.5" name="minWeek" value="${s0.minWeek || 0}">`, 'The scheduler tries to reach this')}</div>
      <div class="span-4 keep-half">${UI.field('Weekly maximum (hours)', `<input class="in" type="number" min="0" max="80" step="0.5" name="maxWeek" value="${s0.maxWeek || ''}" placeholder="${st.settings.maxWeekHrs}">`, 'Blank uses the default')}</div>
      <div class="span-4" style="align-self:end"><div class="col" style="gap:8px"><label class="check"><span class="switch"><input type="checkbox" name="active" ${s0.active !== false ? 'checked' : ''}><i></i></span> Active</label>
        <label class="check"><span class="switch"><input type="checkbox" name="canTech" ${s0.canTech !== false ? 'checked' : ''}><i></i></span> Can be an in-room tech</label></div></div>
      <div class="span-12"><hr class="hr" style="margin:0 0 8px">
        <div class="row"><h3 style="font-size:14px">Days and hours they like to work</h3><span class="grow"></span><button class="btn xs" type="button" id="copyall">Copy the first row to every day</button></div>
        <div class="small muted" style="margin:4px 0 10px">Turn a day off if they can never work it. Times are a preference: the scheduler tries to stay inside them and only goes outside when it has to. Leave blank for any time.</div>
        <div class="availgrid"><span></span><span></span><span class="tiny muted">Earliest</span><span class="tiny muted">Latest</span>${availRows}</div></div>
      <div class="span-12"><hr class="hr" style="margin:0 0 8px"><h3 style="font-size:14px">Days off (hard rule, never scheduled)</h3>
        <div id="offlist" style="margin:8px 0"></div>
        <div class="row wrap" style="align-items:flex-end;gap:8px"><label class="f">From<input class="in sm" type="date" id="off-s"></label><label class="f">To <span class="hint">(optional)</span><input class="in sm" type="date" id="off-e"></label>
          <label class="f grow">Note<input class="in sm" id="off-n" placeholder="Vacation, class, appointment…"></label><button class="btn sm" type="button" id="off-add">${ic('plus', 'sm')} Add</button></div></div>
      <div class="span-12">${UI.field('Notes', `<textarea class="in" name="notes" style="min-height:52px">${esc(s0.notes || '')}</textarea>`)}</div>
    </div>`;

    const m = UI.modal({
      title: isNew ? 'Add staff' : s0.name, body,
      left: !isNew ? `<button class="btn danger sm" data-del>${ic('trash', 'sm')} Delete</button>` : '',
      actions: [{ label: 'Cancel' }, { label: isNew ? 'Add staff' : 'Save changes', cls: 'primary', icon: 'check', run: () => save() }],
      onMount: (mm) => {
        const el = mm.el;
        drawOff();
        UI.$('#sw', el).onclick = (e) => { const b = e.target.closest('button'); if (!b) return; color = b.dataset.c; UI.$$('#sw button', el).forEach((x) => x.classList.toggle('on', x === b)); };
        UI.$('#copyall', el).onclick = () => {
          const first = dayOrder()[0];
          const on = UI.$(`[name=on${first}]`, el).checked, f = UI.$(`[name=from${first}]`, el).value, t = UI.$(`[name=to${first}]`, el).value;
          dayOrder().forEach((d) => { UI.$(`[name=on${d}]`, el).checked = on; UI.$(`[name=from${d}]`, el).value = f; UI.$(`[name=to${d}]`, el).value = t; });
        };
        UI.$('#off-add', el).onclick = () => {
          const s = UI.$('#off-s', el).value, e = UI.$('#off-e', el).value || s;
          if (!s) { UI.toast('Pick the first day off', 'bad'); return; }
          if (e < s) { UI.toast('The last day is before the first day', 'bad'); return; }
          off.push({ id: U.uid('off'), start: s, end: e, note: UI.$('#off-n', el).value.trim() });
          off.sort((a, b) => a.start.localeCompare(b.start));
          UI.$('#off-s', el).value = UI.$('#off-e', el).value = UI.$('#off-n', el).value = '';
          drawOff();
        };
        el.addEventListener('click', (e) => {
          const rm = e.target.closest('[data-rmoff]');
          if (rm) { off = off.filter((x) => x.id !== rm.dataset.rmoff); drawOff(); }
          if (e.target.closest('[data-del]')) { mm.close(); confirmDelete(existing); }
        });
      },
    });

    function drawOff() {
      UI.$('#offlist', m.el).innerHTML = off.length
        ? off.map((d) => `<span class="chip x" style="margin:0 6px 6px 0">${d.start === d.end ? U.fmtLong(d.start) : U.fmtDay(d.start) + ' – ' + U.fmtDay(d.end)}${d.note ? ' · ' + esc(d.note) : ''}<button type="button" data-rmoff="${d.id}" aria-label="Remove">${ic('x', 'sm')}</button></span>`).join('')
        : '<span class="muted small">None entered.</span>';
    }

    function save() {
      const v = UI.formVals(UI.$('#stf', m.el));
      if (!v.name.trim()) { UI.toast('Add a name', 'bad'); UI.$('[name=name]', m.el).focus(); return false; }
      const avail = {};
      for (let d = 0; d < 7; d++) avail[d] = { on: !!v['on' + d], from: v['from' + d] || '', to: v['to' + d] || '' };
      const min = Math.max(0, +v.minWeek || 0), max = v.maxWeek === '' ? null : Math.max(0, +v.maxWeek || 0);
      if (max && min > max) { UI.toast('The weekly minimum is higher than the maximum', 'bad'); return false; }
      Store.update((s) => {
        const rec = Object.assign({}, s0, { name: v.name.trim(), role: v.role.trim(), color, minWeek: min, maxWeek: max, active: !!v.active, canTech: !!v.canTech, avail, daysOff: off, notes: v.notes.trim() });
        const i = s.staff.findIndex((x) => x.id === rec.id);
        if (i >= 0) s.staff[i] = rec; else s.staff.push(rec);
      });
      UI.toast(isNew ? 'Staff added' : 'Saved', 'ok');
    }
  }

  async function confirmDelete(s) {
    const shifts = Object.values(Store.state.schedules).reduce((a, sc) => a + sc.shifts.filter((x) => x.staffId === s.id).length, 0);
    const ok = await UI.confirm({ title: `Delete ${esc(s.name)}?`, ok: 'Delete', danger: true, message: `${shifts ? `They have ${UI.plural(shifts, 'saved shift')}, which will become open shifts. ` : ''}You can also just mark them inactive to keep their history.` });
    if (!ok) return;
    Store.update((st) => {
      st.staff = st.staff.filter((x) => x.id !== s.id);
      Object.values(st.schedules).forEach((sc) => sc.shifts.forEach((x) => { if (x.staffId === s.id) x.staffId = null; }));
    });
    UI.toast('Staff deleted');
  }
})(typeof window !== 'undefined' ? window : globalThis);
