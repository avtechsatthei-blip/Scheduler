/* Equipment (inventory + weekly forecast) and Rooms (standard AV kits) */
(function (root) {
  const IH = root.IH, U = IH.U, UI = IH.UI, Store = IH.Store;
  const { esc, icon: ic } = UI;

  /* ======================= equipment ======================= */
  function rentalList(inv) {
    const by = {};
    inv.alerts.filter((a) => a.level === 'short').forEach((a) => {
      const r = (by[a.item] = by[a.item] || { item: a.item, need: 0, days: [], cost: 0, rentable: a.rentable !== false });
      r.need = Math.max(r.need, a.need);
      r.days.push(a.date);
      r.cost += a.rentCost || 0;
    });
    return Object.values(by);
  }

  function forecastHtml() {
    const st = Store.state, wk = UI.weekKey;
    const inv = IH.Inv.analyze(st, wk);
    const used = inv.rows.filter((r) => r.status !== 'idle');
    const idle = inv.rows.filter((r) => r.status === 'idle');
    const rent = rentalList(inv);
    let h = '';
    if (!used.length) {
      h += `<div class="callout info">${ic('info')}<div>No equipment is booked for ${esc(U.fmtWeek(wk))}. Add AV items to events and the forecast appears here.</div></div>`;
    } else {
      if (rent.length) {
        h += `<div class="card pad" style="margin-bottom:16px"><div class="row"><h3>Rental shopping list</h3><span class="right tag bad">about ${UI.money(inv.rentalCost)}</span></div>
          <div class="col" style="gap:8px;margin-top:10px">${rent.map((r) => `<div class="callout bad">${ic('box')}<div class="grow"><b>Rent ${r.need} more ${esc(r.item)}${r.need > 1 ? 's' : ''}</b><div class="small">Needed ${r.days.sort().map(U.fmtDay).join(', ')}${r.cost ? ` · about ${UI.money(r.cost)}` : ''}${r.rentable ? '' : ' · marked not rentable, so look for a swap or a schedule change'}</div></div></div>`).join('')}</div></div>`;
      }
      h += `<div class="card scroll-x"><table class="tbl"><thead><tr><th>Item</th><th class="num">On hand</th>${inv.dates.map((d) => `<th class="num">${U.DOW[U.dow(d)]} ${U.parseDate(d).getDate()}</th>`).join('')}<th>Status</th></tr></thead><tbody>
        ${used.map((r) => `<tr><td><b>${esc(r.name)}</b>${r.inInventory ? '' : ' <span class="tag warn">not in inventory</span>'}</td><td class="num">${r.have}</td>
          ${inv.dates.map((d) => {
            const p = r.byDate[d];
            if (!p) return '<td class="num muted">–</td>';
            const cls = p > r.have ? 'bad' : r.have && p >= Math.ceil((r.have * st.settings.lowStockPct) / 100) ? 'warn' : 'ok';
            return `<td class="num"><span class="tag ${cls}">${p}</span></td>`;
          }).join('')}
          <td>${r.status === 'short' ? '<span class="tag bad">Short</span>' : r.status === 'low' ? '<span class="tag warn">Tight</span>' : '<span class="tag ok">OK</span>'}</td></tr>`).join('')}</tbody></table></div>
        <div class="small muted" style="margin-top:8px">Numbers are the most of that item in use at the same moment on that day, counting your before/after buffers. Red means more than you own.</div>`;
    }
    if (idle.length) h += `<div class="small muted" style="margin-top:10px">Not used this week: ${idle.map((r) => esc(r.name)).join(', ')}</div>`;
    return h;
  }

  UI.Views.equipment = {
    title: 'Equipment',
    render() {
      const st = Store.state;
      const top = UI.pageTop('Equipment', 'What you own and what the week needs', UI.weekNav());
      const ph = !st.meta.invConfirmed
        ? `<div class="callout warn" id="ph-banner" style="margin-bottom:16px">${ic('alert')}<div class="grow"><b>These counts are placeholders.</b> Enter what you really own. Shortage warnings are only as good as these numbers.</div><button class="btn xs" data-act="inv-confirm">They're right</button></div>` : '';
      return top + ph + `<div class="row top wrap" style="gap:20px;align-items:flex-start">
        <div class="grow" style="min-width:320px;flex:1.3"><h3 style="font-size:16px;margin-bottom:10px">This week's forecast</h3><div id="forecast">${forecastHtml()}</div></div>
        <div style="flex:1;min-width:300px;max-width:520px"><div class="row" style="margin-bottom:10px"><h3 style="font-size:16px">Inventory</h3></div>
          <div class="card scroll-x"><table class="tbl tight"><thead><tr><th>Item</th><th class="num">Own</th><th>Rentable</th><th class="num">Rent $/day</th><th></th></tr></thead><tbody id="invbody">
          ${st.inventory.map((i) => `<tr data-id="${i.id}"><td><input class="in sm" data-inv="name" value="${esc(i.name)}"></td>
            <td class="num"><input class="in sm num" type="number" min="0" data-inv="qty" value="${i.qty}" style="max-width:66px"></td>
            <td><span class="switch"><input type="checkbox" data-inv="rentable" ${i.rentable ? 'checked' : ''}><i></i></span></td>
            <td class="num"><input class="in sm num" type="number" min="0" data-inv="rentCost" value="${i.rentCost || 0}" style="max-width:74px"></td>
            <td><button class="btn ghost icon sm danger" data-act="inv-del" data-id="${i.id}" title="Remove">${ic('trash', 'sm')}</button></td></tr>`).join('')}
          <tr><td colspan="5"><div class="row"><input class="in sm" id="inv-new" placeholder="Add an item, e.g. Wireless Mic"><input class="in sm num" id="inv-new-q" type="number" min="0" value="1" style="max-width:66px"><button class="btn sm" data-act="inv-add">${ic('plus', 'sm')} Add</button></div></td></tr>
          </tbody></table></div></div></div>`;
    },
    mount(main) {
      const body = UI.$('#invbody', main);
      const refresh = U.debounce(() => { const f = UI.$('#forecast'); if (f) f.innerHTML = forecastHtml(); UI.renderChrome(); }, 250);
      body.addEventListener('input', (e) => {
        const t = e.target, tr = t.closest('tr[data-id]');
        if (!tr || !t.dataset.inv) return;
        const k = t.dataset.inv;
        const val = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Math.max(0, +t.value || 0) : t.value;
        const it = Store.state.inventory.find((x) => x.id === tr.dataset.id);
        if (!it) return;
        it[k] = val;
        Store.state.meta.invConfirmed = true;
        const b = UI.$('#ph-banner'); if (b) b.remove();
        Store.save();
        refresh();
      });
      body.addEventListener('change', (e) => { if (e.target.type === 'checkbox') e.target.dispatchEvent(new Event('input', { bubbles: true })); });
      const nn = UI.$('#inv-new', main);
      if (nn) nn.addEventListener('keydown', (e) => { if (e.key === 'Enter') UI.Acts['inv-add'](); });
    },
  };
  UI.Acts['inv-confirm'] = () => { Store.update((s) => { s.meta.invConfirmed = true; }); };
  UI.Acts['inv-add'] = () => {
    const n = UI.$('#inv-new').value.trim(), q = Math.max(0, +UI.$('#inv-new-q').value || 0);
    if (!n) { UI.toast('Type the item name first', 'bad'); return; }
    if (Store.state.inventory.some((i) => U.itemKey(i.name) === U.itemKey(n))) { UI.toast(`${n} is already in the list`, 'bad'); return; }
    Store.update((s) => { s.inventory.push({ id: U.uid('inv'), name: n, qty: q, rentable: true, rentCost: 0, notes: '' }); s.meta.invConfirmed = true; });
  };
  UI.Acts['inv-del'] = async (el) => {
    const it = Store.state.inventory.find((i) => i.id === el.dataset.id);
    if (!it) return;
    if (await UI.confirm({ title: `Remove ${esc(it.name)}?`, message: 'Events that use it will show it as "not in inventory".', ok: 'Remove', danger: true })) Store.update((s) => { s.inventory = s.inventory.filter((i) => i.id !== it.id); });
  };

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
