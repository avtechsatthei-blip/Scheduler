/* Sign designer: upload a logo, match colors to it, hand-tune the palette, and either save it as a
 * reusable design or apply it to one sign only. Shared by Settings, Room signs, and the per-sign editor. */
(function (root) {
  const IH = root.IH, U = IH.U, UI = IH.UI, Store = IH.Store, Sign = IH.Sign;
  const { esc, icon: ic } = UI;
  const SD = (IH.SignDesigner = {});

  const ROLES = [
    ['bg', 'Background'],
    ['text', 'Title text'],
    ['bar', 'Room bar'],
    ['roomText', 'Room bar text'],
    ['strip', 'Accent strip'],
  ];
  const SAMPLE = { name: 'Sample Event Name', room: 'Sample Room' };

  function colorField(role, label, value) {
    return `<div class="cfield" data-role="${role}"><span class="cf-label">${label}</span>
      <span class="cf-input"><input type="color" data-c="${role}" value="${value}" aria-label="${esc(label)}"><input type="text" class="hexin" data-h="${role}" value="${esc(value.toUpperCase())}" maxlength="7"></span></div>`;
  }

  function fieldsHtml(th) {
    const hasLogo = !!th.logo;
    return `<div class="sdes">
      <div class="sdes-logo">
        <div class="logopv" id="sd-logopv">${hasLogo ? `<img src="${th.logo.src}" alt="Logo">` : `<span class="muted small">No logo yet</span>`}</div>
        <div class="col" style="gap:8px">
          <label class="btn sm">${ic('upload', 'sm')} ${hasLogo ? 'Replace logo' : 'Upload logo'}<input type="file" accept="image/*" id="sd-logofile" hidden></label>
          ${hasLogo ? `<button class="btn ghost sm" type="button" id="sd-logormv">${ic('x', 'sm')} Remove logo</button>` : ''}
          <button class="btn sm" type="button" id="sd-match" ${hasLogo ? '' : 'disabled'} title="${hasLogo ? '' : 'Upload a logo first'}">${ic('wand', 'sm')} Match colors to logo</button>
          <div class="swatches sm" id="sd-swatches"></div>
          <div class="row wrap" style="gap:10px">
            ${UI.field('Logo size', `<input class="in sm num" type="number" min="30" max="500" step="2" id="sd-logo-h" value="${hasLogo ? th.logo.h : 132}" ${hasLogo ? '' : 'disabled'} style="max-width:84px">`, 'Height, px')}
            ${UI.field('Logo position', `<input class="in sm num" type="number" min="0" max="900" step="2" id="sd-logo-y" value="${hasLogo ? th.logo.y : 62}" ${hasLogo ? '' : 'disabled'} style="max-width:84px">`, 'From the top, px')}
          </div>
        </div>
      </div>
      <div class="row wrap" style="gap:16px 22px;margin-top:16px">${ROLES.map(([role, label]) => colorField(role, label, th[role])).join('')}</div>
      <label class="check" style="margin-top:12px"><span class="switch"><input type="checkbox" id="sd-bold" ${(th.weight || 500) >= 600 ? 'checked' : ''}><i></i></span> Bold text</label>
      <div class="row wrap" style="gap:10px;margin-top:12px">
        ${UI.field('Text size', `<input class="in sm num" type="number" min="24" max="220" step="2" id="sd-text-size" value="${th.titleSize || 144}" style="max-width:84px">`, 'Largest it will print, px')}
        ${UI.field('Text position', `<input class="in sm num" type="number" min="80" max="850" step="2" id="sd-text-y" value="${th.titleCy != null ? th.titleCy : 488}" style="max-width:84px">`, 'Vertical center, px from the top')}
      </div>
      <div class="preview" id="sd-preview" style="margin-top:14px;max-width:420px"></div>
    </div>`;
  }

  // Wires up one designer block inside `el`. `th` is the mutable working theme. `sample` gives the
  // preview its title/room text (a function, so a per-sign editor can reflect what's typed above it).
  // Returns { redraw } so the caller can force a preview refresh (e.g. when the sample text changes).
  function wire(el, th, sample, onDirty) {
    const setSwatches = (list) => {
      const box = UI.$('#sd-swatches', el);
      if (!box) return;
      box.innerHTML = (list || []).map((s) => `<button type="button" data-swatch="${s.hex}" style="background:${s.hex}" title="${s.hex} — click to use as the room bar"></button>`).join('');
    };
    async function redraw() {
      await Sign.preload(th);
      const canvas = Sign.render(sample(), { theme: th, showDate: false });
      const box = UI.$('#sd-preview', el);
      if (box) { box.innerHTML = ''; box.appendChild(canvas); }
    }
    function setColor(role, hex) {
      th[role] = hex;
      Store.laySignTheme(th); // keeps the accent rule's color following the strip
      const c = UI.$(`[data-c="${role}"]`, el), h = UI.$(`[data-h="${role}"]`, el);
      if (c) c.value = hex;
      if (h) h.value = hex.toUpperCase();
      onDirty && onDirty();
      redraw();
    }
    el.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.c) setColor(t.dataset.c, t.value);
      if (t.dataset.h) { const v = t.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) setColor(t.dataset.h, v); }
      if (t.id === 'sd-logo-h' && th.logo) { th.logo.h = Math.max(10, +t.value || 132); onDirty && onDirty(); redraw(); }
      if (t.id === 'sd-logo-y' && th.logo) { th.logo.y = Math.max(0, +t.value || 0); onDirty && onDirty(); redraw(); }
      if (t.id === 'sd-text-size') { th.titleSize = Math.max(10, +t.value || 144); onDirty && onDirty(); redraw(); }
      if (t.id === 'sd-text-y') { th.titleCy = Math.max(0, +t.value || 0); onDirty && onDirty(); redraw(); }
    });
    el.addEventListener('click', (e) => {
      const sw = e.target.closest('[data-swatch]');
      if (sw) setColor('bar', sw.dataset.swatch);
    });
    UI.$('#sd-bold', el).addEventListener('change', (e) => { th.weight = e.target.checked ? 600 : 500; th.roomWeight = th.weight; onDirty && onDirty(); redraw(); });
    UI.$('#sd-logofile', el).addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) { UI.toast('That file is not an image', 'bad'); return; }
      try {
        const hadLogo = !!th.logo;
        const src = await U.fileToDataURL(f);
        const img = await U.loadImage(src);
        th.logo = { src, h: hadLogo ? th.logo.h : 132, y: hadLogo ? th.logo.y : 62 }; // keep size/position when just swapping the image
        Store.layoutForLogo(th, hadLogo);
        Sign._logoCache[src] = img;
        const palette = Sign.extractPalette(img);
        setSwatches(palette);
        UI.$('#sd-logopv', el).innerHTML = `<img src="${src}" alt="Logo">`;
        const matchBtn = UI.$('#sd-match', el);
        matchBtn.disabled = false;
        matchBtn.title = '';
        if (!UI.$('#sd-logormv', el)) matchBtn.insertAdjacentHTML('beforebegin', `<button class="btn ghost sm" type="button" id="sd-logormv">${ic('x', 'sm')} Remove logo</button>`);
        const hInput = UI.$('#sd-logo-h', el), yInput = UI.$('#sd-logo-y', el), tyInput = UI.$('#sd-text-y', el);
        if (hInput) { hInput.disabled = false; hInput.value = th.logo.h; }
        if (yInput) { yInput.disabled = false; yInput.value = th.logo.y; }
        if (tyInput && !hadLogo) tyInput.value = th.titleCy;
        onDirty && onDirty();
        redraw();
      } catch (err) { console.error(err); UI.toast('Could not read that image', 'bad'); }
    });
    el.addEventListener('click', (e) => {
      if (e.target.closest('#sd-logormv')) {
        th.logo = null;
        Store.layoutForLogo(th, true);
        UI.$('#sd-logopv', el).innerHTML = '<span class="muted small">No logo yet</span>';
        e.target.closest('#sd-logormv').remove();
        const matchBtn = UI.$('#sd-match', el);
        matchBtn.disabled = true;
        matchBtn.title = 'Upload a logo first';
        setSwatches([]);
        const hInput = UI.$('#sd-logo-h', el), yInput = UI.$('#sd-logo-y', el), tyInput = UI.$('#sd-text-y', el);
        if (hInput) hInput.disabled = true;
        if (yInput) yInput.disabled = true;
        if (tyInput) tyInput.value = th.titleCy;
        onDirty && onDirty();
        redraw();
      }
      if (e.target.closest('#sd-match')) {
        const src = th.logo && th.logo.src;
        const img = src && Sign._logoCache[src];
        if (!img) return;
        const picked = Sign.paletteToTheme(Sign.extractPalette(img));
        Object.assign(th, picked);
        Store.laySignTheme(th);
        ['bg', 'text', 'bar', 'roomText', 'strip'].forEach((role) => { const c = UI.$(`[data-c="${role}"]`, el), h = UI.$(`[data-h="${role}"]`, el); if (c) c.value = th[role]; if (h) h.value = th[role].toUpperCase(); });
        onDirty && onDirty();
        redraw();
      }
    });
    redraw();
    return { redraw };
  }
  // Exposed so other screens (the Advanced time-slot composer) can build a custom design inline
  // without duplicating this logic.
  SD.fieldsHtml = fieldsHtml;
  SD.wireFields = wire;

  /* ---------------- library: create / edit a saved design ---------------- */
  SD.openLibraryEditor = (existing) => {
    const isNew = !existing;
    const th = existing ? U.clone(existing) : Store.laySignTheme(Store.newSignTheme({ name: '' }));
    Sign.preload(th); // pick up the logo image into the cache before the first draw, if editing
    const body = `<div class="form-grid"><div class="span-12">${UI.field('Design name', `<input class="in" id="sd-name" value="${esc(th.name)}" placeholder="e.g. Acme Corp, Smith Wedding">`)}</div></div>${fieldsHtml(th)}`;
    const m = UI.modal({
      title: isNew ? 'New sign design' : 'Edit sign design', wide: true,
      body,
      actions: [{ label: 'Cancel' }].concat(isNew ? [] : [{ label: 'Delete', cls: 'danger', run: () => del(m, th) }]).concat([{ label: isNew ? 'Save design' : 'Save changes', cls: 'primary', icon: 'check', run: (mm) => save(mm, th) }]),
      onMount: (mm) => wire(mm.el, th, () => SAMPLE),
    });
  };
  function save(m, th) {
    const name = UI.$('#sd-name', m.el).value.trim();
    if (!name) { UI.toast('Give the design a name', 'bad'); UI.$('#sd-name', m.el).focus(); return false; }
    th.name = name;
    const st = Store.state;
    const exists = st.signThemes.some((x) => x.id === th.id);
    Store.update((s) => { const i = s.signThemes.findIndex((x) => x.id === th.id); if (i >= 0) s.signThemes[i] = th; else s.signThemes.push(th); });
    UI.toast(exists ? 'Design saved' : 'Design added', 'ok');
    if (SD._onSaved) SD._onSaved(th);
  }
  async function del(m, th) {
    const used = countUses(th.id);
    if (!(await UI.confirm({ title: `Delete "${esc(th.name)}"?`, message: used ? `${UI.plural(used, 'sign')} using this design will fall back to the shared theme.` : 'This design is not currently used by any sign.', ok: 'Delete', danger: true }))) return false;
    Store.update((s) => {
      s.signThemes = s.signThemes.filter((x) => x.id !== th.id);
      const key = `custom:${th.id}`;
      s.events.forEach((e) => { if (e.signOverride && e.signOverride.themeKey === key) delete e.signOverride.themeKey; });
      if (s.settings.signTheme === key) s.settings.signTheme = 'brand';
    });
    UI.toast('Design deleted', 'ok');
    if (SD._onSaved) SD._onSaved(null);
  }
  function countUses(id) {
    const key = `custom:${id}`;
    const st = Store.state;
    return (st.settings.signTheme === key ? 1 : 0) + st.events.filter((e) => e.signOverride && e.signOverride.themeKey === key).length;
  }

  /* ---------------- library manager: list, used from Settings and Room signs ---------------- */
  SD.openManager = (onChange) => {
    SD._onSaved = () => { m.close(); SD.openManager(onChange); if (onChange) onChange(); };
    const st = Store.state;
    const rows = st.signThemes.length
      ? st.signThemes.map((t) => `<div class="themerow"><span class="dot" style="background:${esc(t.bar)}"></span><div class="grow"><b>${esc(t.name)}</b>${t.logo ? '' : '<span class="muted small"> · no logo</span>'}</div>
          <button class="btn ghost icon sm" data-act="sdm-edit" data-id="${t.id}" title="Edit">${ic('edit', 'sm')}</button>
          <button class="btn ghost icon sm" data-act="sdm-dup" data-id="${t.id}" title="Duplicate">${ic('copy', 'sm')}</button>
          <button class="btn ghost icon sm danger" data-act="sdm-del" data-id="${t.id}" title="Delete">${ic('trash', 'sm')}</button></div>`).join('')
      : '<div class="muted small" style="padding:8px 0">No saved designs yet. Upload a logo and match colors to make one.</div>';
    const m = UI.modal({
      title: 'Sign designs', narrow: true,
      body: `<div class="col" style="gap:2px">${rows}</div>`,
      actions: [{ label: 'Close' }, { label: 'New design', cls: 'primary', icon: 'plus', run: () => { m.close(); SD.openLibraryEditor(null); } }],
      onClose: () => { SD._onSaved = null; if (onChange) onChange(); },
    });
    UI.Acts['sdm-edit'] = (el) => { const t = Store.state.signThemes.find((x) => x.id === el.dataset.id); m.close(); if (t) SD.openLibraryEditor(t); };
    UI.Acts['sdm-dup'] = (el) => {
      const t = Store.state.signThemes.find((x) => x.id === el.dataset.id);
      if (!t) return;
      const copy = Store.laySignTheme(Store.newSignTheme(Object.assign(U.clone(t), { id: undefined, name: t.name + ' copy' })));
      Store.update((s) => { s.signThemes.push(copy); });
      m.close(); SD.openManager(onChange);
    };
    UI.Acts['sdm-del'] = async (el) => {
      const t = Store.state.signThemes.find((x) => x.id === el.dataset.id);
      if (!t) return;
      const used = countUses(t.id);
      if (!(await UI.confirm({ title: `Delete "${esc(t.name)}"?`, message: used ? `${UI.plural(used, 'sign')} using this design will fall back to the shared theme.` : 'This design is not currently used by any sign.', ok: 'Delete', danger: true }))) return;
      Store.update((s) => {
        s.signThemes = s.signThemes.filter((x) => x.id !== t.id);
        const key = `custom:${t.id}`;
        s.events.forEach((e) => { if (e.signOverride && e.signOverride.themeKey === key) delete e.signOverride.themeKey; });
        if (s.settings.signTheme === key) s.settings.signTheme = 'brand';
      });
      m.close(); SD.openManager(onChange);
    };
  };

  /* ---------------- per-sign editor: customize one sign only ---------------- */
  // ctx: { spec: {name, room}, override: current override or null, fallbackKey: the shared theme key in
  // use, onSave(override|null) }
  SD.openSignEditor = (ctx) => {
    const st = Store.state;
    const ov = ctx.override ? U.clone(ctx.override) : {};
    const startMode = ov.themeKey ? (ov.themeKey === 'inline' ? 'custom' : 'pick') : 'shared';
    let mode = startMode;
    let pickKey = ov.themeKey && ov.themeKey !== 'inline' ? ov.themeKey : ctx.fallbackKey;
    let inline = ov.inline ? U.clone(ov.inline) : Store.laySignTheme(Store.newSignTheme(Object.assign({}, U.clone(Sign.resolveTheme(st, ctx.fallbackKey)), { id: undefined, name: undefined })));
    const all = Sign.allThemes(st);
    const sampleSpec = () => ({ name: (UI.$('#sd-title', m.el) && UI.$('#sd-title', m.el).value.trim()) || ctx.spec.name, room: (UI.$('#sd-room', m.el) && UI.$('#sd-room', m.el).value.trim()) || ctx.spec.room });

    const body = `${ctx.hideText ? '' : `<div class="form-grid">
        <div class="span-6">${UI.field('Sign text', `<input class="in" id="sd-title" value="${esc(ov.title || '')}" placeholder="${esc(ctx.spec.name)}">`, 'Blank uses the event name')}</div>
        <div class="span-6">${UI.field('Room text', `<input class="in" id="sd-room" value="${esc(ov.room || '')}" placeholder="${esc(ctx.spec.room)}">`, 'Blank uses the room name')}</div></div>`}
      <div class="seg" style="margin-top:14px">${[['shared', 'Shared design'], ['pick', 'Pick a design'], ['custom', 'Custom for this sign']].map(([k, l]) => `<button type="button" class="${mode === k ? 'on' : ''}" data-mode="${k}">${l}</button>`).join('')}</div>
      <div id="sd-shared" class="${mode === 'shared' ? '' : 'hide'}" style="margin-top:12px"><div class="preview" id="sd-preview-shared" style="max-width:420px"></div><p class="small muted" style="margin-top:8px">Uses whatever design is chosen above the sign list.</p></div>
      <div id="sd-pick" class="${mode === 'pick' ? '' : 'hide'}" style="margin-top:12px">
        <select class="in" id="sd-pickkey">${all.map((t) => UI.opt(t.key, t.label, t.key === pickKey)).join('')}</select>
        <div class="preview" id="sd-preview-pick" style="max-width:420px;margin-top:10px"></div></div>
      <div id="sd-custom" class="${mode === 'custom' ? '' : 'hide'}" style="margin-top:12px">${fieldsHtml(inline)}</div>`;

    const m = UI.modal({
      title: 'Customize this sign', wide: true,
      body,
      actions: [{ label: 'Cancel' }]
        .concat(Sign.hasOverride(ctx.override) ? [{ label: 'Reset to default', run: () => { ctx.onSave(null); } }] : [])
        .concat([{ label: 'Save', cls: 'primary', icon: 'check', run: () => finish() }]),
      onMount: (mm) => {
        let customWired = null;
        const drawShared = async () => { const th = Sign.resolveTheme(st, ctx.fallbackKey); await Sign.preload(th); const c = Sign.render(sampleSpec(), { theme: th, showDate: false }); const box = UI.$('#sd-preview-shared', mm.el); if (box) { box.innerHTML = ''; box.appendChild(c); } };
        const drawPick = async () => { const th = Sign.resolveTheme(st, pickKey); await Sign.preload(th); const c = Sign.render(sampleSpec(), { theme: th, showDate: false }); const box = UI.$('#sd-preview-pick', mm.el); if (box) { box.innerHTML = ''; box.appendChild(c); } };
        const showMode = (k) => {
          mode = k;
          UI.$$('.seg button', mm.el).forEach((b) => b.classList.toggle('on', b.dataset.mode === k));
          UI.$('#sd-shared', mm.el).classList.toggle('hide', k !== 'shared');
          UI.$('#sd-pick', mm.el).classList.toggle('hide', k !== 'pick');
          UI.$('#sd-custom', mm.el).classList.toggle('hide', k !== 'custom');
          if (k === 'shared') drawShared();
          if (k === 'pick') drawPick();
          if (k === 'custom' && customWired) customWired.redraw();
        };
        mm.el.addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) showMode(b.dataset.mode); });
        UI.$('#sd-pickkey', mm.el).addEventListener('change', (e) => { pickKey = e.target.value; drawPick(); });
        mm.el.addEventListener('input', (e) => { if (e.target.id === 'sd-title' || e.target.id === 'sd-room') { if (mode === 'shared') drawShared(); else if (mode === 'pick') drawPick(); else if (customWired) customWired.redraw(); } });
        customWired = wire(UI.$('#sd-custom', mm.el), inline, sampleSpec);
        showMode(mode);
      },
    });

    function finish() {
      const title = UI.$('#sd-title', m.el) ? UI.$('#sd-title', m.el).value.trim() : '';
      const room = UI.$('#sd-room', m.el) ? UI.$('#sd-room', m.el).value.trim() : '';
      const next = {};
      if (title) next.title = title;
      if (room) next.room = room;
      if (mode === 'pick') next.themeKey = pickKey;
      else if (mode === 'custom') { next.themeKey = 'inline'; next.inline = inline; }
      ctx.onSave(Object.keys(next).length ? next : null);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
