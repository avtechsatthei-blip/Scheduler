/* iHotel AV Scheduler — editable PowerPoint export (uses PptxGenJS, loaded on demand). */
(function (root) {
  const IH = (root.IH = root.IH || {});
  const U = IH.U;
  const P = (IH.Pptx = {});

  const URL_PPTX = 'https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js';
  const NAVY = '10294B', ORANGE = 'F15A32', CREAM = 'F9F7F4', LINE = 'E3DED5', INK = '1B2433', MUTED = '6B7485';
  const FONT = 'Montserrat';
  const hex = (c) => c.replace('#', '').toUpperCase();

  P.load = async () => {
    if (typeof PptxGenJS === 'undefined' && !root.PptxGenJS) await IH.Imp.loadScript(URL_PPTX);
    return root.PptxGenJS || PptxGenJS;
  };

  function head(text, sub) {
    return { text, sub };
  }

  function baseSlide(pptx, title, sub) {
    const s = pptx.addSlide();
    s.background = { color: CREAM };
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.9, fill: { color: NAVY }, line: { color: NAVY, width: 0 } });
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.9, w: 13.333, h: 0.06, fill: { color: ORANGE }, line: { color: ORANGE, width: 0 } });
    s.addText(title, { x: 0.45, y: 0.12, w: 9.5, h: 0.66, fontFace: FONT, fontSize: 22, bold: true, color: 'FFFFFF', valign: 'middle' });
    if (sub) s.addText(sub, { x: 8.4, y: 0.12, w: 4.5, h: 0.66, fontFace: FONT, fontSize: 12, color: 'D8DEE9', align: 'right', valign: 'middle' });
    return s;
  }

  const hcell = (text, extra) => ({ text, options: Object.assign({ bold: true, color: 'FFFFFF', fill: { color: NAVY }, fontFace: FONT, fontSize: 10, align: 'center', valign: 'middle' }, extra || {}) });
  const cell = (text, extra) => ({ text: text == null ? '' : String(text), options: Object.assign({ fontFace: FONT, fontSize: 9, color: INK, valign: 'middle' }, extra || {}) });

  function roomShort(state, sh) {
    const names = [];
    (sh.eventIds || []).forEach((id) => {
      const ev = state.events.find((e) => e.id === id);
      const r = ev && state.rooms.find((x) => x.id === ev.roomId);
      if (r && !names.includes(r.name)) names.push(r.name);
    });
    return names.join(', ');
  }

  function scheduleSlides(pptx, state, weekKey, shifts) {
    const dates = U.weekDates(weekKey);
    const staff = state.staff.filter((s) => s.active && (shifts.some((x) => x.staffId === s.id) || true));
    const mins = IH.Sched.weekMinutes(shifts, weekKey);
    const open = shifts.filter((x) => !x.staffId);
    const rows = staff.map((s) => ({ s, hrs: mins[s.id] || 0 }));
    const perSlide = 8;
    const pages = Math.max(1, Math.ceil((rows.length + (open.length ? 1 : 0)) / perSlide));
    const all = rows.slice();
    if (open.length) all.push({ open: true });
    for (let p = 0; p < pages; p++) {
      const s = baseSlide(pptx, 'Staff schedule', U.fmtWeek(weekKey) + (pages > 1 ? `  (${p + 1}/${pages})` : ''));
      const table = [[hcell('Staff', { align: 'left' })].concat(dates.map((d) => hcell(U.fmtDay(d)))).concat([hcell('Hours')])];
      all.slice(p * perSlide, (p + 1) * perSlide).forEach((r) => {
        if (r.open) {
          const cells = dates.map((d) => {
            const list = open.filter((x) => x.date === d);
            return cell(list.map((x) => `${U.fmtRange(x.start, x.end)}${x.kind === 'tech' ? ' tech' : ''}\n${roomShort(state, x)}`).join('\n'), { fill: { color: list.length ? 'F8D9D4' : 'FFFFFF' }, fontSize: 8, align: 'center', color: '9B2C1F' });
          });
          table.push([cell('OPEN SHIFTS', { bold: true, color: '9B2C1F' })].concat(cells).concat([cell('')]));
          return;
        }
        const col = hex(r.s.color);
        const cells = dates.map((d) => {
          const list = shifts.filter((x) => x.staffId === r.s.id && x.date === d);
          if (S_dayOff(r.s, d) && !list.length) return cell('Day off', { align: 'center', color: MUTED, italic: true, fontSize: 8 });
          return cell(list.map((x) => `${U.fmtRange(x.start, x.end)}${x.kind === 'tech' ? ' (tech)' : ''}\n${roomShort(state, x)}`).join('\n'), { fill: { color: list.length ? hex(U.tint('#' + col, 0.78)) : 'FFFFFF' }, align: 'center', fontSize: 8 });
        });
        table.push([cell(r.s.name, { bold: true, color: col === 'FFFFFF' ? INK : col })].concat(cells).concat([cell(r.hrs ? U.hrs(r.hrs) : '–', { align: 'center', bold: true })]));
      });
      s.addTable(table, { x: 0.35, y: 1.2, w: 12.63, colW: [1.6].concat(Array(7).fill(1.46)).concat([0.81]), rowH: 0.6, border: { type: 'solid', pt: 0.5, color: LINE }, autoPage: false });
    }
  }
  const S_dayOff = (st, d) => IH.Sched.onDayOff(st, d);

  function eventSlides(pptx, state, weekKey, shifts) {
    const evs = state.events.filter((e) => U.weekDates(weekKey).includes(e.date)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    if (!evs.length) return;
    const perSlide = 11;
    const pages = Math.ceil(evs.length / perSlide);
    for (let p = 0; p < pages; p++) {
      const s = baseSlide(pptx, 'Events and staffing', U.fmtWeek(weekKey) + (pages > 1 ? `  (${p + 1}/${pages})` : ''));
      const table = [[hcell('Day', { align: 'left' }), hcell('Time'), hcell('Event', { align: 'left' }), hcell('Room', { align: 'left' }), hcell('AV items', { align: 'left' }), hcell('Tech'), hcell('Staff', { align: 'left' })]];
      evs.slice(p * perSlide, (p + 1) * perSlide).forEach((ev) => {
        const room = state.rooms.find((r) => r.id === ev.roomId);
        const crew = shifts.filter((x) => (x.eventIds || []).includes(ev.id)).map((x) => {
          const st = state.staff.find((y) => y.id === x.staffId);
          return (st ? st.name.split(' ')[0] : 'OPEN') + (x.kind === 'tech' ? ' (tech)' : '');
        });
        const items = ev.noAV ? 'No AV' : (ev.items || []).map((i) => `${i.qty > 1 ? i.qty + '× ' : ''}${i.name}`).join(', ');
        table.push([
          cell(U.fmtDay(ev.date)), cell(U.fmtRange(ev.start, ev.end), { align: 'center' }), cell(ev.name, { bold: true }), cell(room ? room.name : ''),
          cell(items, { fontSize: 8 }), cell(IH.Sched.techPeak(ev) ? IH.Sched.techText(ev).replace(/^Tech /, '').replace(' in-room tech', '') : '–', { align: 'center', fontSize: 8 }), cell([...new Set(crew)].join(', '), { fontSize: 8 }),
        ]);
      });
      s.addTable(table, { x: 0.35, y: 1.2, w: 12.63, colW: [0.95, 1.55, 2.4, 1.9, 3.1, 0.6, 2.13], rowH: 0.46, border: { type: 'solid', pt: 0.5, color: LINE }, autoPage: false });
    }
  }

  function equipmentSlide(pptx, state, weekKey) {
    const inv = IH.Inv.analyze(state, weekKey);
    if (!inv.alerts.length) return;
    const s = baseSlide(pptx, 'Equipment check', U.fmtWeek(weekKey));
    const table = [[hcell('Item', { align: 'left' }), hcell('Day'), hcell('In use'), hcell('On hand'), hcell('Action', { align: 'left' })]];
    inv.alerts.slice(0, 12).forEach((a) => {
      const short = a.level === 'short';
      table.push([
        cell(a.item, { bold: true }), cell(U.fmtDay(a.date), { align: 'center' }), cell(a.peak, { align: 'center' }), cell(a.have, { align: 'center' }),
        cell(short ? `Rent ${a.need}${a.rentCost ? ' (about $' + a.rentCost + ')' : ''}` : 'Running low', { color: short ? '9B2C1F' : '8A5A00', bold: true }),
      ]);
    });
    s.addTable(table, { x: 0.35, y: 1.2, w: 12.63, colW: [3.3, 1.6, 1.4, 1.4, 4.93], rowH: 0.42, border: { type: 'solid', pt: 0.5, color: LINE }, autoPage: false });
    if (inv.rentalCost) s.addText(`Estimated rentals this week: $${inv.rentalCost}`, { x: 0.35, y: 6.7, w: 8, h: 0.4, fontFace: FONT, fontSize: 12, bold: true, color: NAVY });
  }

  // Editable copy of the room sign: same layout as the PNG (1920x1080 px -> 13.333 x 7.5 in). `th` is a
  // resolved theme object (built-in, saved design, or a one-off per-sign design).
  function signSlide(pptx, spec, th) {
    const px = 13.333 / 1920;
    const s = pptx.addSlide();
    s.background = { color: hex(th.bg) };
    const logoImg = th.logo && IH.Sign._logoCache[th.logo.src];
    if (th.logo && logoImg) {
      const natW = logoImg.naturalWidth || logoImg.width, natH = logoImg.naturalHeight || logoImg.height;
      const lh = th.logo.h * px, lw = (lh * natW) / natH;
      s.addImage({ data: th.logo.src, x: (13.333 - lw) / 2, y: th.logo.y * px, w: lw, h: lh });
    }
    if (th.rule) s.addShape(pptx.ShapeType.rect, { x: (1920 - th.rule.w) / 2 * px, y: th.rule.y * px, w: th.rule.w * px, h: th.rule.h * px, fill: { color: hex(th.rule.color) }, line: { color: hex(th.rule.color), width: 0 } });
    const top = th.logo ? 270 * px : 0.4;
    const bottom = 860 * px;
    s.addText(spec.name, { x: 0.25, y: top, w: 12.83, h: bottom - top, fontFace: FONT, fontSize: 72, bold: (th.weight || 500) >= 600, color: hex(th.text), align: 'center', valign: 'middle', shadow: th.shadow ? { type: 'outer', color: '000000', opacity: 0.3, blur: 3, offset: 2, angle: 45 } : undefined });
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 886 * px, w: 13.333, h: 154 * px, fill: { color: hex(th.bar) }, line: { color: hex(th.barLine), width: 1 } });
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 1040 * px, w: 13.333, h: 40 * px, fill: { color: hex(th.strip) }, line: { color: hex(th.stripLine), width: 1 } });
    s.addText(spec.room, { x: 0.02, y: 886 * px, w: 13.2, h: 154 * px, fontFace: FONT, fontSize: 66, bold: (th.roomWeight || 500) >= 600, color: hex(th.roomText), align: 'left', valign: 'middle', margin: 0.05 });
  }

  // Pixel-exact copy of the PNG sign dropped in as a picture (not editable text).
  function signImageSlide(pptx, spec, th, showDate) {
    const canvas = IH.Sign.render(spec, { theme: th, showDate });
    const s = pptx.addSlide();
    s.background = { color: 'FFFFFF' };
    s.addImage({ data: canvas.toDataURL('image/png'), x: 0, y: 0, w: 13.333, h: 7.5 });
  }

  /**
   * opts: { weekKeys: [...], includeSigns: bool, signTheme, signAsImage }
   */
  P.build = async (state, opts) => {
    const Pptx = await P.load();
    const pptx = new Pptx();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.title = 'iHotel AV schedule';
    pptx.author = 'iHotel AV Scheduler';

    const weeks = opts.weekKeys;
    const t = pptx.addSlide();
    t.background = { color: NAVY };
    t.addShape(pptx.ShapeType.rect, { x: 0.6, y: 2.55, w: 0.12, h: 1.75, fill: { color: ORANGE }, line: { color: ORANGE, width: 0 } });
    t.addText('AV schedule', { x: 0.95, y: 2.4, w: 11, h: 1.0, fontFace: FONT, fontSize: 44, bold: true, color: 'FFFFFF' });
    t.addText(weeks.length === 1 ? U.fmtWeek(weeks[0]) : `${U.fmtWeek(weeks[0]).split(' – ')[0]} to ${U.fmtWeek(weeks[weeks.length - 1]).split(' – ').pop()}`, { x: 0.95, y: 3.4, w: 11, h: 0.6, fontFace: FONT, fontSize: 22, color: 'D8DEE9' });
    t.addText('Hotel Illinois Conference Center', { x: 0.95, y: 4.0, w: 11, h: 0.4, fontFace: FONT, fontSize: 14, color: ORANGE, bold: true });

    for (const wk of weeks) {
      const shifts = ((state.schedules[wk] || {}).shifts || []);
      if (shifts.length) scheduleSlides(pptx, state, wk, shifts);
      else {
        const s = baseSlide(pptx, 'Staff schedule', U.fmtWeek(wk));
        s.addText('No schedule saved for this week yet. Generate one in the Schedule tab and export again.', { x: 0.6, y: 2.5, w: 12, h: 1, fontFace: FONT, fontSize: 18, color: MUTED });
      }
      eventSlides(pptx, state, wk, shifts);
      equipmentSlide(pptx, state, wk);
    }
    if (opts.includeSigns) {
      const evs = state.events.filter((e) => weeks.some((wk) => U.weekDates(wk).includes(e.date))).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
      // Resolve each event's own design (or the shared one) up front, so every logo it needs is decoded
      // before any slide is drawn — signSlide/signImageSlide read images synchronously from the cache.
      const ov = (ev) => ev.signOverride;
      const sig = (ev) => (ov(ev) && ov(ev).themeKey) === 'inline' ? 'inline:' + JSON.stringify([ov(ev).inline.bar, ov(ev).inline.strip, ov(ev).inline.text, ov(ev).inline.logo && ov(ev).inline.logo.src]) : (ov(ev) && ov(ev).themeKey) || opts.signTheme;
      const resolved = evs.map((ev) => Object.assign(IH.Sign.forSpec(state, IH.Sign.specFor(state, ev), ov(ev), opts.signTheme), { sig: sig(ev) }));
      await IH.Sign.preload(resolved.map((r) => r.theme), opts);
      const seen = new Set();
      resolved.forEach((r) => {
        const k = r.spec.room + '|' + r.spec.name + '|' + r.sig;
        if (seen.has(k)) return; // one sign per room + event name + design, even if it runs several days
        seen.add(k);
        if (opts.signAsImage && typeof document !== 'undefined') signImageSlide(pptx, r.spec, r.theme, opts.signShowDate);
        else signSlide(pptx, r.spec, r.theme);
      });
    }
    return pptx;
  };

  P.export = async (state, opts) => {
    const pptx = await P.build(state, opts);
    const name = opts.weekKeys.length === 1 ? `AV-schedule_${opts.weekKeys[0]}.pptx` : `AV-schedule_${opts.weekKeys[0]}_to_${opts.weekKeys[opts.weekKeys.length - 1]}.pptx`;
    await pptx.writeFile({ fileName: name });
    return name;
  };
})(typeof window !== 'undefined' ? window : globalThis);
