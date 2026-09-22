/* Equipment: full inventory tracker, weekly forecast, monthly audits (in-app, Excel and printable) */
(function (root) {
  const IH = root.IH, U = IH.U, UI = IH.UI, Store = IH.Store, A = IH.Audit, X = IH.Xlsx;
  const { esc, icon: ic } = UI;
  const mem = (UI.mem.equip = { tab: 'inventory', q: '', cat: '', loc: '', cond: '', outOnly: false, stale: false, group: true, auditId: null, aq: '', aloc: '', aonly: false });
  const COND_CLS = { Good: 'ok', Fair: 'warn', 'Needs repair': 'bad', Retired: 'gray' };
  const saveSoon = U.debounce(() => Store.save(), 300);
  window.addEventListener('pagehide', () => { if (Store.state) Store.save(); });

  const uniq = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const units = (i) => +i.qty || 0;
  const avail = (i) => Math.max(0, units(i) - (+i.out || 0));
  const lastDone = () => (Store.state.audits || []).filter((a) => a.status === 'done').sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
  const refocus = (id, pos) => { const n = UI.$(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* not a text box */ } } };

  /* ======================= shell ======================= */
  UI.Views.equipment = {
    title: 'Equipment',
    render() {
      const t = mem.tab;
      const tabs = `<div class="tabs noprint">${[['inventory', 'Inventory', 'box'], ['forecast', 'Week forecast', 'calendar'], ['audits', 'Audits', 'check']].map(([k, l, i]) => `<button class="${t === k ? 'on' : ''}" data-act="eq-tab" data-tab="${k}">${ic(i, 'sm')} ${l}</button>`).join('')}</div>`;
      let actions = '', body = '';
      if (t === 'inventory') {
        actions = `<button class="btn" data-act="eq-import">${ic('upload', 'sm')} Import</button><button class="btn" data-act="eq-export">${ic('download', 'sm')} Export Excel</button><button class="btn primary" data-act="item-new">${ic('plus', 'sm')} Add item</button>`;
        body = inventoryHtml();
      } else if (t === 'forecast') {
        actions = UI.weekNav();
        body = `<div id="forecast">${forecastHtml()}</div>`;
      } else {
        actions = mem.auditId ? '' : `<button class="btn" data-act="aud-blank">${ic('download', 'sm')} Blank fillable sheet</button><button class="btn" data-act="aud-print-blank">${ic('print', 'sm')} Print blank sheet</button>`;
        body = auditsHtml();
      }
      return UI.pageTop('Equipment', 'Inventory, forecast and audits', actions) + tabs + body;
    },
    mount(main) {
      if (mem.tab === 'inventory') mountInventory(main);
      if (mem.tab === 'audits' && mem.auditId) mountAudit(main);
    },
  };
  UI.Acts['eq-tab'] = (el) => { mem.tab = el.dataset.tab; if (mem.tab !== 'audits') mem.auditId = null; UI.render(); };

  /* ======================= inventory ======================= */
  function filtered() {
    const q = mem.q.trim().toLowerCase();
    const month = A.monthKey(U.today());
    return Store.state.inventory.filter((i) =>
      (!q || [i.name, i.category, i.model, i.assetTag, i.serial, i.location, i.notes].join(' ').toLowerCase().includes(q)) &&
      (!mem.cat || (i.category || 'Uncategorized') === mem.cat) &&
      (!mem.loc || (i.location || 'No location') === mem.loc) &&
      (!mem.cond || i.condition === mem.cond) &&
      (!mem.outOnly || (+i.out || 0) > 0 || i.condition === 'Needs repair') &&
      (!mem.stale || !i.lastAudit || A.monthKey(i.lastAudit) !== month));
  }

  function statsHtml() {
    const inv = Store.state.inventory;
    const totalUnits = inv.reduce((t, i) => t + units(i), 0);
    const out = inv.reduce((t, i) => t + (+i.out || 0), 0);
    const repair = inv.filter((i) => i.condition === 'Needs repair').length;
    const value = inv.reduce((t, i) => t + (i.value === '' || i.value == null ? 0 : (+i.value || 0) * units(i)), 0);
    const done = lastDone();
    const thisMonth = A.find(Store.state, A.monthKey(U.today()));
    const tile = (k, v, s, cls) => `<div class="card stat ${cls || ''}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
    let audit;
    if (thisMonth && thisMonth.status === 'open') { const p = A.progress(thisMonth); audit = tile('This month\'s audit', `${p.done}/${p.total}`, 'counted so far', 'warn'); }
    else if (thisMonth) audit = tile('This month\'s audit', 'Done', `${esc(U.fmtDay(thisMonth.date))} · ${A.summary(thisMonth).discrepancies.length} discrepancies`, 'ok');
    else audit = tile('This month\'s audit', 'Due', done ? `Last one: ${esc(A.monthLabel(done.month))}` : 'No audit on record yet', 'bad');
    return tile('Items', inv.length, `${totalUnits} units in total`, 'info') + tile('Out of service', out, `${repair ? repair + (repair === 1 ? ' item needs' : ' items need') + ' repair' : 'Nothing flagged for repair'}`, out || repair ? 'warn' : 'ok') +
      tile('Value', value ? UI.money(value) : '—', value ? 'Where a value is entered' : 'Add values to see a total', 'info') + audit;
  }

  function rowHtml(i, showCat) {
    const av = avail(i);
    return `<tr data-id="${i.id}" class="hov">
      <td class="nm"><button class="namebtn" data-act="item-edit" data-id="${i.id}">${esc(i.name) || '<i class="muted">Unnamed</i>'}</button>
        <div class="tiny muted">${[i.model, i.assetTag ? '#' + i.assetTag : '', i.serial ? 'S/N ' + i.serial : ''].filter(Boolean).map(esc).join(' · ')}</div></td>
      ${showCat ? `<td>${esc(i.category) || '<span class="muted">—</span>'}</td>` : ''}
      <td>${esc(i.location) || '<span class="muted">—</span>'}</td>
      <td class="num"><input class="in sm num" type="number" min="0" data-inv="qty" value="${units(i)}" style="max-width:66px" aria-label="Own"></td>
      <td class="num"><input class="in sm num" type="number" min="0" data-inv="out" value="${+i.out || 0}" style="max-width:60px" aria-label="Out of service"></td>
      <td class="num avail ${av === 0 && units(i) > 0 ? 'low' : ''}">${av}</td>
      <td><span class="tag ${COND_CLS[i.condition] || 'gray'}">${esc(i.condition || 'Good')}</span></td>
      <td class="small">${i.rentable ? `Yes${+i.rentCost ? ' · $' + (+i.rentCost) + '/day' : ''}` : '<span class="muted">No</span>'}</td>
      <td class="small">${i.lastAudit ? esc(U.fmtDay(i.lastAudit)) : '<span class="muted">Never</span>'}</td>
      <td class="nowrap"><button class="btn ghost icon sm" data-act="item-dup" data-id="${i.id}" title="Duplicate">${ic('copy', 'sm')}</button><button class="btn ghost icon sm" data-act="item-edit" data-id="${i.id}" title="Edit">${ic('edit', 'sm')}</button><button class="btn ghost icon sm danger" data-act="item-del" data-id="${i.id}" title="Delete">${ic('trash', 'sm')}</button></td></tr>`;
  }

  function inventoryHtml() {
    const st = Store.state;
    const cats = uniq(st.inventory.map((i) => i.category || 'Uncategorized'));
    const locs = uniq(st.inventory.map((i) => i.location || 'No location'));
    const list = filtered().sort((a, b) => (mem.group ? String(a.category || 'zzz').localeCompare(String(b.category || 'zzz')) : 0) || a.name.localeCompare(b.name));
    const ph = !st.meta.invConfirmed ? `<div class="callout warn" id="ph-banner" style="margin-bottom:16px">${ic('alert')}<div class="grow"><b>These counts are placeholders.</b> Enter what you really own. Shortage warnings are only as good as these numbers.</div><button class="btn xs" data-act="inv-confirm">They're right</button></div>` : '';
    const filt = `<div class="filters noprint">
        <input class="in sm grow-in" id="eq-q" placeholder="Search items…" value="${esc(mem.q)}" data-input="eq-q">
        <select class="in sm" data-change="eq-cat"><option value="">All categories</option>${cats.map((c) => UI.opt(c, c, mem.cat === c)).join('')}</select>
        <select class="in sm" data-change="eq-loc"><option value="">All locations</option>${locs.map((c) => UI.opt(c, c, mem.loc === c)).join('')}</select>
        <select class="in sm" data-change="eq-cond"><option value="">Any condition</option>${Store.CONDITIONS.map((c) => UI.opt(c, c, mem.cond === c)).join('')}</select>
        <label class="check small"><input type="checkbox" data-change="eq-flag" data-k="outOnly" ${mem.outOnly ? 'checked' : ''}> Out of service</label>
        <label class="check small"><input type="checkbox" data-change="eq-flag" data-k="stale" ${mem.stale ? 'checked' : ''}> Not audited this month</label>
        <label class="check small"><input type="checkbox" data-change="eq-flag" data-k="group" ${mem.group ? 'checked' : ''}> Group by category</label>
        <span class="muted small">${list.length} of ${st.inventory.length}</span></div>`;
    let rows = '';
    if (!list.length) rows = `<tr><td colspan="10"><div class="empty" style="padding:30px"><h3>${st.inventory.length ? 'Nothing matches' : 'No equipment yet'}</h3><p>${st.inventory.length ? 'Clear a filter to see more.' : 'Add items one at a time, or import a spreadsheet or pasted list to add everything at once.'}</p></div></td></tr>`;
    else {
      let last = null;
      list.forEach((i) => {
        if (mem.group) {
          const c = i.category || 'Uncategorized';
          if (c !== last) { const inCat = list.filter((x) => (x.category || 'Uncategorized') === c); rows += `<tr class="grp"><td colspan="10">${esc(c)} · ${UI.plural(inCat.length, 'item')} · ${UI.plural(inCat.reduce((t, x) => t + units(x), 0), 'unit')}</td></tr>`; last = c; }
        }
        rows += rowHtml(i, !mem.group);
      });
    }
    return `<div class="stats" id="eq-stats">${statsHtml()}</div>${ph}${filt}
      <div class="card scroll-x"><table class="tbl inv"><thead><tr><th>Item</th>${mem.group ? '' : '<th>Category</th>'}<th>Location</th><th class="num">Own</th><th class="num">Out</th><th class="num">Avail</th><th>Condition</th><th>Rent</th><th>Last audit</th><th></th></tr></thead><tbody id="invbody">${rows}</tbody></table></div>
      <div class="small muted" style="margin-top:8px">Own and Out are editable right here. <b>Out</b> is how many are broken, away for repair or loaned out. Only what's available counts toward event needs.</div>`;
  }

  function mountInventory(main) {
    const body = UI.$('#invbody', main);
    if (!body) return;
    body.addEventListener('input', (e) => {
      const t = e.target, tr = t.closest('tr[data-id]');
      if (!tr || !t.dataset.inv) return;
      const it = Store.state.inventory.find((x) => x.id === tr.dataset.id);
      if (!it) return;
      it[t.dataset.inv] = Math.max(0, Math.round(+t.value || 0));
      Store.state.meta.invConfirmed = true;
      const b = UI.$('#ph-banner'); if (b) b.remove();
      const av = UI.$('.avail', tr); av.textContent = avail(it); av.classList.toggle('low', avail(it) === 0 && units(it) > 0);
      UI.$('#eq-stats').innerHTML = statsHtml();
      saveSoon();
      UI.renderChrome();
    });
  }

  UI.Changes['eq-q'] = (el) => { mem.q = el.value; const p = el.selectionStart; UI.render(); refocus('#eq-q', p); };
  UI.Changes['eq-cat'] = (el) => { mem.cat = el.value; UI.render(); };
  UI.Changes['eq-loc'] = (el) => { mem.loc = el.value; UI.render(); };
  UI.Changes['eq-cond'] = (el) => { mem.cond = el.value; UI.render(); };
  UI.Changes['eq-flag'] = (el) => { mem[el.dataset.k] = el.checked; UI.render(); };
  UI.Acts['inv-confirm'] = () => { Store.update((s) => { s.meta.invConfirmed = true; }); };
  UI.Acts['item-new'] = () => openItem(null);
  UI.Acts['item-edit'] = (el) => { const i = Store.state.inventory.find((x) => x.id === el.dataset.id); if (i) openItem(i); };
  UI.Acts['item-dup'] = (el) => { const i = Store.state.inventory.find((x) => x.id === el.dataset.id); if (i) openItem(null, Object.assign({}, i, { id: undefined, assetTag: '', serial: '', lastAudit: '' })); };
  UI.Acts['item-del'] = async (el) => {
    const it = Store.state.inventory.find((i) => i.id === el.dataset.id);
    if (!it) return;
    if (await UI.confirm({ title: `Remove ${esc(it.name)}?`, message: 'Events that use it will show it as "not in inventory". Past audits keep their record of it.', ok: 'Remove', danger: true })) Store.update((s) => { s.inventory = s.inventory.filter((i) => i.id !== it.id); });
  };
  UI.Acts['eq-export'] = async (el) => {
    el.disabled = true;
    try { await X.save(await X.inventoryWorkbook(Store.state), `AV-inventory_${U.today()}.xlsx`); UI.toast('Inventory exported', 'ok'); }
    catch (e) { console.error(e); UI.toast('Could not build the Excel file: ' + e.message, 'bad'); }
    el.disabled = false;
  };

  /* ---------- add / edit an item ---------- */
  function openItem(existing, preset) {
    const st = Store.state;
    const isNew = !existing;
    const base = existing ? U.clone(existing) : Store.newItem(Object.assign({ category: mem.cat || '', location: mem.loc || '' }, preset || {}));
    const cats = uniq(Store.CATEGORIES.concat(st.inventory.map((i) => i.category)));
    const locs = uniq(st.inventory.map((i) => i.location).concat(st.rooms.map((r) => r.name)));
    const body = `<div class="form-grid" id="itf">
      <div class="span-8">${UI.field('Item', `<input class="in" name="name" value="${esc(base.name)}" placeholder="e.g. Wireless handheld mic" autocomplete="off">`)}</div>
      <div class="span-4">${UI.field('Category', `<input class="in" name="category" list="dl-cat" value="${esc(base.category)}" placeholder="Audio, Video…"><datalist id="dl-cat">${cats.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`)}</div>
      <div class="span-6">${UI.field('Make / model', `<input class="in" name="model" value="${esc(base.model)}" placeholder="Shure QLXD2/SM58">`)}</div>
      <div class="span-6">${UI.field('Location', `<input class="in" name="location" list="dl-loc" value="${esc(base.location)}" placeholder="AV closet, Cart 2, Chancellor…"><datalist id="dl-loc">${locs.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`)}</div>
      <div class="span-3 keep-half">${UI.field('Own', `<input class="in" type="number" min="0" name="qty" value="${units(base)}">`)}</div>
      <div class="span-3 keep-half">${UI.field('Out of service', `<input class="in" type="number" min="0" name="out" value="${+base.out || 0}">`, 'Broken or away')}</div>
      <div class="span-6">${UI.field('Condition', `<select class="in" name="condition">${Store.CONDITIONS.map((c) => UI.opt(c, c, base.condition === c)).join('')}</select>`)}</div>
      <div class="span-6">${UI.field('Asset tag(s)', `<input class="in" name="assetTag" value="${esc(base.assetTag)}" placeholder="IH-0142, or a range like IH-0142 to 0149">`)}</div>
      <div class="span-6">${UI.field('Serial number(s)', `<input class="in" name="serial" value="${esc(base.serial)}">`)}</div>
      <div class="span-3 keep-half">${UI.field('Purchased', `<input class="in" type="date" name="purchased" value="${esc(base.purchased)}">`)}</div>
      <div class="span-3 keep-half">${UI.field('Value each ($)', `<input class="in" type="number" min="0" step="0.01" name="value" value="${base.value === '' || base.value == null ? '' : base.value}">`)}</div>
      <div class="span-3" style="align-self:end"><label class="check"><span class="switch"><input type="checkbox" name="rentable" ${base.rentable ? 'checked' : ''}><i></i></span> Rentable</label></div>
      <div class="span-3 keep-half">${UI.field('Rent $ per day', `<input class="in" type="number" min="0" step="1" name="rentCost" value="${+base.rentCost || 0}">`, 'For shortage estimates')}</div>
      <div class="span-12">${UI.field('Notes', `<textarea class="in" name="notes" style="min-height:52px">${esc(base.notes)}</textarea>`)}</div>
      ${base.lastAudit ? `<div class="span-12 small muted">Last audited ${esc(U.fmtLong(base.lastAudit))}.</div>` : ''}</div>`;
    const save = (again) => (m) => {
      const v = UI.formVals(UI.$('#itf', m.el));
      if (!v.name.trim()) { UI.toast('Give the item a name', 'bad'); UI.$('[name=name]', m.el).focus(); return false; }
      const dupe = st.inventory.find((i) => i.id !== base.id && U.itemKey(i.name) === U.itemKey(v.name) && (i.location || '') === v.location.trim() && !v.assetTag);
      if (dupe && !confirm(`"${v.name.trim()}" is already listed in ${v.location.trim() || 'the same place'}. Add it anyway?`)) return false;
      const rec = Object.assign({}, base, {
        name: v.name.trim(), category: v.category.trim(), model: v.model.trim(), location: v.location.trim(), qty: Math.max(0, Math.round(+v.qty || 0)), out: Math.max(0, Math.round(+v.out || 0)),
        condition: v.condition, assetTag: v.assetTag.trim(), serial: v.serial.trim(), purchased: v.purchased, value: v.value === '' ? '' : Math.max(0, +v.value || 0), rentable: !!v.rentable, rentCost: Math.max(0, +v.rentCost || 0), notes: v.notes.trim(),
      });
      rec.out = Math.min(rec.out, rec.qty);
      Store.update((s) => { const i = s.inventory.findIndex((x) => x.id === rec.id); if (i >= 0) s.inventory[i] = rec; else s.inventory.push(rec); s.meta.invConfirmed = true; });
      UI.toast(isNew ? 'Item added' : 'Saved', 'ok');
      if (again) setTimeout(() => openItem(null, { category: rec.category, location: rec.location }), 30);
    };
    UI.modal({
      title: isNew ? 'Add equipment' : base.name, body,
      actions: [{ label: 'Cancel' }].concat(isNew ? [{ label: 'Save and add another', run: save(true) }] : []).concat([{ label: isNew ? 'Add item' : 'Save changes', cls: 'primary', icon: 'check', run: save(false) }]),
    });
  }

  /* ---------- bulk import (Excel / CSV / pasted list) ---------- */
  UI.Acts['eq-import'] = () => {
    let items = [];
    const m = UI.modal({
      title: 'Import equipment', wide: true, dismiss: false,
      body: `<div id="imp1"><div class="row top wrap" style="gap:18px">
          <div style="flex:1;min-width:260px"><label class="drop" id="idrop"><input type="file" id="ifile" accept=".xlsx,.csv,.tsv,.txt">${ic('upload', 'lg')}<b>Choose or drop a spreadsheet</b><span class="muted small">Excel (.xlsx) or CSV. Columns are matched by their headings.</span></label>
            <div style="margin-top:10px"><button class="btn sm" data-act="eq-template">${ic('download', 'sm')} Download the template</button></div></div>
          <div style="flex:1;min-width:260px">${UI.field('…or paste a list', `<textarea class="in" id="ipaste" style="min-height:150px" placeholder="One item per line:\nProjector, 6, Video, AV closet\nWireless mic, 8, Audio, AV closet\n\nOr paste rows straight from Excel."></textarea>`, 'Order: Item, Quantity, Category, Location. A header row is fine too.')}
            <button class="btn sm" id="iparse" style="margin-top:8px">Read the list</button></div></div>
          <div id="imsg" class="small" style="margin-top:12px;color:var(--bad)"></div></div>
        <div id="imp2" class="hide"></div>`,
      actions: [{ label: 'Close' }, { label: 'Add items', cls: 'primary hide', icon: 'check', run: () => commit() }],
      onMount: (mm) => {
        const el = mm.el, file = UI.$('#ifile', el), drop = UI.$('#idrop', el);
        file.onchange = async () => { if (file.files[0]) show(await readFile(file.files[0])); };
        ['dragover', 'dragenter'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add('over'); }));
        ['dragleave', 'drop'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
        drop.addEventListener('drop', async (e) => { if (e.dataTransfer.files[0]) show(await readFile(e.dataTransfer.files[0])); });
        UI.$('#iparse', el).onclick = () => { const t = UI.$('#ipaste', el).value; if (!t.trim()) { UI.$('#imsg', el).textContent = 'Paste a list first.'; return; } show(X.itemsFromRows(X.parseCSV(t))); };
        el.addEventListener('input', onEdit); el.addEventListener('change', onEdit);
      },
    });
    const addBtn = () => UI.$$('.df .btn', m.el).find((b) => b.classList.contains('primary'));
    async function readFile(f) { try { return await X.readInventoryFile(f); } catch (e) { console.error(e); return { items: [], unknown: [], error: 'Could not read that file: ' + e.message }; } }
    function show(res) {
      if (res.error) { UI.$('#imsg', m.el).textContent = res.error; return; }
      const have = new Set(Store.state.inventory.map((i) => U.itemKey(i.name) + '|' + (i.location || '').toLowerCase()));
      items = res.items.map((i, k) => { const dupe = have.has(U.itemKey(i.name) + '|' + i.location.toLowerCase()); return Object.assign({ _k: k, dupe, include: !dupe }, i); });
      UI.$('#imp1', m.el).classList.add('hide');
      const p = UI.$('#imp2', m.el);
      p.classList.remove('hide');
      addBtn().classList.remove('hide');
      const n = items.filter((i) => i.include).length;
      p.innerHTML = `<div class="callout info" style="margin-bottom:12px">${ic('info')}<div>Found <b>${UI.plural(items.length, 'item')}</b>.${res.unknown && res.unknown.length ? ` Ignored columns: ${res.unknown.map(esc).join(', ')}.` : ''} Untick anything you don't want. Items already listed in the same place are unticked.</div></div>
        <div class="scroll-x card"><table class="tbl tight" style="min-width:780px"><thead><tr><th></th><th>Item</th><th>Category</th><th>Location</th><th class="num">Qty</th><th>Condition</th><th>Rentable</th></tr></thead><tbody>
        ${items.map((i) => `<tr data-k="${i._k}"><td><input type="checkbox" data-f="include" ${i.include ? 'checked' : ''}></td><td><input class="in sm" data-f="name" value="${esc(i.name)}">${i.dupe ? '<span class="tag warn" style="margin-top:3px">Already listed</span>' : ''}</td><td><input class="in sm" data-f="category" value="${esc(i.category)}"></td><td><input class="in sm" data-f="location" value="${esc(i.location)}"></td><td class="num"><input class="in sm num" type="number" min="0" data-f="qty" value="${i.qty}" style="max-width:66px"></td><td class="small">${esc(i.condition)}</td><td class="small">${i.rentable ? 'Yes' + (i.rentCost ? ' · $' + i.rentCost : '') : 'No'}</td></tr>`).join('')}</tbody></table></div>
        <div class="row" style="margin-top:10px"><button class="btn sm" data-act="eq-import-back">Start over</button></div>`;
      setLabel();
    }
    function setLabel() { const b = addBtn(); const n = items.filter((i) => i.include).length; b.lastChild.textContent = ` Add ${n} item${n === 1 ? '' : 's'}`; b.disabled = !n; }
    UI.Acts['eq-import-back'] = () => { UI.$('#imp1', m.el).classList.remove('hide'); UI.$('#imp2', m.el).classList.add('hide'); addBtn().classList.add('hide'); items = []; };
    function onEdit(e) {
      const t = e.target, tr = t.closest('tr[data-k]');
      if (!tr || !t.dataset.f) return;
      const it = items[+tr.dataset.k];
      it[t.dataset.f] = t.dataset.f === 'include' ? t.checked : t.dataset.f === 'qty' ? Math.max(0, Math.round(+t.value || 0)) : t.value;
      setLabel();
    }
    function commit() {
      const chosen = items.filter((i) => i.include && String(i.name).trim());
      if (!chosen.length) return false;
      Store.update((s) => {
        chosen.forEach((i) => s.inventory.push(Store.newItem({ name: i.name.trim(), category: i.category, model: i.model, assetTag: i.assetTag, serial: i.serial, location: i.location, qty: i.qty, out: Math.min(i.out || 0, i.qty), condition: i.condition, purchased: i.purchased, value: i.value, rentable: i.rentable, rentCost: i.rentCost, notes: i.notes })));
        s.meta.invConfirmed = true;
      });
      UI.toast(`Added ${UI.plural(chosen.length, 'item')}`, 'ok');
    }
  };
  UI.Acts['eq-template'] = async (el) => {
    el.disabled = true;
    try { await X.save(await X.templateWorkbook(), 'AV-inventory-import-template.xlsx'); } catch (e) { UI.toast('Could not build the template: ' + e.message, 'bad'); }
    el.disabled = false;
  };

  /* ======================= forecast ======================= */
  function rentalList(inv) {
    const by = {};
    inv.alerts.filter((a) => a.level === 'short').forEach((a) => {
      const r = (by[a.item] = by[a.item] || { item: a.item, need: 0, days: [], cost: 0, rentable: a.rentable !== false });
      r.need = Math.max(r.need, a.need); r.days.push(a.date); r.cost += a.rentCost || 0;
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
    if (!used.length) return `<div class="callout info">${ic('info')}<div>No equipment is booked for ${esc(U.fmtWeek(wk))}. Add AV items to events and the forecast appears here.</div></div>`;
    if (rent.length) {
      h += `<div class="card pad" style="margin-bottom:16px"><div class="row"><h3>Rental shopping list</h3><span class="right tag bad">about ${UI.money(inv.rentalCost)}</span></div>
        <div class="col" style="gap:8px;margin-top:10px">${rent.map((r) => `<div class="callout bad">${ic('box')}<div class="grow"><b>Rent ${r.need} more ${esc(r.item)}${r.need > 1 ? 's' : ''}</b><div class="small">Needed ${r.days.sort().map(U.fmtDay).join(', ')}${r.cost ? ` · about ${UI.money(r.cost)}` : ''}${r.rentable ? '' : ' · marked not rentable, so look for a swap or a schedule change'}</div></div></div>`).join('')}</div></div>`;
    }
    h += `<div class="card scroll-x"><table class="tbl"><thead><tr><th>Item</th><th class="num">Available</th>${inv.dates.map((d) => `<th class="num">${U.DOW[U.dow(d)]} ${U.parseDate(d).getDate()}</th>`).join('')}<th>Status</th></tr></thead><tbody>
      ${used.map((r) => `<tr><td><b>${esc(r.name)}</b>${r.inInventory ? '' : ' <span class="tag warn">not in inventory</span>'}${r.out ? ` <span class="tiny muted">(${r.out} out)</span>` : ''}</td><td class="num">${r.have}</td>
        ${inv.dates.map((d) => {
          const p = r.byDate[d];
          if (!p) return '<td class="num muted">–</td>';
          const cls = p > r.have ? 'bad' : r.have && p >= Math.ceil((r.have * st.settings.lowStockPct) / 100) ? 'warn' : 'ok';
          return `<td class="num"><span class="tag ${cls}">${p}</span></td>`;
        }).join('')}
        <td>${r.status === 'short' ? '<span class="tag bad">Short</span>' : r.status === 'low' ? '<span class="tag warn">Tight</span>' : '<span class="tag ok">OK</span>'}</td></tr>`).join('')}</tbody></table></div>
      <div class="small muted" style="margin-top:8px">Numbers are the most of that item in use at the same moment on that day, counting your before/after buffers. Red means more than you have available.</div>`;
    if (idle.length) h += `<div class="small muted" style="margin-top:10px">Not used this week: ${idle.map((r) => esc(r.name)).join(', ')}</div>`;
    return h;
  }

  /* ======================= audits ======================= */
  function auditsHtml() {
    if (mem.auditId) {
      const a = Store.state.audits.find((x) => x.id === mem.auditId);
      if (a) return auditEditorHtml(a);
      mem.auditId = null;
    }
    const st = Store.state;
    const key = A.monthKey(U.today());
    const cur = A.find(st, key);
    let card;
    if (!cur) card = `<div class="row wrap"><div class="grow"><h3>${esc(A.monthLabel(key))} audit</h3><p class="muted" style="margin:4px 0 0">Not started. Starting one lists all ${st.inventory.filter((i) => i.condition !== 'Retired').length} items so you can count them, on this screen, in Excel, or on paper.</p></div><button class="btn primary" data-act="aud-start">${ic('check', 'sm')} Start ${esc(A.monthLabel(key))} audit</button></div>`;
    else if (cur.status === 'open') { const p = A.progress(cur); card = `<div class="row wrap"><div class="grow"><h3>${esc(A.monthLabel(key))} audit in progress</h3><div class="pbar" style="margin:10px 0 6px;max-width:420px"><i style="width:${p.total ? (p.done / p.total) * 100 : 0}%"></i></div><div class="small muted">${p.done} of ${p.total} items counted${cur.auditor ? ' · ' + esc(cur.auditor) : ''}</div></div><button class="btn primary" data-act="aud-open" data-id="${cur.id}">Continue audit</button></div>`; }
    else { const sm = A.summary(cur); card = `<div class="row wrap"><div class="grow"><h3>${esc(A.monthLabel(key))} audit complete</h3><p class="muted" style="margin:4px 0 0">${esc(U.fmtLong(cur.date))}${cur.auditor ? ' by ' + esc(cur.auditor) : ''} · ${sm.discrepancies.length ? `${UI.plural(sm.discrepancies.length, 'discrepancy', 'discrepancies')}` : 'no discrepancies'}</p></div><button class="btn" data-act="aud-open" data-id="${cur.id}">View</button><button class="btn navy" data-act="aud-xlsx" data-id="${cur.id}">${ic('download', 'sm')} Monthly sheet (Excel)</button></div>`; }
    const hist = st.audits.slice().sort((a, b) => String(b.month).localeCompare(String(a.month)) || (b.createdAt || 0) - (a.createdAt || 0));
    return `<div class="card pad" style="margin-bottom:20px">${card}</div>
      <div class="row" style="margin-bottom:10px"><h3 style="font-size:16px">History</h3><span class="muted small">${UI.plural(hist.length, 'audit')}</span></div>
      ${hist.length ? `<div class="card scroll-x"><table class="tbl"><thead><tr><th>Month</th><th>Date</th><th>Auditor</th><th>Status</th><th>Counted</th><th>Discrepancies</th><th></th></tr></thead><tbody>${hist.map((a) => { const sm = A.summary(a), p = A.progress(a); return `<tr class="hov"><td><b>${esc(A.monthLabel(a.month))}</b></td><td>${esc(U.fmtDay(a.date))}</td><td>${esc(a.auditor) || '<span class="muted">—</span>'}</td><td>${a.status === 'done' ? '<span class="tag ok">Completed</span>' : '<span class="tag warn">In progress</span>'}</td><td>${p.done}/${p.total}</td><td>${sm.discrepancies.length ? `<span class="tag bad">${sm.discrepancies.length}</span>` : '<span class="muted">None</span>'}</td>
        <td class="nowrap"><button class="btn sm" data-act="aud-open" data-id="${a.id}">${a.status === 'done' ? 'View' : 'Continue'}</button> <button class="btn ghost icon sm" data-act="aud-xlsx" data-id="${a.id}" title="Download Excel">${ic('download', 'sm')}</button> <button class="btn ghost icon sm danger" data-act="aud-del" data-id="${a.id}" title="Delete">${ic('trash', 'sm')}</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="card pad muted">No audits yet. Your monthly audits will be listed here, each with its Excel sheet.</div>'}`;
  }

  const getAudit = (id) => Store.state.audits.find((a) => a.id === id);
  UI.Acts['aud-open'] = (el) => { mem.auditId = el.dataset.id; mem.aq = ''; mem.aloc = ''; mem.aonly = false; UI.render(); window.scrollTo(0, 0); };
  UI.Acts['aud-back'] = () => { mem.auditId = null; UI.render(); };
  UI.Acts['aud-del'] = async (el) => {
    const a = getAudit(el.dataset.id);
    if (a && (await UI.confirm({ title: 'Delete this audit?', message: `${esc(A.monthLabel(a.month))} will be removed from the history. Inventory counts already applied stay as they are.`, ok: 'Delete', danger: true }))) Store.update((s) => { s.audits = s.audits.filter((x) => x.id !== a.id); });
  };
  UI.Acts['aud-start'] = () => startAudit();
  function startAudit(then) {
    const st = Store.state;
    const key = A.monthKey(U.today());
    const auditor = (() => { try { return localStorage.getItem('ih-auditor') || ''; } catch (e) { return ''; } })();
    UI.modal({
      title: 'Start an audit', narrow: true,
      body: `<div class="form-grid"><div class="span-6">${UI.field('Month', `<input class="in" type="month" name="month" value="${key}">`)}</div><div class="span-6">${UI.field('Audit date', `<input class="in" type="date" name="date" value="${U.today()}">`)}</div>
        <div class="span-12">${UI.field('Auditor', `<input class="in" name="auditor" value="${esc(auditor)}" placeholder="Your name">`)}</div>
        <div class="span-12 small muted">Every item that isn't retired goes on the list with the count you have on file. You fill in what you actually find.</div></div>`,
      actions: [{ label: 'Cancel' }, {
        label: 'Start audit', cls: 'primary', icon: 'check',
        run: (m) => {
          const v = UI.formVals(m.el);
          const existing = (st.audits || []).find((a) => a.month === v.month && a.status === 'open');
          if (existing) { mem.auditId = existing.id; UI.toast('That month already has an audit in progress. Opening it.'); UI.render(); return; }
          try { localStorage.setItem('ih-auditor', v.auditor.trim()); } catch (e) { /* ignore */ }
          const a = A.create(Store.state, { month: v.month || key, date: v.date || U.today(), auditor: v.auditor.trim() });
          Store.update((s) => { s.audits.push(a); });
          mem.tab = 'audits'; mem.auditId = a.id;
          UI.render();
          if (then) then(a);
        },
      }],
    });
  }

  // The open audit for this month, or a new one (used by the blank-sheet buttons so imports can match lines by ID).
  function ensureAudit() {
    const key = A.monthKey(U.today());
    let a = Store.state.audits.find((x) => x.month === key && x.status === 'open');
    if (!a) { a = A.create(Store.state, { month: key }); Store.update((s) => { s.audits.push(a); }); }
    return a;
  }
  UI.Acts['aud-blank'] = async (el) => {
    const a = ensureAudit();
    el.disabled = true;
    try { await X.save(await X.auditWorkbook(Store.state, a, { prefill: false }), `AV-audit-sheet_${a.month}.xlsx`); UI.toast('Fillable sheet downloaded. Fill the yellow cells, then import it back here.', 'ok'); }
    catch (e) { console.error(e); UI.toast('Could not build the sheet: ' + e.message, 'bad'); }
    el.disabled = false;
  };
  UI.Acts['aud-print-blank'] = () => { const a = ensureAudit(); printAudit(a, true); };
  UI.Acts['aud-xlsx'] = async (el) => {
    const a = getAudit(el.dataset.id);
    if (!a) return;
    el.disabled = true;
    try {
      await X.save(await X.auditWorkbook(Store.state, a, { prefill: true, results: true }), `AV-inventory-audit_${a.month}.xlsx`);
      UI.toast('Monthly inventory sheet downloaded', 'ok');
    } catch (e) { console.error(e); UI.toast('Could not build the sheet: ' + e.message, 'bad'); }
    el.disabled = false;
  };

  /* ---------- the audit screen ---------- */
  function lineRow(a, l, ro) {
    const v = A.variance(l);
    const has = l.counted != null && l.counted !== '';
    return `<tr data-l="${l.id}" class="${has ? 'done' : ''} ${(+l.out || 0) > 0 || l.condition === 'Needs repair' ? 'off' : ''}">
      <td class="nm"><b>${esc(l.name)}</b><div class="tiny muted">${[l.category, l.model, l.assetTag ? '#' + l.assetTag : '', l.serial ? 'S/N ' + l.serial : ''].filter(Boolean).map(esc).join(' · ')}</div></td>
      <td class="num">${l.expected}</td>
      <td class="num nowrap"><div class="row" style="gap:4px;justify-content:flex-end"><input class="in sm num" type="number" min="0" data-al="counted" value="${has ? l.counted : ''}" ${ro ? 'disabled' : ''} style="max-width:70px" aria-label="Counted">${ro ? '' : `<button class="btn xs icon" data-act="al-match" title="Count matches what's expected">${ic('check', 'sm')}</button>`}</div></td>
      <td class="num"><input class="in sm num" type="number" min="0" data-al="out" value="${+l.out || 0}" ${ro ? 'disabled' : ''} style="max-width:60px" aria-label="Out of service"></td>
      <td><select class="in sm" data-al="condition" ${ro ? 'disabled' : ''}>${Store.CONDITIONS.map((c) => UI.opt(c, c, l.condition === c)).join('')}</select></td>
      <td><input class="in sm" data-al="notes" value="${esc(l.notes)}" ${ro ? 'disabled' : ''} placeholder="Notes" style="min-width:140px"></td>
      <td class="num vcell">${vchip(v)}</td></tr>`;
  }
  const vchip = (v) => (v == null ? '<span class="vchip e">–</span>' : v === 0 ? '<span class="vchip z">0</span>' : `<span class="vchip ${v < 0 ? 'n' : 'p'}">${v > 0 ? '+' : ''}${v}</span>`);

  function auditEditorHtml(a) {
    const ro = a.status === 'done';
    const p = A.progress(a);
    const q = mem.aq.trim().toLowerCase();
    const lines = a.lines.filter((l) => (!q || [l.name, l.category, l.model, l.assetTag, l.serial, l.location].join(' ').toLowerCase().includes(q)) && (!mem.aloc || (l.location || 'No location') === mem.aloc) && (!mem.aonly || l.counted == null || l.counted === ''));
    const locs = uniq(a.lines.map((l) => l.location || 'No location'));
    let rows = '', last = null;
    lines.forEach((l) => {
      const loc = l.location || 'No location';
      if (loc !== last) { const n = lines.filter((x) => (x.location || 'No location') === loc).length; rows += `<tr class="grp"><td colspan="7">${esc(loc)} · ${UI.plural(n, 'item')}</td></tr>`; last = loc; }
      rows += lineRow(a, l, ro);
    });
    if (!lines.length) rows = '<tr><td colspan="7"><div class="empty" style="padding:26px"><p style="margin:0">Nothing matches these filters.</p></div></td></tr>';
    const extras = (a.extras || []).map((x) => `<div class="row wrap" data-x="${x.id}" style="gap:8px;margin-bottom:8px"><input class="in sm" data-ax="name" value="${esc(x.name)}" placeholder="Item found" style="flex:2;min-width:160px" ${ro ? 'disabled' : ''}><input class="in sm num" type="number" min="1" data-ax="qty" value="${x.qty || 1}" style="max-width:70px" ${ro ? 'disabled' : ''}><input class="in sm" data-ax="location" value="${esc(x.location)}" placeholder="Where" style="flex:1;min-width:110px" ${ro ? 'disabled' : ''}><input class="in sm" data-ax="notes" value="${esc(x.notes)}" placeholder="Notes" style="flex:2;min-width:140px" ${ro ? 'disabled' : ''}>${ro ? '' : `<button class="btn ghost icon sm danger" data-act="ax-rm" data-id="${x.id}">${ic('x', 'sm')}</button>`}</div>`).join('');
    const sm = A.summary(a);
    return `<div class="row wrap noprint" style="margin-bottom:14px"><button class="btn ghost sm" data-act="aud-back">${ic('left', 'sm')} All audits</button><h2 style="font-family:var(--serif);font-weight:400;font-size:26px;color:var(--navy)">${esc(A.monthLabel(a.month))} audit</h2>${ro ? '<span class="tag ok">Completed</span>' : '<span class="tag warn">In progress</span>'}</div>
      <div class="card pad" style="margin-bottom:16px"><div class="form-grid" id="aud-meta">
        <div class="span-4">${UI.field('Auditor', `<input class="in" data-am="auditor" value="${esc(a.auditor)}" ${ro ? 'disabled' : ''} placeholder="Your name">`)}</div>
        <div class="span-3">${UI.field('Date', `<input class="in" type="date" data-am="date" value="${esc(a.date)}" ${ro ? 'disabled' : ''}>`)}</div>
        <div class="span-5">${UI.field('Notes', `<input class="in" data-am="notes" value="${esc(a.notes)}" ${ro ? 'disabled' : ''} placeholder="Anything worth remembering about this audit">`)}</div></div>
        <div class="row wrap" style="margin-top:14px;gap:14px"><div class="grow" style="min-width:220px"><div class="pbar"><i id="a-pbar" style="width:${p.total ? (p.done / p.total) * 100 : 0}%"></i></div><div class="small muted" style="margin-top:5px" id="a-ptxt">${p.done} of ${p.total} counted${ro ? ` · ${UI.plural(sm.discrepancies.length, 'discrepancy', 'discrepancies')}` : ''}</div></div>
        <div class="row wrap noprint" style="gap:8px">${ro
          ? `<button class="btn navy" data-act="aud-xlsx" data-id="${a.id}">${ic('download', 'sm')} Monthly sheet (Excel)</button><button class="btn" data-act="aud-print" data-id="${a.id}">${ic('print', 'sm')} Print</button>`
          : `<button class="btn" data-act="aud-fill">Fill uncounted with expected</button><button class="btn" data-act="aud-xlsx-fill" data-id="${a.id}">${ic('download', 'sm')} Fillable Excel</button><button class="btn" data-act="aud-import">${ic('upload', 'sm')} Import filled Excel</button><button class="btn" data-act="aud-print" data-id="${a.id}">${ic('print', 'sm')} Print</button><button class="btn primary" data-act="aud-finish" data-id="${a.id}">${ic('check', 'sm')} Finish audit</button>`}</div></div></div>
      <div class="filters noprint"><input class="in sm grow-in" id="aud-q" placeholder="Search items…" value="${esc(mem.aq)}" data-input="aud-q">
        <select class="in sm" data-change="aud-loc"><option value="">All locations</option>${locs.map((c) => UI.opt(c, c, mem.aloc === c)).join('')}</select>
        <label class="check small"><input type="checkbox" data-change="aud-only" ${mem.aonly ? 'checked' : ''}> Uncounted only</label><span class="muted small">${lines.length} of ${a.lines.length} shown</span></div>
      <div class="card scroll-x"><table class="tbl audit"><thead><tr><th>Item</th><th class="num">Expected</th><th class="num">Counted</th><th class="num">Out</th><th>Condition</th><th>Notes</th><th class="num">Diff</th></tr></thead><tbody id="audit-body">${rows}</tbody></table></div>
      <div class="card pad" style="margin-top:16px"><div class="row" style="margin-bottom:8px"><h3 style="font-size:15px">Found but not on the list</h3>${ro ? '' : `<button class="btn sm right" data-act="ax-add">${ic('plus', 'sm')} Add</button>`}</div><div id="extras">${extras || '<div class="muted small">Nothing extra found.</div>'}</div></div>`;
  }

  function mountAudit(main) {
    const a = getAudit(mem.auditId);
    if (!a || a.status === 'done') return;
    const refresh = (tr, l) => {
      const has = l.counted != null && l.counted !== '';
      tr.classList.toggle('done', has);
      tr.classList.toggle('off', (+l.out || 0) > 0 || l.condition === 'Needs repair');
      UI.$('.vcell', tr).innerHTML = vchip(A.variance(l));
      const p = A.progress(a);
      UI.$('#a-pbar').style.width = (p.total ? (p.done / p.total) * 100 : 0) + '%';
      UI.$('#a-ptxt').textContent = `${p.done} of ${p.total} counted`;
    };
    const body = UI.$('#audit-body', main);
    const onLine = (e) => {
      const t = e.target, tr = t.closest('tr[data-l]');
      if (!tr || !t.dataset.al) return;
      const l = a.lines.find((x) => x.id === tr.dataset.l);
      if (!l) return;
      const k = t.dataset.al;
      if (k === 'counted') l.counted = t.value === '' ? null : Math.max(0, Math.round(+t.value));
      else if (k === 'out') l.out = Math.max(0, Math.round(+t.value || 0));
      else l[k] = t.value;
      refresh(tr, l);
      saveSoon();
    };
    body.addEventListener('input', onLine); body.addEventListener('change', onLine);
    UI.Acts['al-match'] = (el) => {
      const tr = el.closest('tr[data-l]'); const l = a.lines.find((x) => x.id === tr.dataset.l);
      l.counted = l.expected;
      UI.$('[data-al=counted]', tr).value = l.expected;
      refresh(tr, l); saveSoon();
    };
    UI.$('#aud-meta', main).addEventListener('input', (e) => { const k = e.target.dataset.am; if (k) { a[k] = e.target.value; saveSoon(); } });
    const ex = UI.$('#extras', main);
    ex.addEventListener('input', (e) => {
      const t = e.target, row = t.closest('[data-x]'); if (!row || !t.dataset.ax) return;
      const x = a.extras.find((z) => z.id === row.dataset.x); if (!x) return;
      x[t.dataset.ax] = t.dataset.ax === 'qty' ? Math.max(1, Math.round(+t.value || 1)) : t.value; saveSoon();
    });
  }
  UI.Changes['aud-q'] = (el) => { mem.aq = el.value; const p = el.selectionStart; UI.render(); refocus('#aud-q', p); };
  UI.Changes['aud-loc'] = (el) => { mem.aloc = el.value; UI.render(); };
  UI.Changes['aud-only'] = (el) => { mem.aonly = el.checked; UI.render(); };
  UI.Acts['ax-add'] = () => { const a = getAudit(mem.auditId); Store.update((s) => { s.audits.find((x) => x.id === a.id).extras.push({ id: U.uid('ax'), name: '', qty: 1, location: '', category: '', notes: '' }); }); UI.rerender(); };
  UI.Acts['ax-rm'] = (el) => { Store.update((s) => { const a = s.audits.find((x) => x.id === mem.auditId); a.extras = a.extras.filter((x) => x.id !== el.dataset.id); }); UI.rerender(); };
  UI.Acts['aud-fill'] = async () => {
    const a = getAudit(mem.auditId);
    const n = a.lines.filter((l) => l.counted == null || l.counted === '').length;
    if (!n) { UI.toast('Everything is already counted'); return; }
    if (await UI.confirm({ title: 'Fill the rest with expected counts?', message: `${UI.plural(n, 'item')} you haven't counted will be marked as matching what you have on file. Only do this for things you really checked.`, ok: 'Fill them in' })) {
      Store.update((s) => { s.audits.find((x) => x.id === a.id).lines.forEach((l) => { if (l.counted == null || l.counted === '') l.counted = l.expected; }); });
      UI.rerender();
    }
  };
  UI.Acts['aud-xlsx-fill'] = async (el) => {
    const a = getAudit(el.dataset.id); el.disabled = true;
    try { Store.save(); await X.save(await X.auditWorkbook(Store.state, a, { prefill: true }), `AV-audit-sheet_${a.month}.xlsx`); UI.toast('Fillable sheet downloaded', 'ok'); }
    catch (e) { console.error(e); UI.toast('Could not build the sheet: ' + e.message, 'bad'); }
    el.disabled = false;
  };
  UI.Acts['aud-import'] = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.xlsx';
    inp.onchange = async () => {
      if (!inp.files[0]) return;
      const a = getAudit(mem.auditId);
      try {
        const got = await X.readAuditFile(inp.files[0]);
        let hit = 0, skipped = 0;
        Store.update((s) => {
          const au = s.audits.find((x) => x.id === a.id);
          Object.entries(got.lines).forEach(([id, v]) => {
            const l = au.lines.find((x) => x.id === id);
            if (!l) { skipped++; return; }
            if (v.counted == null) return;
            l.counted = v.counted; if (v.out != null) l.out = v.out; if (v.condition) l.condition = v.condition; if (v.notes) l.notes = v.notes; hit++;
          });
          got.extras.forEach((x) => { if (!au.extras.some((z) => z.name.toLowerCase() === x.name.toLowerCase())) au.extras.push(x); });
          if (got.auditor && !au.auditor) au.auditor = got.auditor;
        });
        UI.rerender();
        UI.toast(`Read ${hit} counted item${hit === 1 ? '' : 's'}${got.extras.length ? ` and ${got.extras.length} extra` : ''}${skipped ? `. ${skipped} rows didn't match this audit and were skipped` : ''}.`, hit ? 'ok' : 'bad');
      } catch (e) { console.error(e); UI.toast(e.message || 'Could not read that file', 'bad'); }
    };
    inp.click();
  };
  UI.Acts['aud-print'] = (el) => { const a = getAudit(el.dataset.id); if (a) printAudit(a, false); };
  UI.Acts['aud-finish'] = (el) => {
    const a = getAudit(el.dataset.id);
    Store.save();
    const sm = A.summary(a);
    UI.modal({
      title: 'Finish the audit', wide: false,
      body: `<div class="col" style="gap:12px">
        ${sm.uncounted ? `<div class="callout warn">${ic('alert')}<div><b>${UI.plural(sm.uncounted, 'item')} not counted.</b> They keep their current numbers and show as uncounted in the report.</div></div>` : `<div class="callout ok">${ic('check')}<div>Every item is counted.</div></div>`}
        <div class="row wrap" style="gap:18px"><div><div class="tiny muted">Counted</div><b style="font-size:20px">${sm.counted}</b></div><div><div class="tiny muted">Discrepancies</div><b style="font-size:20px;color:${sm.discrepancies.length ? 'var(--bad)' : 'var(--ok)'}">${sm.discrepancies.length}</b></div><div><div class="tiny muted">Units missing</div><b style="font-size:20px">${sm.missingUnits}</b></div><div><div class="tiny muted">Units extra</div><b style="font-size:20px">${sm.extraUnits}</b></div><div><div class="tiny muted">Out / needs repair</div><b style="font-size:20px">${sm.needsAttention.length}</b></div></div>
        ${sm.discrepancies.length ? `<div class="card" style="max-height:170px;overflow:auto"><table class="tbl tight"><tbody>${sm.discrepancies.map((d) => `<tr><td><b>${esc(d.line.name)}</b> <span class="muted small">${esc(d.line.location)}</span></td><td class="num">expected ${d.line.expected}</td><td class="num">counted ${d.line.counted}</td><td class="num">${vchip(d.diff)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        <label class="check"><input type="checkbox" id="fin-apply" checked> Update my inventory to the counts I entered (quantities, out of service, condition)</label>
        ${sm.extras.length ? `<label class="check"><input type="checkbox" id="fin-extras" checked> Add the ${UI.plural(sm.extras.length, 'extra item')} I found to the inventory</label>` : ''}
        <div class="small muted">After finishing, the audit becomes a read-only record and you can download the monthly sheet.</div></div>`,
      actions: [{ label: 'Keep counting' }, {
        label: 'Finish audit', cls: 'primary', icon: 'check',
        run: (m) => {
          const apply = UI.$('#fin-apply', m.el).checked, extras = !!(UI.$('#fin-extras', m.el) && UI.$('#fin-extras', m.el).checked);
          Store.update((s) => { A.finalize(s, s.audits.find((x) => x.id === a.id), { applyCounts: apply, addExtras: extras }); s.meta.invConfirmed = true; });
          UI.toast('Audit finished. Download the monthly sheet any time from this page.', 'ok');
        },
      }],
    });
  };

  /* ---------- printable sheet ---------- */
  function printAudit(a, blank) {
    const byLoc = {};
    a.lines.forEach((l) => (byLoc[l.location || 'No location'] = byLoc[l.location || 'No location'] || []).push(l));
    const box = '<span style="display:inline-block;width:11px;height:11px;border:1.4px solid #000;margin-right:3px;vertical-align:-2px"></span>';
    const css = `@page { size: landscape; margin: 0.4in; } #print-root table { width:100%; border-collapse:collapse; font-size:10.5px; } #print-root th { background:#10294B; color:#fff; text-align:left; padding:5px 6px; font-size:10px; letter-spacing:.04em; -webkit-print-color-adjust:exact; print-color-adjust:exact; } #print-root td { border:1px solid #888; padding:6px; vertical-align:middle; } #print-root tr { page-break-inside:avoid; } #print-root td.c { text-align:center; } #print-root .loc td { background:#e9e5dc; font-weight:700; text-transform:uppercase; letter-spacing:.06em; font-size:10px; -webkit-print-color-adjust:exact; print-color-adjust:exact; } #print-root h1 { font-size:20px; margin:0; color:#10294B; font-family:Ovo,Georgia,serif; font-weight:400; } #print-root .meta { display:flex; gap:26px; margin:8px 0 12px; font-size:12px; } #print-root .ln { display:inline-block; border-bottom:1px solid #000; min-width:170px; height:14px; }`;
    let rows = '';
    Object.keys(byLoc).sort((x, y) => x.localeCompare(y)).forEach((loc) => {
      rows += `<tr class="loc"><td colspan="6">${esc(loc)}</td></tr>`;
      byLoc[loc].forEach((l) => {
        const has = !blank && l.counted != null && l.counted !== '';
        rows += `<tr><td><b>${esc(l.name)}</b><div style="color:#555;font-size:9.5px">${[l.category, l.model, l.assetTag ? '#' + l.assetTag : '', l.serial ? 'S/N ' + l.serial : ''].filter(Boolean).map(esc).join(' · ')}</div></td><td class="c">${l.expected}</td><td class="c" style="width:60px;font-size:13px;font-weight:700">${has ? l.counted : ''}</td><td class="c" style="width:44px">${!blank && +l.out ? l.out : ''}</td><td style="width:170px;white-space:nowrap">${['Good', 'Fair', 'Repair'].map((c) => `${box}${c}`).join(' &nbsp;')}</td><td style="width:180px">${!blank ? esc(l.notes) : ''}</td></tr>`;
      });
    });
    const html = `<h1>Hotel Illinois Conference Center · AV equipment audit</h1>
      <div class="meta"><div><b>Month:</b> ${esc(A.monthLabel(a.month))}</div><div><b>Auditor:</b> ${a.auditor ? esc(a.auditor) : '<span class="ln"></span>'}</div><div><b>Date:</b> ${blank ? '<span class="ln" style="min-width:110px"></span>' : esc(a.date)}</div><div style="margin-left:auto;color:#555">Count what you find. Write broken or away units under Out.</div></div>
      <table><thead><tr><th>Item</th><th style="text-align:center">Expected</th><th style="text-align:center">Counted</th><th style="text-align:center">Out</th><th>Condition</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="margin-top:14px;font-size:12px"><b>Found but not on the list:</b><div style="border-bottom:1px solid #000;height:22px"></div><div style="border-bottom:1px solid #000;height:22px"></div><div style="border-bottom:1px solid #000;height:22px"></div></div>
      <div style="margin-top:18px;font-size:12px">Signed <span class="ln"></span> &nbsp;&nbsp; Date <span class="ln" style="min-width:110px"></span></div>`;
    UI.printHtml(html, css);
  }
})(typeof window !== 'undefined' ? window : globalThis);
