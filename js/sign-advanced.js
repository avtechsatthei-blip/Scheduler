/* Advanced room signs: several time-of-day slides for one event (e.g. 10am Presentation 1, 11am
 * Presentation 2), each its own PNG (and optionally its own BrightSign file), each with its own
 * design if you want — including that design's own logo size/position and text size/position. */
(function (root) {
  const IH = root.IH, U = IH.U, UI = IH.UI, Store = IH.Store, Sign = IH.Sign, SD = IH.SignDesigner;
  const { esc, icon: ic } = UI;
  const SA = (IH.SignAdvanced = {});
  const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  const CUSTOM = '__custom';

  SA.open = (ctx) => {
    const st = Store.state;
    const all = Sign.allThemes(st);
    const rows = [
      { time: ctx.event.start || '', title: ctx.spec.name, themeKey: ctx.fallbackKey, inline: null },
      { time: U.fromMin(Math.min(1439, U.toMin(ctx.event.start || '09:00') + 60)), title: '', themeKey: ctx.fallbackKey, inline: null },
    ];
    let results = [];
    let wired = {}; // row index -> { redraw } for any row currently showing its own custom designer

    const themeOf = (r) => (r.themeKey === CUSTOM && r.inline ? r.inline : Sign.resolveTheme(st, r.themeKey));
    const sampleFor = (r) => ({ name: r.title.trim() || ctx.spec.name, room: ctx.spec.room });

    const rowHtml = (r, i) => `<div class="card pad" data-ri="${i}">
        <div class="row wrap" style="gap:8px;align-items:flex-end">
          ${UI.field('Time', `<input class="in sm" type="time" data-r="time" value="${esc(r.time)}">`)}
          ${UI.field('Title on the sign', `<input class="in sm" data-r="title" value="${esc(r.title)}" placeholder="${esc(ctx.spec.name)}" style="min-width:200px">`)}
          ${UI.field('Design', `<select class="in sm" data-r="themeKey">${all.map((t) => UI.opt(t.key, t.label, t.key === r.themeKey)).join('')}${UI.opt(CUSTOM, 'Custom for this time', r.themeKey === CUSTOM)}</select>`)}
          ${rows.length > 1 ? `<button class="btn ghost icon sm danger" type="button" data-rmrow="${i}" title="Remove">${ic('x', 'sm')}</button>` : ''}</div>
        ${r.themeKey === CUSTOM ? `<div class="sd-inline" data-sdrow="${i}" style="margin-top:12px">${SD.fieldsHtml(r.inline)}</div>` : ''}</div>`;

    const body = `<p class="small muted" style="margin-top:0">One row per time the sign should change, e.g. 10:00 "Presentation 1", 11:00 "Presentation 2". The room stays ${esc(ctx.spec.room)}; blank titles are skipped.</p>
      <div id="sa-rows" class="col" style="gap:10px">${rows.map(rowHtml).join('')}</div>
      <div class="row" style="margin-top:10px"><button class="btn sm" type="button" id="sa-add">${ic('plus', 'sm')} Add a time</button><button class="btn sm navy" type="button" id="sa-gen">Generate previews</button></div>
      <div id="sa-results" class="row wrap" style="gap:14px;margin-top:16px"></div>`;

    let m;
    m = UI.modal({
      title: `Advanced: ${ctx.spec.name}`, wide: true,
      body,
      actions: [{ label: 'Close' }, { label: 'Download all (ZIP)', close: false, run: () => downloadAll(false) }, { label: 'Download all for BrightSign', cls: 'primary', close: false, run: () => downloadAll(true) }],
      onMount: () => wire(),
    });

    function redrawRows() {
      UI.$('#sa-rows', m.el).innerHTML = rows.map(rowHtml).join('');
      wireCustomPanels();
    }
    // (Re)wires the inline mini-designer for every row currently set to "Custom for this time".
    // Called after every redraw, since redrawing replaces that DOM outright.
    function wireCustomPanels() {
      wired = {};
      rows.forEach((r, i) => {
        if (r.themeKey !== CUSTOM) return;
        const panel = UI.$(`[data-sdrow="${i}"]`, m.el);
        if (panel) wired[i] = SD.wireFields(panel, r.inline, () => sampleFor(r));
      });
    }

    function wire() {
      wireCustomPanels(); // harmless no-op at first mount; nothing starts on Custom
      m.el.addEventListener('input', (e) => {
        const row = e.target.closest('[data-ri]'); const f = e.target.dataset.r;
        if (!row || !f) return;
        const i = +row.dataset.ri;
        rows[i][f] = e.target.value;
        if (f === 'title' && wired[i]) wired[i].redraw();
      });
      m.el.addEventListener('change', (e) => {
        const row = e.target.closest('[data-ri]'); const f = e.target.dataset.r;
        if (!row || !f) return;
        const i = +row.dataset.ri;
        rows[i][f] = e.target.value;
        if (f === 'themeKey') {
          if (e.target.value === CUSTOM && !rows[i].inline) {
            rows[i].inline = Store.laySignTheme(Store.newSignTheme(Object.assign({}, U.clone(Sign.resolveTheme(st, ctx.fallbackKey)), { id: undefined, name: undefined })));
          }
          redrawRows();
        }
      });
      m.el.addEventListener('click', async (e) => {
        if (e.target.closest('#sa-add')) { rows.push({ time: '', title: '', themeKey: ctx.fallbackKey, inline: null }); redrawRows(); }
        const rm = e.target.closest('[data-rmrow]'); if (rm) { rows.splice(+rm.dataset.rmrow, 1); redrawRows(); }
        if (e.target.closest('#sa-gen')) await generate();
        const dlone = e.target.closest('[data-dlone]');
        if (dlone) { const b = results[+dlone.dataset.dlone]; U.download(await Sign.toBlob(b.canvas), b.filename); }
        const bsone = e.target.closest('[data-bsone]');
        if (bsone) {
          const btn = bsone; btn.disabled = true;
          try {
            const b = results[+bsone.dataset.bsone];
            await IH.Imp.loadScript(JSZIP_URL);
            const built = await IH.BrightSign.build(b.canvas, b.base, Store.state.settings.brightsignFolder);
            U.download(await IH.BrightSign.exportZip(built), `${b.base}_brightsign.zip`);
          } catch (err) { console.error(err); UI.toast('Could not build the BrightSign file: ' + err.message, 'bad'); }
          btn.disabled = false;
        }
      });
    }

    async function generate() {
      const valid = rows.filter((r) => r.time && r.title.trim());
      if (!valid.length) { UI.toast('Add at least one time with a title', 'bad'); return []; }
      const built = [];
      for (const r of valid) {
        const th = themeOf(r);
        await Sign.preload(th);
        const canvas = Sign.render(sampleFor(r), { theme: th, showDate: false });
        const base = `${U.slug(ctx.spec.room)}__${U.slug(r.title.trim())}__${U.slug(U.fmtTime(r.time, true))}`;
        built.push({ row: r, canvas, base, filename: base + '.png' });
      }
      results = built;
      const box = UI.$('#sa-results', m.el);
      box.innerHTML = results.map((b, i) => `<div class="card pad" style="width:230px" data-bi="${i}">
          <div class="preview" style="margin-bottom:8px"><div class="ph"></div></div>
          <div class="small" style="font-weight:700;color:var(--navy)">${esc(U.fmtTime(b.row.time, true))}</div>
          <div class="small muted" style="margin-bottom:8px">${esc(b.row.title)}</div>
          <div class="row wrap" style="gap:6px"><button class="btn xs" type="button" data-dlone="${i}">${ic('download', 'sm')} PNG</button><button class="btn xs" type="button" data-bsone="${i}">${ic('download', 'sm')} BrightSign</button></div></div>`).join('');
      results.forEach((b, i) => box.children[i].querySelector('.ph').replaceWith(b.canvas));
      return results;
    }

    async function downloadAll(bright) {
      const built = await generate();
      if (!built.length) return;
      await IH.Imp.loadScript(JSZIP_URL);
      const zip = new root.JSZip();
      if (bright) {
        for (const b of built) {
          const bs = await IH.BrightSign.build(b.canvas, b.base, Store.state.settings.brightsignFolder);
          zip.file(bs.filename, bs.json);
          zip.file(bs.pngFilename, bs.pngBlob);
        }
      } else {
        for (const b of built) zip.file(b.filename, await Sign.toBlob(b.canvas));
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      U.download(blob, `${U.slug(ctx.spec.room)}__${U.slug(ctx.spec.name)}_${bright ? 'brightsign' : 'signs'}.zip`);
      UI.toast(`Downloaded ${built.length} sign${built.length === 1 ? '' : 's'}`, 'ok');
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
