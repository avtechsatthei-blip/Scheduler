/* iHotel AV Scheduler — room signage PNGs (1920×1080): event name in the middle, room name along the bottom. */
(function (root) {
  const IH = (root.IH = root.IH || {});
  const U = IH.U;
  const Sign = (IH.Sign = {});

  Sign.W = 1920;
  Sign.H = 1080;
  Sign.FONT = "Montserrat, 'Helvetica Neue', Arial, sans-serif";

  // Matches the sample sign: white page, dark-gray type with a soft shadow, gray room bar with a darker strip below.
  Sign.THEMES = {
    classic: {
      label: 'Classic gray',
      bg: '#FFFFFF', text: '#444444', shadow: 'rgba(0,0,0,0.30)',
      bar: '#C0C0C0', barLine: '#787878', roomText: '#444444', strip: '#868686', stripLine: '#4A4A4A',
    },
    brand: {
      label: 'iHotel blue and orange',
      bg: '#FFFFFF', text: '#10294B', shadow: null,
      bar: '#10294B', barLine: '#10294B', roomText: '#FFFFFF', strip: '#F15A32', stripLine: '#F15A32',
    },
    // Hotel Illinois lockup across the top (taken from the event-sheet header), Illini blue type, blue room bar, orange strip.
    uofi: {
      label: 'Hotel Illinois (U of I)',
      bg: '#FFFFFF', text: '#10294B', shadow: null, weight: 600, roomWeight: 600,
      bar: '#10294B', barLine: '#10294B', roomText: '#FFFFFF', strip: '#F15A32', stripLine: '#F15A32',
      logo: IH.LOGO ? { h: 132, y: 62, src: IH.LOGO.src } : null, rule: { y: 240, w: 132, h: 6, color: '#F15A32' }, titleCy: 566, titleMaxH: 600,
    },
  };

  // A theme's logo, keyed by its own src, so any number of custom logos (or per-sign one-off logos) can be
  // preloaded and drawn side by side. { src: HTMLImageElement | node canvas Image }
  Sign._logoCache = {};

  Sign.loadFonts = async () => {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
      try {
        await Promise.all([document.fonts.load('500 144px Montserrat'), document.fonts.load('600 144px Montserrat')]);
      } catch (e) { /* fall back to system font */ }
    }
  };
  // Decode and cache every logo image a theme (or list of themes) needs, before render() is called.
  // In Node pass { loadImage } (from the canvas package).
  Sign.preload = async (themes, opts) => {
    const list = (Array.isArray(themes) ? themes : [themes]).filter(Boolean);
    for (const th of list) {
      const src = th && th.logo && th.logo.src;
      if (!src || Sign._logoCache[src]) continue;
      try {
        if (opts && opts.loadImage) Sign._logoCache[src] = await opts.loadImage(src);
        else if (typeof Image !== 'undefined') {
          Sign._logoCache[src] = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
        }
      } catch (e) { Sign._logoCache[src] = null; }
    }
  };
  // Back-compat entry point: fonts plus the built-in U of I logo. New code should call preload() with the
  // exact themes it is about to use.
  Sign.ready = async (opts) => { await Sign.loadFonts(); await Sign.preload(Sign.THEMES.uofi, opts); };

  // Resolve a theme reference to a real theme object. `key` is a built-in key ('classic'…), 'custom:<id>'
  // (looked up in state.signThemes), or 'inline' (uses `inline` directly, a one-off theme that isn't saved).
  Sign.resolveTheme = (state, key, inline) => {
    if (key === 'inline' && inline) return inline;
    if (typeof key === 'string' && key.indexOf('custom:') === 0) {
      const id = key.slice(7);
      const t = ((state && state.signThemes) || []).find((x) => x.id === id);
      if (t) return t;
    }
    return Sign.THEMES[key] || Sign.THEMES.classic;
  };
  // Built-ins plus the saved library, as one list for dropdowns: [{key, label, theme, custom}].
  Sign.allThemes = (state) => Object.entries(Sign.THEMES).map(([key, theme]) => ({ key, label: theme.label, theme, custom: false }))
    .concat(((state && state.signThemes) || []).map((theme) => ({ key: `custom:${theme.id}`, label: theme.name, theme, custom: true })));

  // Perceived brightness (0 dark – 1 light), for choosing readable text/room-name color against a fill.
  Sign.luminance = (hex) => {
    const n = parseInt(String(hex || '').replace('#', ''), 16);
    if (isNaN(n)) return 1;
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  Sign.contrastOn = (hex) => (Sign.luminance(hex) > 0.6 ? '#1B2433' : '#FFFFFF');

  // Sample the dominant colors in a logo image, ignoring near-white/near-black background. Returns up to
  // `opts.count` swatches as { hex, sat, light }, most prominent and most colorful first.
  Sign.extractPalette = (img, opts) => {
    opts = opts || {};
    const count = opts.count || 6;
    const size = 60;
    const canvas = opts.createCanvas ? opts.createCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size });
    const ctx = canvas.getContext('2d');
    const imgW = img.naturalWidth || img.width, imgH = img.naturalHeight || img.height;
    if (!imgW || !imgH) return [];
    const scale = Math.min(size / imgW, size / imgH);
    const dw = Math.max(1, Math.round(imgW * scale)), dh = Math.max(1, Math.round(imgH * scale));
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, imgW, imgH, (size - dw) / 2, (size - dh) / 2, dw, dh);
    const { data } = ctx.getImageData(0, 0, size, size);
    const buckets = new Map(); // quantized rgb -> running totals
    const step = 24;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], bch = data[i + 2], a = data[i + 3];
      if (a < 128) continue; // transparent: not part of the mark
      const max = Math.max(r, g, bch), min = Math.min(r, g, bch);
      const light = (max + min) / 2 / 255;
      if (light > 0.94 || light < 0.06) continue; // near-white or near-black background
      const sat = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
      const key = [Math.round(r / step), Math.round(g / step), Math.round(bch / step)].join(',');
      const b = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0, sat: 0 };
      b.count++; b.r += r; b.g += g; b.b += bch; b.sat += sat;
      buckets.set(key, b);
    }
    let list = [...buckets.values()].map((b) => ({ r: Math.round(b.r / b.count), g: Math.round(b.g / b.count), b: Math.round(b.b / b.count), count: b.count, sat: b.sat / b.count }));
    list.sort((a, b) => b.count * (0.35 + b.sat) - a.count * (0.35 + a.sat));
    const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    const out = [];
    for (const c of list) {
      if (out.some((o) => Math.abs(o.r - c.r) + Math.abs(o.g - c.g) + Math.abs(o.b - c.b) < 66)) continue;
      out.push(Object.assign({ hex: hex(c), light: (Math.max(c.r, c.g, c.b) + Math.min(c.r, c.g, c.b)) / 510 }, c));
      if (out.length >= count) break;
    }
    return out;
  };

  // Turn extracted swatches into a starting theme: the most prominent color becomes the room bar (with a
  // readable bar text color), the next distinct one becomes the strip, and title text uses the darkest
  // swatch (falling back to navy so pale logos still read well on white).
  Sign.paletteToTheme = (swatches) => {
    const bar = (swatches[0] && swatches[0].hex) || '#10294B';
    const strip = (swatches.find((s) => s.hex !== bar) || swatches[0] || { hex: '#F15A32' }).hex;
    const darkest = swatches.slice().sort((a, b) => a.light - b.light)[0];
    const text = darkest && darkest.light < 0.55 ? darkest.hex : (Sign.luminance(bar) < 0.55 ? bar : '#1B2433');
    return { bar, barLine: bar, strip, stripLine: strip, text, roomText: Sign.contrastOn(bar) };
  };

  // Break text into `n` lines with the narrowest widest-line (keeps titles from ending in one stranded word).
  function balance(words, widths, n) {
    const N = words.length;
    const pre = [0];
    words.forEach((w, i) => pre.push(pre[i] + widths[i]));
    const space = widths.space;
    const lineW = (a, b) => pre[b] - pre[a] + space * (b - a - 1);
    const best = Array.from({ length: n + 1 }, () => Array(N + 1).fill(Infinity));
    const cut = Array.from({ length: n + 1 }, () => Array(N + 1).fill(0));
    best[0][0] = 0;
    for (let k = 1; k <= n; k++) {
      for (let i = k; i <= N; i++) {
        for (let j = k - 1; j < i; j++) {
          const v = Math.max(best[k - 1][j], lineW(j, i));
          if (v < best[k][i]) { best[k][i] = v; cut[k][i] = j; }
        }
      }
    }
    const lines = [];
    let i = N;
    for (let k = n; k >= 1; k--) {
      const j = cut[k][i];
      lines.unshift(words.slice(j, i).join(' '));
      i = j;
    }
    return lines;
  }

  function fitTitle(ctx, text, maxW, maxLines, weight, maxH) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return { size: 144, lines: [''] };
    const found = [];
    for (let size = 144; size >= 48; size -= 4) {
      ctx.font = `${weight || 500} ${size}px ${Sign.FONT}`;
      const widths = words.map((w) => ctx.measureText(w).width);
      widths.space = ctx.measureText(' ').width;
      // how many lines does a greedy fill need?
      let n = 1, cur = 0;
      for (let i = 0; i < words.length; i++) {
        const add = (cur ? widths.space : 0) + widths[i];
        if (cur + add > maxW && cur > 0) { n++; cur = widths[i]; } else cur += add;
      }
      if (widths.some((w) => w > maxW) || n > maxLines || (maxH && n * size * 1.2 > maxH)) continue;
      const lines = n === 1 ? [words.join(' ')] : balance(words, widths, n);
      if (lines.every((l) => ctx.measureText(l).width <= maxW)) found.push({ size, lines });
    }
    if (!found.length) return { size: 48, lines: [words.join(' ')] };
    // Largest type wins, but give up to a quarter of the size to keep the name on fewer lines.
    const top = found[0].size;
    const ok = found.filter((f) => f.size >= top * 0.75);
    ok.sort((a, b) => a.lines.length - b.lines.length || b.size - a.size);
    return ok[0];
  }

  /** spec: { name, room, date?, start?, end? }   opts: { theme (string key or a theme object), showDate, createCanvas } */
  Sign.render = (spec, opts) => {
    opts = opts || {};
    const th = typeof opts.theme === 'string' ? (Sign.THEMES[opts.theme] || Sign.THEMES.classic) : opts.theme || Sign.THEMES.classic;
    const canvas = opts.createCanvas ? opts.createCanvas(Sign.W, Sign.H) : Object.assign(document.createElement('canvas'), { width: Sign.W, height: Sign.H });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, Sign.W, Sign.H);

    // --- optional logo + accent rule across the top
    const logoImg = th.logo && Sign._logoCache[th.logo.src];
    if (th.logo && logoImg) {
      const natW = logoImg.naturalWidth || logoImg.width, natH = logoImg.naturalHeight || logoImg.height;
      const lw = (th.logo.h * natW) / natH;
      ctx.drawImage(logoImg, (Sign.W - lw) / 2, th.logo.y, lw, th.logo.h);
    }
    if (th.rule) {
      ctx.fillStyle = th.rule.color;
      ctx.fillRect((Sign.W - th.rule.w) / 2, th.rule.y, th.rule.w, th.rule.h);
    }

    // --- event name, centered in the space above the bar
    const weight = th.weight || 500;
    const { size, lines } = fitTitle(ctx, spec.name, 1800, 3, weight, th.titleMaxH);
    const pitch = size * 1.2;
    const cy = th.titleCy || 488; // classic: matches the sample sign's optical center
    const top = cy - (lines.length * pitch) / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `${weight} ${size}px ${Sign.FONT}`;
    ctx.fillStyle = th.text;
    if (th.shadow) { ctx.shadowColor = th.shadow; ctx.shadowBlur = 6; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4; }
    lines.forEach((l, i) => ctx.fillText(l, Sign.W / 2, top + i * pitch + pitch / 2 + size * 0.35));
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = 0;

    if (opts.showDate && spec.date) {
      const sub = `${U.fmtLong(spec.date)}${spec.start ? '   ' + U.fmtRange(spec.start, spec.end, true) : ''}`;
      ctx.font = `${weight} 46px ${Sign.FONT}`;
      ctx.fillStyle = th.text;
      ctx.globalAlpha = 0.7;
      ctx.fillText(sub, Sign.W / 2, Math.min(850, top + lines.length * pitch + 52));
      ctx.globalAlpha = 1;
    }

    // --- room bar
    ctx.fillStyle = th.bar;
    ctx.fillRect(0, 886, Sign.W, 154);
    ctx.strokeStyle = th.barLine;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 887, Sign.W - 2, 152);
    ctx.fillStyle = th.strip;
    ctx.fillRect(0, 1040, Sign.W, 40);
    ctx.strokeStyle = th.stripLine;
    ctx.strokeRect(1, 1041, Sign.W - 2, 38);

    let rs = 132;
    ctx.textAlign = 'left';
    ctx.fillStyle = th.roomText;
    for (; rs > 48; rs -= 4) {
      ctx.font = `${th.roomWeight || 500} ${rs}px ${Sign.FONT}`;
      if (ctx.measureText(spec.room || '').width <= Sign.W - 40) break;
    }
    if (th.shadow) { ctx.shadowColor = th.shadow; ctx.shadowBlur = 6; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4; }
    ctx.fillText(spec.room || '', 12, 1004 - (132 - rs) * 0.1);
    ctx.shadowColor = 'transparent';
    return canvas;
  };

  // A per-sign override: { title?, room?, themeKey?, inline? }. Any of these can be set independently —
  // e.g. a renamed sign that still uses the shared theme, or a custom look with the event's own name.
  Sign.hasOverride = (ov) => !!ov && !!(ov.title || ov.room || ov.themeKey);
  // Apply one event/sign's override on top of its default spec + the shared theme, ready to render.
  Sign.forSpec = (state, spec, override, fallbackThemeKey) => {
    const out = override && override.title ? Object.assign({}, spec, { name: override.title }) : spec;
    const out2 = override && override.room ? Object.assign({}, out, { room: override.room }) : out;
    const themeKey = (override && override.themeKey) || fallbackThemeKey;
    return { spec: out2, theme: Sign.resolveTheme(state, themeKey, override && override.inline) };
  };

  Sign.toBlob = (canvas) => new Promise((res) => canvas.toBlob(res, 'image/png'));
  Sign.filename = (spec) => `${U.slug(spec.room)}__${U.slug(spec.name)}${spec.date ? '__' + spec.date : ''}.png`;

  Sign.specFor = (state, ev) => {
    const room = state.rooms.find((r) => r.id === ev.roomId);
    return { name: ev.name, room: room ? room.name : '', date: ev.date, start: ev.start, end: ev.end };
  };
})(typeof window !== 'undefined' ? window : globalThis);
