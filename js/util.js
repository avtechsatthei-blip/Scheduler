/* iHotel AV Scheduler — shared helpers (works in browser and Node for tests) */
(function (root) {
  const IH = (root.IH = root.IH || {});
  const U = (IH.U = {});

  U.uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  U.clone = (o) => JSON.parse(JSON.stringify(o));
  U.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  /* ---------- time (stored as "HH:MM", computed as minutes from midnight) ---------- */
  U.toMin = (t) => {
    if (typeof t === 'number') return t;
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
    return m ? +m[1] * 60 + +m[2] : null;
  };
  U.fromMin = (n) => {
    n = Math.max(0, Math.min(1440, Math.round(n)));
    return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  };
  // 570 -> "9:30a" (compact) or "9:30 AM"
  U.fmtTime = (t, long) => {
    const n = U.toMin(t);
    if (n == null) return '';
    let h = Math.floor(n / 60) % 24;
    const m = n % 60;
    const pm = h >= 12;
    h = h % 12 || 12;
    if (long) return `${h}:${String(m).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`;
    return `${h}${m ? ':' + String(m).padStart(2, '0') : ''}${pm ? 'p' : 'a'}`;
  };
  U.fmtRange = (s, e, long) => `${U.fmtTime(s, long)}–${U.fmtTime(e, long)}`;
  U.hrs = (min) => {
    const h = min / 60;
    return (Math.round(h * 10) / 10).toString().replace(/\.0$/, '') + 'h';
  };

  /* ---------- dates (ISO "YYYY-MM-DD", local-time safe) ---------- */
  U.parseDate = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  U.iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  U.addDays = (iso, n) => {
    const d = U.parseDate(iso);
    d.setDate(d.getDate() + n);
    return U.iso(d);
  };
  U.dow = (iso) => U.parseDate(iso).getDay(); // 0 = Sunday
  U.dayNum = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86400000);
  };
  U.today = () => U.iso(new Date());
  U.weekStart = (iso, startDay = 1) => {
    const diff = (U.dow(iso) - startDay + 7) % 7;
    return U.addDays(iso, -diff);
  };
  U.weekDates = (weekKey) => [0, 1, 2, 3, 4, 5, 6].map((i) => U.addDays(weekKey, i));
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  U.DOW = DOW;
  U.DOWL = DOWL;
  U.MONL = MONL;
  U.fmtDay = (iso) => {
    const d = U.parseDate(iso);
    return `${DOW[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
  };
  U.fmtLong = (iso) => {
    const d = U.parseDate(iso);
    return `${DOWL[d.getDay()]}, ${MONL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };
  U.fmtWeek = (weekKey) => {
    const a = U.parseDate(weekKey);
    const b = U.parseDate(U.addDays(weekKey, 6));
    const same = a.getMonth() === b.getMonth();
    return `${MON[a.getMonth()]} ${a.getDate()} – ${same ? '' : MON[b.getMonth()] + ' '}${b.getDate()}, ${b.getFullYear()}`;
  };
  U.monthIndex = (name) => MONL.findIndex((m) => m.toLowerCase().startsWith(String(name).toLowerCase().slice(0, 3)));

  /* ---------- misc ---------- */
  // "Projectors" -> "projector" so sheet wording and inventory names line up
  U.itemKey = (name) => {
    let k = String(name || '').toLowerCase().trim().replace(/\s+/g, ' ');
    if (k.length > 3 && k.endsWith('s') && !k.endsWith('ss')) k = k.slice(0, -1);
    return k;
  };
  U.tint = (hex, amt) => {
    const n = parseInt(hex.replace('#', ''), 16);
    const mix = (c) => Math.round(c + (255 - c) * amt);
    const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  U.slug = (s) => String(s || '').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
  U.fileToDataURL = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error || new Error('Could not read the file')); r.readAsDataURL(file); });
  U.loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read that image')); i.src = src; });
  U.download = (blobOrUrl, name) => {
    const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  U.mulberry = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  U.STAFF_COLORS = ['#F15A32', '#2F6DB5', '#2E8B6A', '#8B5CB8', '#C98A0B', '#D6457A', '#3A9BB0', '#6B7F3A', '#B3562E', '#5A6BD6'];
})(typeof window !== 'undefined' ? window : globalThis);
