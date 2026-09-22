/* Room signs: preview and download PNGs (single, ZIP, or BrightSign), with a shared theme library plus per-sign overrides */
(function (root) {
  const IH = root.IH, U = IH.U, UI = IH.UI, Store = IH.Store, Sign = IH.Sign;
  const { esc, icon: ic } = UI;
  const mem = (UI.mem.signs = { scope: 'week', day: '', theme: null, showDate: null, merge: true, sel: new Set(), custom: { name: '', room: '', override: null }, current: null });

  const theme = () => mem.theme || Store.state.settings.signTheme || 'classic';
  const showDate = () => (mem.showDate == null ? !!Store.state.settings.signShowDate : mem.showDate);

  // list entries: one per event, or merged across days when "merge" is on. A picked day always wins over
  // the This-week/All-events scope, so "just tomorrow" works even if tomorrow is in a different week.
  function entries() {
    const st = Store.state;
    let evs;
    if (mem.day) evs = st.events.filter((e) => e.date === mem.day);
    else {
      evs = st.events.slice();
      if (mem.scope === 'week') { const set = new Set(U.weekDates(UI.weekKey)); evs = evs.filter((e) => set.has(e.date)); }
    }
    evs.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const out = [];
    const seen = new Map();
    evs.forEach((e) => {
      const room = Store.room(e.roomId);
      const key = mem.merge && !showDate() ? `${e.roomId}|${e.name.toLowerCase()}` : e.id;
      if (seen.has(key)) { const x = seen.get(key); x.dates.push(e.date); x.ids.push(e.id); return; }
      const ent = { key, id: e.id, ids: [e.id], name: e.name, room: room ? room.name : '', roomId: e.roomId, dates: [e.date], ev: e };
      seen.set(key, ent); out.push(ent);
    });
    return out;
  }
  const totalInScope = () => (mem.day ? Store.state.events.filter((e) => e.date === mem.day).length : mem.scope === 'week' ? Store.eventsInWeek(UI.weekKey).length : Store.state.events.length);
  const specOf = (ent) => (ent.custom ? { name: ent.name, room: ent.room } : Sign.specFor(Store.state, ent.ev));
  const overrideOf = (ent) => (ent.custom ? mem.custom.override : ent.ev.signOverride);
  const resolved = (ent) => Sign.forSpec(Store.state, specOf(ent), overrideOf(ent), theme());
  const dateLabel = (ent) => (ent.dates.length > 1 ? `${U.fmtDay(ent.dates[0])} – ${U.fmtDay(ent.dates[ent.dates.length - 1])}` : U.fmtDay(ent.dates[0]));

  function themeSelectHtml() {
    const groups = Sign.allThemes(Store.state).reduce((acc, t) => { (acc[t.custom ? 'Your designs' : 'Built in'] = acc[t.custom ? 'Your designs' : 'Built in'] || []).push(t); return acc; }, {});
    return `<select class="in" data-change="sign-theme" style="width:auto;min-width:190px">${Object.entries(groups).map(([label, list]) => `<optgroup label="${label}">${list.map((t) => UI.opt(t.key, t.label, theme() === t.key)).join('')}</optgroup>`).join('')}</select>`;
  }
  function dayPickerHtml() {
    const tmr = U.addDays(U.today(), 1);
    return `<div class="fbar noprint ${mem.day ? 'active' : ''}" style="margin-bottom:16px">
      <span class="small muted" style="font-weight:700">Day</span>
      <input class="in sm" type="date" data-change="sign-day" value="${esc(mem.day)}" aria-label="Pick a day">
      <button class="btn xs ${mem.day === tmr ? 'on' : ''}" data-act="sign-day-tomorrow">Tomorrow</button>
      ${mem.day ? `<button class="btn xs" data-act="sign-day-clear">${ic('x', 'sm')} Clear</button>` : ''}
      <span class="muted small right">${mem.day ? `Showing ${entries().length} of ${totalInScope()}` : ''}</span></div>`;
  }

  UI.Views.signs = {
    title: 'Room signs',
    render() {
      const list = entries();
      if (UI.mem.signPick) {
        const hit = list.find((x) => x.ids.includes(UI.mem.signPick));
        if (hit) mem.current = hit.key;
        else { const ev = Store.state.events.find((e) => e.id === UI.mem.signPick); if (ev) { mem.scope = 'all'; mem.day = ''; return UI.Views.signs.render(); } }
        UI.mem.signPick = null;
      }
      if (!mem.current || (!list.find((x) => x.key === mem.current) && mem.current !== '__custom')) mem.current = list[0] ? list[0].key : '__custom';
      const top = UI.pageTop('Room signs', 'PNG signs for the room screens', `${mem.scope === 'week' && !mem.day ? UI.weekNav() : ''}`);
      const selN = list.filter((x) => mem.sel.has(x.key)).length;
      return top + dayPickerHtml() + `<div class="row wrap noprint" style="margin-bottom:16px;gap:12px">
          <div class="seg">${[['week', 'This week'], ['all', 'All events']].map(([k, l]) => `<button class="${mem.scope === k && !mem.day ? 'on' : ''}" data-act="sign-scope" data-scope="${k}">${l}</button>`).join('')}</div>
          ${themeSelectHtml()}
          <button class="btn sm" data-act="sign-manage">${ic('sliders', 'sm')} Manage designs</button>
          <label class="check"><span class="switch"><input type="checkbox" data-change="sign-date" ${showDate() ? 'checked' : ''}><i></i></span> Show date and time</label>
          ${showDate() ? '' : `<label class="check"><span class="switch"><input type="checkbox" data-change="sign-merge" ${mem.merge ? 'checked' : ''}><i></i></span> One sign for multi-day events</label>`}</div>
        <div class="signwrap"><div>
          <div class="card signlist">${list.length ? list.map((x) => {
            const ov = x.ev.signOverride;
            return `<div class="signrow ${mem.current === x.key ? 'sel' : ''}" data-act="sign-pick" data-key="${esc(x.key)}">
              <input type="checkbox" data-change="sign-check" data-key="${esc(x.key)}" ${mem.sel.has(x.key) ? 'checked' : ''} onclick="event.stopPropagation()" aria-label="Select">
              <div class="grow"><b style="color:var(--navy)">${esc(ov && ov.title ? ov.title : x.name)}</b>${Sign.hasOverride(ov) ? '<span class="sign-badge" title="This sign has its own design or text">Customized</span>' : ''}<div class="small muted">${esc(ov && ov.room ? ov.room : x.room)} · ${dateLabel(x)}</div></div>
              <button type="button" class="rowbtn" data-act="sign-advanced" data-key="${esc(x.key)}" title="Advanced: multiple times for this event">${ic('clock', 'sm')}</button>
              <button type="button" class="rowbtn" data-act="sign-customize" data-key="${esc(x.key)}" title="Customize this sign">${ic('edit', 'sm')}</button></div>`;
          }).join('') : `<div class="empty" style="padding:30px 16px"><p style="margin:0">${mem.day ? 'Nothing on this day.' : 'No events in this view.'} Add some, or make a custom sign.</p></div>`}
            <div class="signrow ${mem.current === '__custom' ? 'sel' : ''}" data-act="sign-pick" data-key="__custom"><span style="width:17px">${ic('plus', 'sm')}</span><div class="grow"><b style="color:var(--navy)">Custom sign</b>${Sign.hasOverride(mem.custom.override) ? '<span class="sign-badge">Customized</span>' : ''}<div class="small muted">Type any name and room</div></div>
              <button type="button" class="rowbtn" data-act="sign-customize" data-key="__custom" title="Customize this sign">${ic('edit', 'sm')}</button></div></div>
          <div class="row wrap" style="margin-top:12px;gap:8px"><button class="btn sm" data-act="sign-all">${selN ? 'Clear selection' : 'Select all'}</button>
            <button class="btn sm navy" data-act="sign-zip" ${selN ? '' : 'disabled'}>${ic('download', 'sm')} Download ${selN || ''} selected</button></div></div>
        <div><div id="cust" class="${mem.current === '__custom' ? '' : 'hide'} card pad" style="margin-bottom:14px"><div class="form-grid">
          <div class="span-12">${UI.field('Sign text', `<input class="in" id="c-name" value="${esc(mem.custom.name)}" placeholder="Event name" data-input="sign-custom">`)}</div>
          <div class="span-12">${UI.field('Room', `<input class="in" id="c-room" list="dl-rooms" value="${esc(mem.custom.room)}" placeholder="Room name" data-input="sign-custom"><datalist id="dl-rooms">${Store.state.rooms.map((r) => `<option value="${esc(r.name)}">`).join('')}</datalist>`)}</div></div></div>
          <div class="preview" id="pv"><div style="aspect-ratio:16/9;display:grid;place-items:center" class="muted">Drawing sign…</div></div>
          <div class="row wrap" style="margin-top:12px;gap:8px"><span class="muted small grow" id="pv-name"></span><button class="btn" data-act="sign-customize" data-key="${esc(mem.current)}">${ic('edit', 'sm')} Customize this sign</button><button class="btn" data-act="sign-bs">${ic('download', 'sm')} BrightSign</button><button class="btn primary" data-act="sign-dl">${ic('download', 'sm')} Download PNG</button></div>
          <div class="small muted" style="margin-top:8px">1920 × 1080 pixels, the size of your example sign. The event name is centered and the room name runs along the bottom bar.</div></div></div>`;
    },
    mount() { draw(); },
  };

  function current() {
    if (mem.current === '__custom') return { custom: true, name: mem.custom.name.trim() || 'Event name', room: mem.custom.room.trim() || 'Room name', dates: [] };
    return entries().find((x) => x.key === mem.current) || null;
  }

  async function makeCanvas(ent) {
    const r = resolved(ent);
    await Sign.preload(r.theme);
    return Sign.render(r.spec, { theme: r.theme, showDate: showDate() && !ent.custom });
  }
  async function paint(ent, box) {
    const c = await makeCanvas(ent);
    box.innerHTML = '';
    box.appendChild(c);
    return c;
  }
  async function draw() {
    const ent = current();
    const box = UI.$('#pv');
    if (!ent || !box) return;
    UI.$('#pv-name').textContent = ent.custom ? '' : `${ent.name} · ${ent.room}`;
    await paint(ent, box);
  }

  const fname = (ent) => { const r = resolved(ent); return Sign.filename(Object.assign({}, r.spec, { date: showDate() && !ent.custom ? ent.dates[0] : '' })); };
  const toBlob = async (ent) => Sign.toBlob(await makeCanvas(ent));

  UI.Acts['sign-scope'] = (el) => { mem.scope = el.dataset.scope; mem.day = ''; UI.render(); };
  UI.Changes['sign-day'] = (el) => { mem.day = el.value; UI.rerender(); };
  UI.Acts['sign-day-tomorrow'] = () => { mem.day = mem.day === U.addDays(U.today(), 1) ? '' : U.addDays(U.today(), 1); UI.rerender(); };
  UI.Acts['sign-day-clear'] = () => { mem.day = ''; UI.rerender(); };
  UI.Changes['sign-theme'] = (el) => { mem.theme = el.value; UI.rerender(); };
  UI.Acts['sign-manage'] = () => IH.SignDesigner.openManager(() => UI.rerender());
  UI.Changes['sign-date'] = (el) => { mem.showDate = el.checked; UI.rerender(); };
  UI.Changes['sign-merge'] = (el) => { mem.merge = el.checked; mem.sel.clear(); UI.rerender(); };
  UI.Changes['sign-check'] = (el) => { if (el.checked) mem.sel.add(el.dataset.key); else mem.sel.delete(el.dataset.key); UI.rerender(); };
  UI.Acts['sign-pick'] = (el) => { mem.current = el.dataset.key; UI.rerender(); };
  UI.Acts['sign-all'] = () => { const l = entries(); if (mem.sel.size) mem.sel.clear(); else l.forEach((x) => mem.sel.add(x.key)); UI.rerender(); };
  UI.Changes['sign-custom'] = () => {
    mem.custom.name = UI.$('#c-name').value; mem.custom.room = UI.$('#c-room').value;
    draw();
  };
  UI.Acts['sign-customize'] = (el) => {
    const key = el.dataset.key;
    const ent = key === '__custom' ? current() : entries().find((x) => x.key === key);
    if (!ent) return;
    IH.SignDesigner.openSignEditor({
      spec: specOf(ent), override: overrideOf(ent), fallbackKey: theme(), hideText: key === '__custom',
      onSave: (next) => {
        if (key === '__custom') { mem.custom.override = next; UI.rerender(); return; }
        Store.update((s) => { ent.ids.forEach((id) => { const e = s.events.find((x) => x.id === id); if (e) e.signOverride = next || undefined; }); });
        UI.rerender();
      },
    });
  };
  UI.Acts['sign-advanced'] = (el) => {
    const ent = entries().find((x) => x.key === el.dataset.key);
    if (!ent || !IH.SignAdvanced) return;
    IH.SignAdvanced.open({ event: ent.ev, spec: specOf(ent), fallbackKey: theme() });
  };
  UI.Acts['sign-dl'] = async () => {
    const ent = current();
    if (!ent) return;
    U.download(await toBlob(ent), fname(ent));
  };
  UI.Acts['sign-bs'] = async (el) => {
    const ent = current();
    if (!ent || !IH.BrightSign) return;
    el.disabled = true;
    try {
      await IH.Imp.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      const canvas = await makeCanvas(ent);
      const base = fname(ent).replace(/\.png$/i, '');
      const built = await IH.BrightSign.build(canvas, base, Store.state.settings.brightsignFolder);
      U.download(await IH.BrightSign.exportZip(built), `${base}_brightsign.zip`);
      UI.toast('BrightSign file downloaded. Unzip both files into your signage folder.', 'ok');
    } catch (e) { console.error(e); UI.toast('Could not build the BrightSign file: ' + e.message, 'bad'); }
    el.disabled = false;
  };
  UI.Acts['sign-zip'] = async (el) => {
    const chosen = entries().filter((x) => mem.sel.has(x.key));
    if (!chosen.length) return;
    if (chosen.length === 1) { U.download(await toBlob(chosen[0]), fname(chosen[0])); return; }
    el.disabled = true;
    try {
      await IH.Imp.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      const zip = new root.JSZip();
      const used = new Set();
      for (const ent of chosen) {
        let n = fname(ent);
        if (used.has(n)) n = n.replace(/\.png$/, '_' + used.size + '.png');
        used.add(n);
        zip.file(n, await toBlob(ent));
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      U.download(blob, `room-signs_${UI.weekKey}.zip`);
      UI.toast(`Downloaded ${chosen.length} signs`, 'ok');
    } catch (e) { console.error(e); UI.toast('Could not make the ZIP: ' + e.message + '. You can still download signs one at a time.', 'bad'); }
    el.disabled = false;
  };
})(typeof window !== 'undefined' ? window : globalThis);
