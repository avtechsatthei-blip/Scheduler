/* Events: list, add/edit, and PDF import */
(function (root) {
  const IH = root.IH, U = IH.U, UI = IH.UI, Store = IH.Store;
  const { esc, icon: ic } = UI;
  const mem = (UI.mem.events = UI.mem.events || { scope: 'week', q: '' });

  /* ======================= list ======================= */
  UI.Views.events = {
    title: 'Events',
    render() {
      const st = Store.state;
      let list = st.events.slice();
      if (mem.scope === 'week') { const set = new Set(U.weekDates(UI.weekKey)); list = list.filter((e) => set.has(e.date)); }
      else if (mem.scope === 'upcoming') list = list.filter((e) => e.date >= U.today());
      const q = mem.q.trim().toLowerCase();
      if (q) list = list.filter((e) => (e.name + ' ' + UI.roomName(e.roomId) + ' ' + (e.contact || '')).toLowerCase().includes(q));
      list.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start) || a.name.localeCompare(b.name));
      const groups = {};
      list.forEach((e) => (groups[e.date] = groups[e.date] || []).push(e));

      const top = UI.pageTop('Events', 'Everything on the calendar',
        `${mem.scope === 'week' ? UI.weekNav() : ''}<button class="btn" data-act="import-open">${ic('upload', 'sm')} Import PDF</button><button class="btn primary" data-act="ev-new">${ic('plus', 'sm')} Add event</button>`);
      const bar = `<div class="row wrap noprint" style="margin-bottom:16px">
        <div class="seg">${[['week', 'This week'], ['upcoming', 'Upcoming'], ['all', 'All']].map(([k, l]) => `<button class="${mem.scope === k ? 'on' : ''}" data-act="ev-scope" data-scope="${k}">${l}</button>`).join('')}</div>
        <input class="in sm" style="max-width:260px" placeholder="Search name, room or contact" value="${esc(mem.q)}" data-input="ev-search" id="ev-q">
        <span class="muted small">${UI.plural(list.length, 'event')}</span></div>`;

      if (!list.length) {
        return top + bar + `<div class="card pad empty"><h3>${st.events.length ? 'Nothing matches' : 'No events yet'}</h3>
          <p>${st.events.length ? 'Try another week or clear the search.' : 'Add an event by hand, or import an event-sheet PDF and review the drafts it builds.'}</p>
          <div class="row" style="justify-content:center"><button class="btn primary" data-act="ev-new">${ic('plus', 'sm')} Add event</button><button class="btn" data-act="import-open">${ic('upload', 'sm')} Import PDF</button></div></div>`;
      }
      return top + bar + Object.keys(groups).sort().map((d) => `<div class="daygroup"><h4>${U.fmtLong(d)} <small>${UI.plural(groups[d].length, 'event')}</small></h4>
        <div class="card">${groups[d].map((e) => {
          const rc = UI.roomColor(e.roomId);
          return `<div class="erow"><div class="tm">${U.fmtRange(e.start, e.end)}</div>
            <div><div class="nm">${esc(e.name)} ${e.review ? '<span class="tag warn" title="' + esc(e.review) + '">Review</span>' : ''}</div><div class="small muted">${[e.contact, e.attendees ? e.attendees + ' guests' : '', e.setup].filter(Boolean).map(esc).join(' · ')}</div></div>
            <div><span class="roompill" style="--rc:${rc}">${esc(UI.roomName(e.roomId))}</span></div>
            <div class="avs small">${e.noAV ? '<span class="tag gray">No AV</span>' : esc(UI.itemsText(e))} ${e.tech && e.tech.count ? `<span class="tag navy">${e.tech.count}× tech</span>` : ''}</div>
            <div class="acts noprint"><button class="btn ghost icon sm" data-act="sign-for" data-id="${e.id}" title="Room sign">${ic('image', 'sm')}</button><button class="btn ghost icon sm" data-act="ev-dup" data-id="${e.id}" title="Duplicate">${ic('copy', 'sm')}</button><button class="btn ghost icon sm" data-act="ev-edit" data-id="${e.id}" title="Edit">${ic('edit', 'sm')}</button><button class="btn ghost icon sm danger" data-act="ev-del" data-id="${e.id}" title="Delete">${ic('trash', 'sm')}</button></div></div>`;
        }).join('')}</div></div>`).join('');
    },
  };
  UI.Acts['ev-scope'] = (el) => { mem.scope = el.dataset.scope; UI.render(); };
  UI.Changes['ev-search'] = (el) => {
    mem.q = el.value;
    const pos = el.selectionStart;
    UI.render();
    const n = UI.$('#ev-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
  };
  UI.Acts['ev-del'] = async (el) => {
    const ev = Store.state.events.find((e) => e.id === el.dataset.id);
    if (!ev) return;
    if (await UI.confirm({ title: 'Delete event?', message: `Remove <b>${esc(ev.name)}</b> (${esc(UI.roomName(ev.roomId))}, ${U.fmtDay(ev.date)})? Shifts already saved for it stay on the schedule until you rebuild.`, ok: 'Delete', danger: true })) {
      Store.update((s) => { s.events = s.events.filter((e) => e.id !== ev.id); });
      UI.toast('Event deleted');
    }
  };
  UI.Acts['ev-new'] = (el) => openEditor(null, { date: (el && el.dataset && el.dataset.date) || defaultDate() });
  UI.Acts['ev-edit'] = (el) => { const ev = Store.state.events.find((e) => e.id === el.dataset.id); if (ev) openEditor(ev); };
  UI.Acts['ev-dup'] = (el) => {
    const ev = Store.state.events.find((e) => e.id === el.dataset.id);
    if (!ev) return;
    const c = U.clone(ev); c.id = null; delete c.review; c.source = 'manual';
    openEditor(null, c, true);
  };
  UI.Acts['sign-for'] = (el) => { UI.mem.signPick = el.dataset.id; UI.go('signs'); };
  function defaultDate() { const wk = UI.weekKey; const t = U.today(); return U.weekDates(wk).includes(t) ? t : wk; }

  /* ======================= editor ======================= */
  function openEditor(ev, defaults, isDup) {
    const st = Store.state;
    const isNew = !ev;
    const base = ev ? U.clone(ev) : Object.assign({ name: '', roomId: (st.rooms[0] || {}).id, date: defaultDate(), start: st.settings.defaultStart, end: st.settings.defaultEnd, items: [], tech: { count: 0, start: '', end: '' }, noAV: false, attendees: '', contact: '', setup: '', notes: '' }, defaults || {});
    base.tech = Object.assign({ count: 0, start: '', end: '' }, base.tech || {});
    let items = (base.items || []).map((i) => ({ ...i }));
    let fromKit = isNew && !isDup && !items.length;
    if (isNew && !isDup && !items.length && base.roomId) items = kitOf(base.roomId);
    const invNames = () => [...new Set(st.inventory.map((i) => i.name).concat(st.rooms.flatMap((r) => r.items.map((i) => i.name))))].sort();
    const roomOpts = st.rooms.map((r) => UI.opt(r.id, r.name, r.id === base.roomId)).join('') + '<option value="__new">＋ Add a new room…</option>';

    const body = `<div class="form-grid" id="evf">
      <div class="span-12">${UI.field('Event name', `<input class="in" name="name" value="${esc(base.name)}" placeholder="e.g. Market 37 Wealth Management Workshop" autocomplete="off">`)}</div>
      <div class="span-4">${UI.field('Date', `<input class="in" type="date" name="date" value="${base.date}">`)}</div>
      <div class="span-4 keep-half">${UI.field('Starts', `<input class="in" type="time" name="start" value="${base.start}">`)}</div>
      <div class="span-4 keep-half">${UI.field('Ends', `<input class="in" type="time" name="end" value="${base.end}">`)}</div>
      <div class="span-6">${UI.field('Room', `<select class="in" name="room">${roomOpts}</select>`)}
        <div id="newroom" class="hide" style="margin-top:8px"><input class="in" name="newRoomName" placeholder="New room name">
        <label class="check small" style="margin-top:6px"><input type="checkbox" name="newRoomKit" checked> Save this event's AV items as the room's standard kit</label></div></div>
      <div class="span-3 keep-half">${UI.field('Guests', `<input class="in" type="number" min="0" name="attendees" value="${esc(base.attendees || '')}">`)}</div>
      <div class="span-3 keep-half">${UI.field('Contact', `<input class="in" name="contact" value="${esc(base.contact || '')}">`)}</div>
      <div class="span-12"><hr class="hr" style="margin:2px 0 6px">
        <div class="row"><h3 style="font-size:14px">AV items in the room</h3><span class="grow"></span>
          <label class="check small"><span class="switch"><input type="checkbox" name="noAV" ${base.noAV ? 'checked' : ''}><i></i></span> No AV needed</label></div>
        <div id="avbox" style="margin-top:10px"></div></div>
      <div class="span-12"><div class="row wrap" style="gap:18px">
        <div><div class="small" style="font-weight:700;color:var(--navy);margin-bottom:5px">In-room tech <span class="muted" style="font-weight:500">(an extra person for the event)</span></div>
          <div class="row"><button class="btn icon sm" type="button" data-step="-1">−</button><input class="in num" type="number" min="0" max="9" name="techCount" value="${base.tech.count || 0}" style="text-align:center"><button class="btn icon sm" type="button" data-step="1">+</button></div></div>
        <div id="techtimes" class="row wrap ${base.tech.count ? '' : 'hide'}" style="gap:10px;align-items:flex-end">
          <label class="check small"><input type="checkbox" name="techPart" ${base.tech.start || base.tech.end ? 'checked' : ''}> Only part of the event</label>
          <div id="techpart" class="row ${base.tech.start || base.tech.end ? '' : 'hide'}">${UI.field('From', `<input class="in sm" type="time" name="techStart" value="${base.tech.start || ''}">`)}${UI.field('To', `<input class="in sm" type="time" name="techEnd" value="${base.tech.end || ''}">`)}</div></div></div></div>
      <div class="span-6">${UI.field('Room setup', `<input class="in" name="setup" value="${esc(base.setup || '')}" placeholder="e.g. 18 rounds of 10">`)}</div>
      <div class="span-6">${UI.field('Notes', `<textarea class="in" name="notes" style="min-height:44px" placeholder="Agenda, load-in, special asks">${esc(base.notes || '')}</textarea>`)}</div>
      ${base.review ? `<div class="span-12"><div class="callout warn">${ic('alert')}<div><b>Imported from a PDF, please check:</b> ${esc(base.review)}</div></div></div>` : ''}
      ${isNew ? `<div class="span-12"><label class="check small"><span>Also create the same event on the next</span> <input class="in sm num" type="number" min="0" max="6" name="repeat" value="0" style="max-width:56px"> <span>days</span></label></div>` : ''}
      <div class="span-12"><div id="livecheck"></div></div>
      <datalist id="dl-items">${invNames().map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    </div>`;

    const m = UI.modal({
      title: isNew ? 'Add event' : 'Edit event', body,
      left: !isNew ? `<button class="btn danger sm" data-del>${ic('trash', 'sm')} Delete</button>` : '',
      actions: [{ label: 'Cancel' }, { label: isNew ? 'Add event' : 'Save changes', cls: 'primary', icon: 'check', run: (mm) => save(mm) }],
      onMount: (mm) => mount(mm),
    });

    function kitOf(roomId) { const r = Store.room(roomId); return r ? r.items.map((i) => ({ name: i.name, qty: i.qty, builtIn: !!i.builtIn })) : []; }

    function drawItems() {
      const box = UI.$('#avbox', m.el);
      const off = UI.$('[name=noAV]', m.el).checked;
      const have = new Set(items.map((i) => U.itemKey(i.name)));
      const quick = st.inventory.filter((i) => !have.has(U.itemKey(i.name))).slice(0, 9);
      box.style.opacity = off ? 0.4 : 1;
      box.style.pointerEvents = off ? 'none' : '';
      box.innerHTML = `${items.length ? `<div class="col" style="gap:6px">${items.map((it, i) => `<div class="row"><input class="in sm" list="dl-items" data-i="${i}" data-k="name" value="${esc(it.name)}" placeholder="Item">
          <input class="in sm num" type="number" min="1" data-i="${i}" data-k="qty" value="${it.qty || 1}" style="max-width:74px">
          ${it.builtIn ? '<span class="tag gray" title="Installed in the room, so it does not use your inventory">installed</span>' : ''}
          <button class="btn ghost icon sm danger" type="button" data-rm="${i}" title="Remove">${ic('x', 'sm')}</button></div>`).join('')}</div>` : '<div class="muted small">No items yet.</div>'}
        <div class="row wrap" style="margin-top:10px;gap:6px"><button class="btn sm" type="button" data-addrow>${ic('plus', 'sm')} Add item</button>
          <button class="btn sm" type="button" data-kit>${ic('refresh', 'sm')} Use room's standard kit</button>
          ${quick.map((q) => `<button class="chip" type="button" data-quick="${esc(q.name)}" style="cursor:pointer">+ ${esc(q.name)}</button>`).join('')}</div>`;
      liveCheck();
    }

    function collect() {
      const v = UI.formVals(UI.$('#evf', m.el));
      const clean = items.filter((i) => String(i.name).trim()).map((i) => ({ name: String(i.name).trim(), qty: Math.max(1, +i.qty || 1), builtIn: !!i.builtIn }));
      return {
        name: v.name.trim(), date: v.date, start: v.start, end: v.end, roomSel: v.room, newRoomName: (v.newRoomName || '').trim(), newRoomKit: v.newRoomKit,
        items: v.noAV ? [] : clean, noAV: !!v.noAV,
        tech: { count: v.noAV ? 0 : Math.max(0, +v.techCount || 0), start: v.techPart ? v.techStart : '', end: v.techPart ? v.techEnd : '' },
        attendees: v.attendees === '' ? '' : +v.attendees, contact: v.contact.trim(), setup: v.setup.trim(), notes: v.notes.trim(), repeat: Math.max(0, Math.min(6, +v.repeat || 0)),
      };
    }

    function liveCheck() {
      const box = UI.$('#livecheck', m.el);
      if (!box) return;
      const c = collect();
      if (!c.date) { box.innerHTML = ''; return; }
      const id = ev ? ev.id : '__draft';
      const hyp = { id, name: c.name || 'This event', roomId: c.roomSel, date: c.date, start: c.start || '08:00', end: c.end || '17:00', items: c.items, tech: c.tech, noAV: c.noAV };
      const tmp = Object.assign({}, st, { events: st.events.filter((e) => e.id !== id).concat([hyp]) });
      const r = IH.Inv.analyze(tmp, Store.weekKeyFor(c.date));
      const mine = new Set(c.items.map((i) => U.itemKey(i.name)));
      const rel = r.alerts.filter((a) => a.date === c.date && mine.has(U.itemKey(a.item)));
      if (!c.items.length) { box.innerHTML = ''; return; }
      if (!rel.length) box.innerHTML = `<div class="callout ok">${ic('check')}<div>Equipment is fine for ${U.fmtDay(c.date)}. Your stock covers everything at the busiest moment.</div></div>`;
      else box.innerHTML = `<div class="col" style="gap:8px">${rel.map((a) => `<div class="callout ${a.level === 'short' ? 'bad' : 'warn'}">${ic('alert')}<div>${esc(a.text)}${a.events.length > 1 ? `<div class="small" style="opacity:.8">Also in use by: ${esc(a.events.filter((n) => !n.startsWith(hyp.name)).join(', ') || '—')}</div>` : ''}</div></div>`).join('')}</div>`;
    }

    function mount(mm) {
      const el = mm.el;
      const sel = UI.$('[name=room]', el);
      const applyRoom = () => {
        UI.$('#newroom', el).classList.toggle('hide', sel.value !== '__new');
        if (sel.value !== '__new' && fromKit) { items = kitOf(sel.value); drawItems(); }
        liveCheck();
      };
      sel.onchange = applyRoom;
      el.addEventListener('input', (e) => {
        const t = e.target;
        if (t.dataset && t.dataset.k) { items[+t.dataset.i][t.dataset.k] = t.dataset.k === 'qty' ? +t.value : t.value; fromKit = false; }
        if (t.name === 'techCount') UI.$('#techtimes', el).classList.toggle('hide', !(+t.value > 0));
        liveCheck();
      });
      el.addEventListener('change', (e) => {
        const t = e.target;
        if (t.name === 'noAV') drawItems();
        if (t.name === 'techPart') UI.$('#techpart', el).classList.toggle('hide', !t.checked);
        if (t.name === 'date' || t.name === 'start' || t.name === 'end') liveCheck();
      });
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.step) { const n = UI.$('[name=techCount]', el); n.value = Math.max(0, Math.min(9, (+n.value || 0) + +b.dataset.step)); n.dispatchEvent(new Event('input', { bubbles: true })); }
        if (b.dataset.rm != null && b.hasAttribute('data-rm')) { items.splice(+b.dataset.rm, 1); fromKit = false; drawItems(); }
        if (b.hasAttribute('data-addrow')) { items.push({ name: '', qty: 1, builtIn: false }); fromKit = false; drawItems(); const ins = UI.$$('[data-k=name]', el); ins[ins.length - 1].focus(); }
        if (b.hasAttribute('data-kit')) { items = kitOf(sel.value); fromKit = true; drawItems(); }
        if (b.dataset.quick) { items.push({ name: b.dataset.quick, qty: 1, builtIn: false }); fromKit = false; drawItems(); }
        if (b.hasAttribute('data-del')) {
          mm.close();
          UI.Acts['ev-del']({ dataset: { id: ev.id } });
        }
      });
      drawItems();
      applyRoom();
    }

    async function save(mm) {
      const c = collect();
      if (!c.name) { UI.toast('Give the event a name', 'bad'); UI.$('[name=name]', mm.el).focus(); return false; }
      if (!c.date) { UI.toast('Pick a date', 'bad'); return false; }
      if (U.toMin(c.end) <= U.toMin(c.start)) { UI.toast('End time has to be after the start time', 'bad'); return false; }
      if (c.roomSel === '__new' && !c.newRoomName) { UI.toast('Name the new room', 'bad'); UI.$('[name=newRoomName]', mm.el).focus(); return false; }
      Store.update((s) => {
        let roomId = c.roomSel;
        if (roomId === '__new') {
          const ex = Store.findRoomByName(c.newRoomName);
          if (ex) roomId = ex.id;
          else {
            roomId = U.uid('r');
            s.rooms.push({ id: roomId, name: c.newRoomName, aliases: [], items: c.newRoomKit ? c.items.map((i) => ({ name: i.name, qty: i.qty, builtIn: false })) : [], notes: '' });
          }
        }
        const mk = (date) => ({
          id: U.uid('ev'), name: c.name, roomId, date, start: c.start, end: c.end, items: U.clone(c.items), tech: U.clone(c.tech), noAV: c.noAV,
          attendees: c.attendees, contact: c.contact, setup: c.setup, notes: c.notes, source: 'manual',
        });
        if (ev) {
          const i = s.events.findIndex((e) => e.id === ev.id);
          if (i >= 0) { const upd = Object.assign({}, s.events[i], mk(c.date), { id: ev.id, source: ev.source || 'manual' }); delete upd.review; s.events[i] = upd; }
        } else {
          s.events.push(mk(c.date));
          for (let d = 1; d <= c.repeat; d++) s.events.push(mk(U.addDays(c.date, d)));
        }
      });
      UI.toast(ev ? 'Event updated' : c.repeat ? `Added ${c.repeat + 1} events` : 'Event added', 'ok');
      if (Store.weekKeyFor(c.date) !== UI.weekKey && UI.view !== 'events') UI.setWeek(c.date);
    }
  }
  UI.openEventEditor = openEditor;

  /* ======================= PDF import ======================= */
  UI.Acts['import-open'] = () => openImport();
  function openImport(preloadPages) {
    const st = Store.state;
    let drafts = [], warnings = [];
    const m = UI.modal({
      title: 'Import events from a PDF', wide: true, dismiss: false,
      body: `<div id="imp-step1">
          <label class="drop" id="drop"><input type="file" id="imp-file" accept="application/pdf" multiple>${ic('upload', 'lg')}<b>Drop an event-sheet PDF here, or click to choose</b>
            <span class="muted small">Floor plans and Notes pages are both read. Nothing leaves your computer except the reader libraries downloading once.</span></label>
          <div class="row" style="margin-top:14px"><label class="check"><input type="checkbox" id="imp-ocr" checked> Also read the floor-plan pages (finds start/end times and in-room tech counts)</label></div>
          <div class="small muted" style="margin-top:4px">Reading floor plans takes about a second a page once the text reader has downloaded (a one-time wait, and it needs an internet connection). Turn it off to import from the Notes pages only.</div>
          <div id="imp-prog" class="hide" style="margin-top:18px"><div class="progress"><i></i></div><div class="small muted" style="margin-top:6px" id="imp-msg"></div></div></div>
        <div id="imp-step2" class="hide"></div>`,
      actions: [{ label: 'Close' }, { label: 'Add selected events', cls: 'primary hide', icon: 'check', run: (mm) => commit(mm) }],
      onMount: (mm) => {
        const fi = UI.$('#imp-file', mm.el), drop = UI.$('#drop', mm.el);
        fi.onchange = () => run([...fi.files]);
        ['dragover', 'dragenter'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add('over'); }));
        ['dragleave', 'drop'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
        drop.addEventListener('drop', (e) => { const fs = [...e.dataTransfer.files].filter((f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)); if (fs.length) run(fs); });
        mm.el.addEventListener('input', onEdit); mm.el.addEventListener('change', onEdit);
        if (preloadPages) review(preloadPages);
      },
    });
    const addBtn = () => UI.$$('.df .btn', m.el).find((b) => b.classList.contains('primary'));

    async function run(files) {
      const ocr = UI.$('#imp-ocr', m.el).checked;
      UI.$('#imp-prog', m.el).classList.remove('hide');
      const bar = UI.$('.progress i', m.el), msg = UI.$('#imp-msg', m.el);
      try {
        let all = [];
        for (const f of files) {
          const pages = await IH.Imp.readPdf(f, { ocr, onProgress: (t, p) => { msg.textContent = (files.length > 1 ? f.name + ': ' : '') + t; bar.style.width = Math.round(p * 100) + '%'; } });
          all.push(pages);
        }
        review(all.flatMap((p) => [p]));
      } catch (e) {
        console.error(e);
        msg.innerHTML = `<span style="color:var(--bad)">${esc(e.message || 'Could not read that PDF.')}</span>`;
      }
    }

    function review(pageSets) {
      // pageSets: an array of page arrays (one per PDF) or a single page array
      const sets = Array.isArray(pageSets[0]) ? pageSets : [pageSets];
      drafts = []; warnings = [];
      sets.forEach((pages) => {
        const r = IH.Imp.parse(pages, { defaultStart: st.settings.defaultStart, defaultEnd: st.settings.defaultEnd });
        warnings = warnings.concat(r.warnings);
        drafts = drafts.concat(IH.Imp.finalize(r.drafts, Store.state, Store.findRoomByName));
      });
      drafts.forEach((d, i) => { d._i = i; d.roomSel = d.roomId || '__new'; });
      UI.$('#imp-step1', m.el).classList.add('hide');
      const s2 = UI.$('#imp-step2', m.el);
      s2.classList.remove('hide');
      addBtn().classList.remove('hide');
      draw();
    }

    function draw() {
      const s2 = UI.$('#imp-step2', m.el);
      if (!drafts.length) {
        s2.innerHTML = `<div class="empty"><h3>Nothing found</h3><p>I couldn't find any room and date footers in that file.${warnings.length ? '<br>' + warnings.map(esc).join('<br>') : ''}</p><button class="btn" data-act="import-again">Try another file</button></div>`;
        addBtn().classList.add('hide');
        return;
      }
      const roomOpts = (d) => Store.state.rooms.map((r) => UI.opt(r.id, r.name, d.roomSel === r.id)).join('') + UI.opt('__new', `＋ New room: ${d.roomName}`, d.roomSel === '__new');
      const n = drafts.filter((d) => d.include).length;
      s2.innerHTML = `<div class="callout info" style="margin-bottom:14px">${ic('info')}<div>Found <b>${UI.plural(drafts.length, 'event')}</b>. Times marked <i>from floor plan</i> or <i>agenda</i> were read off the drawings, so give them a quick look. Fix anything here, then add them.${warnings.length ? '<br>' + warnings.map(esc).join('<br>') : ''}</div></div>
        <div class="scroll-x card"><table class="tbl tight" style="min-width:900px"><thead><tr><th></th><th>Date</th><th>Room</th><th>Event</th><th>Start</th><th>End</th><th>Tech</th><th>AV items</th></tr></thead><tbody>
        ${drafts.map((d) => `<tr data-i="${d._i}"><td><input type="checkbox" data-f="include" ${d.include ? 'checked' : ''}></td>
          <td><input class="in sm" type="date" data-f="date" value="${d.date}" style="min-width:132px"></td>
          <td><select class="in sm" data-f="roomSel" style="min-width:160px">${roomOpts(d)}</select></td>
          <td style="min-width:200px"><input class="in sm" data-f="name" value="${esc(d.name)}">
            ${d.dupe ? '<span class="tag warn" style="margin-top:4px">Already in your events</span>' : ''}
            <div class="tiny muted" style="margin-top:3px">${d.timeSource ? 'Times: ' + esc(d.timeSource) : ''}${d.attendees ? ' · ' + d.attendees + ' guests' : ''}</div>
            ${d.flags.map((f) => `<div class="flag">${ic('alert', 'sm')}<span>${esc(f)}</span></div>`).join('')}</td>
          <td><input class="in sm" type="time" data-f="start" value="${d.start}"></td>
          <td><input class="in sm" type="time" data-f="end" value="${d.end}"></td>
          <td><input class="in sm num" type="number" min="0" max="9" data-f="techCount" value="${d.tech.count || 0}" style="max-width:60px"></td>
          <td class="small" style="min-width:230px">${d.noAV ? '<span class="tag gray">No AV</span>' : esc(d.items.map((i) => `${i.qty > 1 ? i.qty + '× ' : ''}${i.name}`).join(', ') || '—')}</td></tr>`).join('')}</tbody></table></div>
        <div class="row" style="margin-top:12px"><span class="muted small">${n} selected. Item quantities come from each room's standard kit; adjust them from Events afterward.</span></div>`;
      const b = addBtn();
      b.lastChild.textContent = ` Add ${n} event${n === 1 ? '' : 's'}`;
      b.disabled = !n;
    }
    UI.Acts['import-again'] = () => { UI.$('#imp-step1', m.el).classList.remove('hide'); UI.$('#imp-step2', m.el).classList.add('hide'); addBtn().classList.add('hide'); UI.$('#imp-prog', m.el).classList.add('hide'); };

    function onEdit(e) {
      const t = e.target, tr = t.closest('tr[data-i]');
      if (!tr || !t.dataset.f) return;
      const d = drafts[+tr.dataset.i];
      const f = t.dataset.f;
      if (f === 'include') d.include = t.checked;
      else if (f === 'techCount') d.tech.count = Math.max(0, +t.value || 0);
      else d[f] = t.value;
      if (f === 'include' || (f === 'roomSel' && e.type === 'change')) { const keep = m.body.scrollTop; draw(); m.body.scrollTop = keep; }
      else { const b = addBtn(); const n = drafts.filter((x) => x.include).length; b.lastChild.textContent = ` Add ${n} event${n === 1 ? '' : 's'}`; }
    }

    function commit() {
      const chosen = drafts.filter((d) => d.include);
      if (!chosen.length) return false;
      let made = 0;
      Store.update((s) => {
        chosen.forEach((d) => {
          let roomId = d.roomSel;
          if (roomId === '__new') {
            const ex = s.rooms.find((r) => r.name.toLowerCase() === String(d.roomName).toLowerCase());
            if (ex) roomId = ex.id;
            else {
              roomId = U.uid('r');
              s.rooms.push({ id: roomId, name: d.roomName, aliases: [], items: [], notes: '' });
            }
          }
          s.events.push({
            id: U.uid('ev'), name: d.name || 'Untitled event', roomId, date: d.date, start: d.start, end: d.end,
            items: d.noAV ? [] : d.items.map((i) => ({ ...i })), tech: { count: d.noAV ? 0 : d.tech.count || 0, start: '', end: '' }, noAV: !!d.noAV,
            attendees: d.attendees || '', contact: d.contact || '', setup: d.setup || '', notes: d.notes || '', source: 'pdf',
            review: d.flags.join(' '),
          });
          made++;
        });
        s.meta.firstRun = false;
      });
      const first = chosen.map((d) => d.date).sort()[0];
      UI.toast(`Added ${made} event${made === 1 ? '' : 's'}.${chosen.some((d) => d.flags.length) ? ' Check the ones marked Review.' : ''}`, 'ok');
      UI.view = 'week'; UI.setWeek(first);
    }
    return m;
  }
  UI.openImport = openImport;
})(typeof window !== 'undefined' ? window : globalThis);
