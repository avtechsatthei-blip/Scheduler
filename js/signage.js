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
      logo: { h: 132, y: 62 }, rule: { y: 240, w: 132, h: 6, color: '#F15A32' }, titleCy: 566, titleMaxH: 600,
    },
  };

  Sign._logo = null;
  // Load fonts and the logo image before drawing. In Node pass { loadImage } (from the canvas package).
  Sign.ready = async (opts) => {
    if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
      try {
        await Promise.all([document.fonts.load('500 144px Montserrat'), document.fonts.load('600 144px Montserrat')]);
      } catch (e) { /* fall back to system font */ }
    }
    if (IH.LOGO && !Sign._logo) {
      try {
        if (opts && opts.loadImage) Sign._logo = await opts.loadImage(IH.LOGO.src);
        else if (typeof Image !== 'undefined') {
          Sign._logo = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = IH.LOGO.src; });
        }
      } catch (e) { Sign._logo = null; }
    }
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

  /** spec: { name, room, date?, start?, end? }   opts: { theme, showDate, createCanvas } */
  Sign.render = (spec, opts) => {
    opts = opts || {};
    const th = Sign.THEMES[opts.theme] || Sign.THEMES.classic;
    const canvas = opts.createCanvas ? opts.createCanvas(Sign.W, Sign.H) : Object.assign(document.createElement('canvas'), { width: Sign.W, height: Sign.H });
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, Sign.W, Sign.H);

    // --- optional Hotel Illinois lockup + accent rule across the top
    if (th.logo && Sign._logo) {
      const lw = (th.logo.h * IH.LOGO.w) / IH.LOGO.h;
      ctx.drawImage(Sign._logo, (Sign.W - lw) / 2, th.logo.y, lw, th.logo.h);
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

  Sign.toBlob = (canvas) => new Promise((res) => canvas.toBlob(res, 'image/png'));
  Sign.filename = (spec) => `${U.slug(spec.room)}__${U.slug(spec.name)}${spec.date ? '__' + spec.date : ''}.png`;

  Sign.specFor = (state, ev) => {
    const room = state.rooms.find((r) => r.id === ev.roomId);
    return { name: ev.name, room: room ? room.name : '', date: ev.date, start: ev.start, end: ev.end };
  };
})(typeof window !== 'undefined' ? window : globalThis);
