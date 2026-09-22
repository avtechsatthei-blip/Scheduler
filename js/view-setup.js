/* Rooms (standard AV kits). Equipment lives in view-equipment.js */
(function (root) {
  const IH = root.IH, U = IH.U, UI = IH.UI, Store = IH.Store;
  const { esc, icon: ic } = UI;

  /* ======================= rooms ======================= */
  UI.Views.rooms = {
    title: 'Rooms',
    render() {
      const st = Store.state;
      const top = UI.pageTop('Rooms', 'Standard AV kit for each room', `<button class="btn primary" data-act="room-new">${ic('plus', 'sm')} Add room</button>`);
      return top + `<div class="small muted" style="margin:-8px 0 16px;max-width:680px">A room's standard kit fills in automatically when you add an event there. Mark items as <b>installed</b> if they're permanently in the room and shouldn't count against your inventory.</div>
        <div class="cards">${st.rooms.map((r) => {
          const n = st.events.filter((e) => e.roomId === r.id).length;
          return `<div class="card pcard" data-act="room-edit" data-id="${r.id}" style="--rc:${UI.roomColor(r.id)}">
            <div class="row"><span class="roompill" style="font-size:15px">${esc(r.name)}</span><span class="right tiny muted">${UI.plural(n, 'event')}</span></div>
            <div class="row wrap" style="gap:5px;margin-top:12px">${r.items.length ? r.items.map((i) => `<span class="chip">${i.qty > 1 ? i.qty + '× ' : ''}${esc(i.name)}${i.builtIn ? ' · installed' : ''}</span>`).join('') : '<span class="muted small">No standard AV</span>'}</div></div>`;
        }).join('')}</div>`;
    },
  };
  UI.Acts['room-new'] = () => openRoom(null);
  UI.Acts['room-edit'] = (el) => { const r = Store.room(el.dataset.id); if (r) openRoom(r); };

  function openRoom(existing) {
    const st = Store.state;
    const isNew = !existing;
    const r0 = existing ? U.clone(existing) : { id: U.uid('r'), name: '', aliases: [], items: [], notes: '' };
    let items = r0.items.map((i) => ({ ...i }));
    const invNames = st.inventory.map((i) => i.name);
    const body = `<div class="form-grid" id="rmf">
      <div class="span-12">${UI.field('Room name', `<input class="in" name="name" value="${esc(r0.name)}" placeholder="e.g. Chancellor Ballroom">`)}</div>
      <div class="span-12">${UI.field('Other names it goes by', `<input class="in" name="aliases" value="${esc((r0.aliases || []).join(', '))}" placeholder="chancellor, ballroom">`, 'Used to match rooms when you import a PDF. Separate with commas.')}</div>
      <div class="span-12"><div class="row"><h3 style="font-size:14px">Standard AV kit</h3></div><div id="kit" style="margin-top:8px"></div></div>
      <div class="span-12">${UI.field('Notes', `<textarea class="in" name="notes" style="min-height:52px" placeholder="Capacity, quirks, where the patch panel is">${esc(r0.notes || '')}</textarea>`)}</div>
      <datalist id="dl-inv">${invNames.map((n) => `<option value="${esc(n)}">`).join('')}</datalist></div>`;
    const m = UI.modal({
      title: isNew ? 'Add room' : r0.name, body,
      left: !isNew ? `<button class="btn danger sm" data-del>${ic('trash', 'sm')} Delete</button>` : '',
      actions: [{ label: 'Cancel' }, { label: isNew ? 'Add room' : 'Save changes', cls: 'primary', icon: 'check', run: () => save() }],
      onMount: (mm) => {
        const el = mm.el;
        draw();
        el.addEventListener('input', (e) => { const t = e.target; if (t.dataset.k) items[+t.dataset.i][t.dataset.k] = t.dataset.k === 'qty' ? Math.max(1, +t.value || 1) : t.dataset.k === 'builtIn' ? t.checked : t.value; });
        el.addEventListener('change', (e) => { if (e.target.dataset.k === 'builtIn') items[+e.target.dataset.i].builtIn = e.target.checked; });
        el.addEventListener('click', (e) => {
          const b = e.target.closest('button');
          if (!b) return;
          if (b.hasAttribute('data-rm')) { items.splice(+b.dataset.rm, 1); draw(); }
          if (b.hasAttribute('data-add')) { items.push({ name: '', qty: 1, builtIn: false }); draw(); const ins = UI.$$('[data-k=name]', el); ins[ins.length - 1].focus(); }
          if (b.hasAttribute('data-del')) {
            const n = st.events.filter((x) => x.roomId === r0.id).length;
            if (n) { UI.toast(`${UI.plural(n, 'event')} use this room. Move or delete them first.`, 'bad'); return; }
            mm.close();
            UI.confirm({ title: `Delete ${esc(r0.name)}?`, ok: 'Delete', danger: true, message: 'The room is removed from the list.' }).then((ok) => { if (ok) Store.update((s) => { s.rooms = s.rooms.filter((x) => x.id !== r0.id); }); });
          }
        });
      },
    });
    function draw() {
      UI.$('#kit', m.el).innerHTML = (items.length ? `<div class="col" style="gap:6px">${items.map((it, i) => `<div class="row"><input class="in sm" list="dl-inv" data-i="${i}" data-k="name" value="${esc(it.name)}" placeholder="Item">
        <input class="in sm num" type="number" min="1" data-i="${i}" data-k="qty" value="${it.qty || 1}" style="max-width:74px">
        <label class="check small nowrap"><input type="checkbox" data-i="${i}" data-k="builtIn" ${it.builtIn ? 'checked' : ''}> installed</label>
        <button class="btn ghost icon sm danger" type="button" data-rm="${i}" title="Remove">${ic('x', 'sm')}</button></div>`).join('')}</div>` : '<div class="muted small">No standard AV in this room.</div>') + `<button class="btn sm" type="button" data-add style="margin-top:10px">${ic('plus', 'sm')} Add item</button>`;
    }
    function save() {
      const v = UI.formVals(UI.$('#rmf', m.el));
      if (!v.name.trim()) { UI.toast('Name the room', 'bad'); return false; }
      const dupe = st.rooms.find((x) => x.id !== r0.id && x.name.toLowerCase() === v.name.trim().toLowerCase());
      if (dupe) { UI.toast('There is already a room with that name', 'bad'); return false; }
      Store.update((s) => {
        const rec = { id: r0.id, name: v.name.trim(), aliases: v.aliases.split(',').map((x) => x.trim()).filter(Boolean), items: items.filter((i) => String(i.name).trim()).map((i) => ({ name: String(i.name).trim(), qty: Math.max(1, +i.qty || 1), builtIn: !!i.builtIn })), notes: v.notes.trim() };
        const i = s.rooms.findIndex((x) => x.id === rec.id);
        if (i >= 0) s.rooms[i] = rec; else s.rooms.push(rec);
      });
      UI.toast(isNew ? 'Room added' : 'Saved', 'ok');
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
