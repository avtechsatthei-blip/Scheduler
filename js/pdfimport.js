/* iHotel AV Scheduler — turn an event-sheet PDF into draft events.
 *
 * The parser (`Imp.parse`) is pure so it can be tested in Node. It works from two sources per page:
 *   lines — the PDF's real text (footer, "Notes" pages)
 *   ocr   — text read from the rendered floor-plan page (title block, agenda, tech count),
 *           needed because those pages are vector drawings with no text layer.
 */
(function (root) {
  const IH = (root.IH = root.IH || {});
  const U = IH.U;
  const Imp = (IH.Imp = {});

  const CDN = {
    pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfjsWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
    jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  };

  // Does a folder name look like an old/superseded set of plans that should be skipped?
  // Matches "old plans", "Old_Plans_v2", "archive", "superseded", etc. — a whole word, not a
  // substring (so "Goldstein Room" is untouched even though it contains "old").
  const SKIP_WORDS = ['old', 'outdated', 'obsolete', 'deprecated', 'superseded', 'archive', 'archived'];
  Imp.looksArchived = (name) => {
    const n = ' ' + String(name || '').toLowerCase().replace(/[_\-.]+/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    return SKIP_WORDS.some((w) => n.includes(' ' + w + ' ') || n.includes(' ' + w + 's '));
  };

  // Walk a .zip (any folder depth) and pull out every PDF, skipping whole branches whose folder
  // name looks like an old/archived set of plans (see looksArchived). Returns File objects (so
  // they drop straight into readPdf/the existing import flow) plus the folder names that were
  // skipped, for a one-line "here's what I left out" summary.
  Imp.extractZipPdfs = async (zipFile) => {
    await Imp.loadScript(CDN.jszip);
    const zip = await window.JSZip.loadAsync(await zipFile.arrayBuffer());
    const skippedFolders = new Set();
    const entries = [];
    zip.forEach((relPath, entry) => {
      if (entry.dir) return;
      if (!/\.pdf$/i.test(entry.name)) return;
      const parts = relPath.split('/').filter(Boolean);
      const badFolder = parts.slice(0, -1).find((seg) => Imp.looksArchived(seg));
      if (badFolder) { skippedFolders.add(badFolder); return; }
      entries.push(entry);
    });
    const files = [];
    for (const entry of entries) {
      const blob = await entry.async('blob');
      files.push(new File([blob], entry.name.split('/').pop(), { type: 'application/pdf' }));
    }
    return { files, skippedFolders: [...skippedFolders] };
  };

  /* =====================================================================
   * Parsing (pure)
   * ===================================================================== */
  Imp.groupLines = (items, pageH) => {
    const rows = items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ x: i.transform[4], y: pageH - i.transform[5], str: i.str.replace(/\s+/g, ' ').trim() }))
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const lines = [];
    for (const r of rows) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - r.y) < 3) last.parts.push(r);
      else lines.push({ y: r.y, parts: [r] });
    }
    return lines.map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(' '));
  };

  const FOOT_RE = /^(?:(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s+)?(.+?)\s+for\s+(.+?)\s+-\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/;
  const DATE_RE = /(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,?\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/i;
  const TIME_RE = /^\W{0,2}(\d{1,2}):(\d{2})\s*([ap])\.?m?\b\s*[-–—:]?\s*(.*)$/i;

  const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const cleanOcr = (l) => l.replace(/[|\[\]_{}]+/g, ' ').replace(/^[^A-Za-z0-9@$]+/, '').replace(/\s+/g, ' ').trim();
  const roomKey = (n) => String(n || '').toLowerCase().replace(/\b(ballroom|room|hall)\b/g, '').replace(/[^a-z]+/g, ' ').trim();
  const titleCase = (s) => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));

  // The footer is the last line or two of every page: "9.18.26 Alma Mater Room for <Event> - <Month D, YYYY> at <time>"
  function findFooter(lines) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = FOOT_RE.exec(lines.slice(i).join(' '));
      if (m) {
        let date;
        if (m[1]) date = iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
        else date = iso(+m[8], U.monthIndex(m[6]) + 1, +m[7]);
        return { at: i, roomRaw: m[4].replace(/\s+Room$/i, '').trim(), formal: m[5].trim(), date, hasPrefix: !!m[1] };
      }
    }
    return null;
  }

  const ITEM_PATTERNS = [
    [/projector/i, 'Projector'],
    [/screen/i, 'Screen'],
    [/podium|lectern/i, 'Podium'],
    [/wired\s*mic|^mic\b|microphone/i, 'Wired Mic'],
    [/wireless\s*mic|handheld/i, 'Wireless Mic'],
    [/cc\s*laptop|laptop/i, 'CC Laptop'],
    [/^hdmi/i, 'HDMI'],
    [/riser/i, 'Riser'],
    [/^\d*\s*steps?\b/i, 'Step'],
    [/360\s*camera/i, '360 Camera'],
    [/speaker|pa system/i, 'Speaker'],
  ];

  function parseNotes(lines) {
    const res = { setup: '', attendees: null, items: [], tech: { count: 0, minHrs: null, rate: null }, noAV: false, shortName: null, notes: [] };
    let inAV = false;
    const addItem = (name, qty) => {
      const k = U.itemKey(name);
      const ex = res.items.find((i) => U.itemKey(i.name) === k);
      if (ex) { if (qty && !ex.qty) ex.qty = qty; } else res.items.push({ name, qty: qty || undefined, builtIn: false });
    };
    for (let idx = 0; idx < lines.length; idx++) {
      const l = lines[idx].replace(/St\s*yle/i, 'Style').trim();
      if (!l || /^notes$/i.test(l)) continue;
      let m;
      if ((m = /^(?:Digital)?\s*\/?\s*WF\s*:\s*(.*)$/i.exec(l)) || (m = /^Digital\s*:\s*(.*)$/i.exec(l))) {
        const name = (m[1] || '').replace(/\s+-\s+.*$/, '').replace(/\s+20\d\d$/, '').trim();
        if (name && !res.shortName) res.shortName = name;
        inAV = false;
        continue;
      }
      if (/^digital\s*\/?\s*(wf)?\s*:?$/i.test(l)) { inAV = false; continue; }
      if (/\bno\s+av\b/i.test(l)) { res.noAV = true; continue; }
      if (/^av needs/i.test(l)) { inAV = true; continue; }
      if ((m = /^(\d+)\s*rounds?\s*of\s*(\d+)\s*for\s*(\d+)/i.exec(l))) { res.setup = `${m[1]} rounds of ${m[2]}`; res.attendees = +m[3]; continue; }
      if ((m = /^(\d+)\s*classrooms?\s*(\d+)\s*\/?\s*per\s*for\s*(\d+)/i.exec(l))) { res.setup = `${m[1]} classrooms, ${m[2]} per`; res.attendees = +m[3]; continue; }
      if ((m = /boardroom\s+style\s+for\s+(\d+)/i.exec(l))) { res.setup = `Boardroom for ${m[1]}`; res.attendees = +m[1]; continue; }
      if (/^in\s*room\b/i.test(l)) {
        res.tech.count = Math.max(res.tech.count, 1);
        const hr = /(\d+)\s*hr/i.exec(l), rate = /\$\s*(\d+)/.exec(l);
        if (hr) res.tech.minHrs = +hr[1];
        if (rate) res.tech.rate = +rate[1];
        const inline = /\bx\s*(\d+)\b/i.exec(l);
        if (inline) res.tech.count = +inline[1];
        const next = (lines[idx + 1] || '').trim();
        const nx = /^x\s*(\d+)$/i.exec(next);
        if (nx) { res.tech.count = +nx[1]; idx++; }
        continue;
      }
      if (/^x\s*\d+$/i.test(l)) continue;
      if ((m = /^(\d+)?\s*(.*)$/.exec(l))) {
        const hit = ITEM_PATTERNS.find(([re]) => re.test(l));
        if (hit && (inAV || /riser|step|podium|360/i.test(l))) {
          addItem(hit[1], m[1] && hit[1] !== '360 Camera' ? +m[1] : undefined);
          if (/\$\s*\d+/.test(l)) res.notes.push(l);
          continue;
        }
        if (inAV && l.length < 40 && !/^\W*$/.test(l)) addItem(titleCase(l.replace(/^-+\s*/, '')));
      }
    }
    return res;
  }

  const PERSON_RE = /^[A-Z][a-z'’.-]+(?: [A-Z]\.?)?(?: [A-Z][a-z'’.-]+){1,2}$/;
  // The OCR'd title block is only a hint: the drawing behind it makes line order unreliable.
  function parseTitle(ocr) {
    const clean = ocr.map(cleanOcr).filter(Boolean);
    const i = clean.findIndex((l) => DATE_RE.test(l));
    if (i < 0) return {};
    const m = DATE_RE.exec(clean[i]);
    const out = { date: iso(+m[3], U.monthIndex(m[1]) + 1, +m[2]) };
    if (i >= 1 && PERSON_RE.test(clean[i - 1])) out.contact = clean[i - 1];
    if (i >= 3) { out.room = clean[i - 3]; out.name = clean[i - 2]; }
    return out;
  }

  function parseAgenda(ocr) {
    const out = [];
    for (const raw of ocr) {
      const l = raw.replace(/[|\[\]]+/g, ' ').trim();
      const m = TIME_RE.exec(l);
      if (!m) continue;
      let h = +m[1] % 12;
      if (/p/i.test(m[3])) h += 12;
      let label = m[4].replace(/\s+/g, ' ').trim();
      // drop trailing OCR debris left over from the floor plan drawing ("Contact Arrive cd C")
      const words = label.split(' ');
      while (words.length > 1 && words[words.length - 1].replace(/\W/g, '').length <= 2) words.pop();
      label = words.join(' ').replace(/[^A-Za-z0-9&\/ ]+$/, '');
      out.push({ min: h * 60 + +m[2], label });
    }
    return out;
  }

  function agendaRef(ocr) {
    const i = ocr.findIndex((l) => /agenda\s*dl/i.test(l));
    if (i < 0) return null;
    for (let j = i; j <= i + 2 && j < ocr.length; j++) {
      const m = /\bsee\s+([A-Za-z][A-Za-z ]+?)(?:\s{2,}|\s[^A-Za-z ]|$)/i.exec(cleanOcr(ocr[j]));
      if (m) return m[1].trim();
    }
    return null;
  }

  // Which agenda entries mean "the event starts" and "the event ends"?
  Imp.pickWindow = (agenda) => {
    if (!agenda || !agenda.length) return null;
    const find = (re, fromEnd) => {
      const list = fromEnd ? agenda.slice().reverse() : agenda;
      return list.find((a) => re.test(a.label));
    };
    const start = find(/session\s*star|\bstarts?\b|\bbegin|program/i) || find(/guest|doors|arriv/i) || agenda[0];
    const end = find(/session\s*end|\bends?\b|adjourn|conclu/i, true) || find(/room\s*clear|clear|strike/i, true) || agenda[agenda.length - 1];
    if (!start || !end || end.min <= start.min) return null;
    return { start: start.min, end: end.min };
  };

  /**
   * pages: [{ n, lines: [text lines], ocr: [text lines] | null }]
   * returns { drafts: [...], warnings: [...] }
   */
  Imp.parse = (pages, opts) => {
    opts = opts || {};
    const warnings = [];
    const groups = new Map();

    for (const pg of pages) {
      const foot = findFooter(pg.lines || []);
      if (!foot) { if ((pg.lines || []).length || (pg.ocr || []).length) warnings.push(`Page ${pg.n}: couldn't find the room/date footer, skipped.`); continue; }
      if (/^all event space$/i.test(foot.roomRaw)) continue;
      const title = pg.ocr ? parseTitle(pg.ocr) : {};
      const key = `${foot.date}|${roomKey(foot.roomRaw)}`;
      const g = groups.get(key) || { key, date: foot.date, hasPrefix: foot.hasPrefix, roomFooter: foot.roomRaw, formal: foot.formal, pages: [], notesLines: [], ocr: [], title: {} };
      g.pages.push(pg.n);
      const body = pg.lines.slice(0, foot.at);
      if (body.some((l) => /^notes$/i.test(l))) g.notesLines = g.notesLines.concat(body);
      if (pg.ocr) {
        g.ocr = g.ocr.concat(pg.ocr);
        g.title = Object.assign(g.title, title);
      }
      groups.set(key, g);
    }

    const sheets = [...groups.values()].map((g) => {
      const notes = parseNotes(g.notesLines);
      const agenda = parseAgenda(g.ocr);
      const ref = agendaRef(g.ocr);
      const ocrText = g.ocr.map(cleanOcr).join('\n');
      let techOcr = null;
      const tm = /an hour[.,\s]*[xX]\s*(\d+)/i.exec(ocrText);
      if (tm) techOcr = +tm[1];
      return { g, notes, agenda, ref, techOcr, reset: g.ocr.some((l) => /\breset\b/i.test(l)) };
    });

    // Rooms that say "Agenda DL — See Chancellor" borrow that room's times.
    const withAgenda = (date, hint) => {
      const same = sheets.filter((s) => s.g.date === date && s.agenda.length >= 3);
      if (hint) { const h = same.find((s) => roomKey(s.g.title.room || s.g.roomFooter).includes(roomKey(hint).split(' ')[0])); if (h) return h; }
      return same.sort((a, b) => b.agenda.length - a.agenda.length)[0] || sheets.filter((s) => s.agenda.length >= 3).sort((a, b) => b.agenda.length - a.agenda.length)[0] || null;
    };

    // The same event usually spans every page; agree on one name (the "Digital/WF:" line is real text, so it's reliable).
    const vote = (list) => {
      const v = {};
      list.filter(Boolean).forEach((n) => (v[n] = (v[n] || 0) + 1));
      return Object.entries(v).sort((a, b) => b[1] - a[1]).map((x) => x[0])[0];
    };
    const packetName = vote(sheets.map((s) => s.notes.shortName));
    const packetContact = vote(sheets.map((s) => s.g.title.contact));
    const roomOk = (g) => {
      const t = roomKey(g.title.room || '');
      const f = roomKey(g.roomFooter);
      return t && f && (t.includes(f.split(' ')[0]) || f.includes(t.split(' ')[0])) && t.length < 40;
    };

    const drafts = sheets.map((s) => {
      const { g, notes } = s;
      const flags = [];
      let win = Imp.pickWindow(s.agenda), timeSource = 'floor plan';
      let agendaSheet = s;
      if (!win) {
        agendaSheet = withAgenda(g.date, s.ref);
        win = agendaSheet && Imp.pickWindow(agendaSheet.agenda);
        timeSource = agendaSheet ? 'agenda from ' + (agendaSheet.g.title.room || agendaSheet.g.roomFooter) : '';
      }
      const st = opts.defaultStart || '08:00', en = opts.defaultEnd || '17:00';
      if (!win) flags.push('No agenda times found, so default hours were used. Check start/end.');
      const tech = { count: notes.tech.count, start: '', end: '' };
      if (s.techOcr && s.techOcr > tech.count) { tech.count = s.techOcr; flags.push(`In-room tech count (${s.techOcr}) read from the floor plan.`); }
      const noteBits = [];
      if (agendaSheet && agendaSheet.agenda.length) noteBits.push('Agenda: ' + agendaSheet.agenda.map((a) => `${U.fmtTime(U.fromMin(a.min))} ${a.label}`).join('; '));
      notes.notes.forEach((n) => noteBits.push(n));
      if (s.reset) noteBits.push('Marked "Reset" on the floor plan.');
      const av = !notes.noAV && (notes.items.length > 0 || tech.count > 0);
      let date = g.date;
      if (!g.hasPrefix && g.title.date && g.title.date !== g.date) { date = g.title.date; flags.push(`Date taken from the floor plan (${g.title.date}); the page footer said ${g.date}.`); }
      const roomName = roomOk(g) ? g.title.room.trim() : titleCase(g.roomFooter);
      return {
        key: g.key,
        pages: g.pages,
        name: notes.shortName || packetName || g.formal,
        roomName,
        date,
        start: win ? U.fromMin(win.start) : st,
        end: win ? U.fromMin(win.end) : en,
        timeSource: win ? timeSource : 'default',
        items: av ? notes.items : [],
        tech,
        noAV: !av,
        attendees: notes.attendees,
        contact: g.title.contact || packetContact || '',
        setup: notes.setup,
        notes: noteBits.join('\n'),
        techMinHrs: notes.tech.minHrs,
        flags,
      };
    });
    drafts.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.roomName.localeCompare(b.roomName));
    return { drafts, warnings };
  };

  /* =====================================================================
   * Browser side: read the PDF (text layer + OCR for drawn pages)
   * ===================================================================== */
  const loading = {};
  Imp.loadScript = (url) => {
    if (!loading[url]) {
      loading[url] = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = url;
        s.onload = res;
        s.onerror = () => rej(new Error('Could not load ' + url + '. Check your internet connection.'));
        document.head.appendChild(s);
      });
    }
    return loading[url];
  };

  async function ensurePdfjs() {
    if (!window.pdfjsLib) await Imp.loadScript(CDN.pdfjs);
    if (!Imp._worker) {
      try {
        const txt = await (await fetch(CDN.pdfjsWorker)).text();
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([txt], { type: 'text/javascript' }));
      } catch (e) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfjsWorker;
      }
      Imp._worker = true;
    }
  }

  Imp.readPdf = async (file, opts) => {
    opts = opts || {};
    const progress = opts.onProgress || (() => {});
    await ensurePdfjs();
    progress('Opening PDF…', 0);
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await window.pdfjsLib.getDocument({ data }).promise;
    const pages = [];
    let ocrWorker = null;
    try {
      for (let n = 1; n <= doc.numPages; n++) {
        progress(`Reading page ${n} of ${doc.numPages}…`, (n - 1) / doc.numPages);
        const page = await doc.getPage(n);
        const vp1 = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        const lines = Imp.groupLines(tc.items, vp1.height);
        const isNotes = lines.some((l) => /^notes$/i.test(l));
        const foot = findFooter(lines);
        let ocr = null;
        const skip = foot && /^all event space$/i.test(foot.roomRaw);
        if (!isNotes && !skip && opts.ocr) {
          if (!ocrWorker) {
            progress('Loading text recognition (first time only)…', (n - 1) / doc.numPages);
            await Imp.loadScript(CDN.tesseract);
            ocrWorker = await window.Tesseract.createWorker('eng');
          }
          progress(`Reading floor plan on page ${n} of ${doc.numPages}…`, (n - 0.5) / doc.numPages);
          const vp = page.getViewport({ scale: 3 });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width;
          canvas.height = vp.height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          const r = await ocrWorker.recognize(canvas);
          ocr = r.data.text.split('\n').map((l) => l.trim()).filter(Boolean);
        }
        pages.push({ n, lines, ocr });
      }
    } finally {
      if (ocrWorker) await ocrWorker.terminate();
    }
    progress('Building events…', 1);
    return pages;
  };

  // Resolve rooms and default quantities against the app's data.
  Imp.finalize = (drafts, state, findRoom) => {
    return drafts.map((d) => {
      const room = findRoom(d.roomName);
      const items = d.items.map((it) => {
        const def = room && room.items.find((x) => U.itemKey(x.name) === U.itemKey(it.name));
        return { name: def ? def.name : it.name, qty: it.qty || (def ? def.qty : 1), builtIn: def ? !!def.builtIn : false };
      });
      const dupe = state.events.some((e) => e.date === d.date && room && e.roomId === room.id && String(e.name).toLowerCase() === String(d.name).toLowerCase());
      return Object.assign({}, d, { roomId: room ? room.id : null, newRoom: !room, items, dupe, include: !dupe });
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
