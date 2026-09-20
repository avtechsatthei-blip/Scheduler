/* iHotel AV Scheduler — UI core: router, modal, toast, icons, shared bits used by every view */
(function (root) {
  const IH = (root.IH = root.IH || {});
  const U = IH.U;
  const UI = (IH.UI = { view: 'week', weekKey: null, Views: {}, Acts: {}, Changes: {}, mem: {} });
  const esc = U.esc;
  UI.esc = esc;
  UI.$ = (s, r) => (r || document).querySelector(s);
  UI.$$ = (s, r) => [...(r || document).querySelectorAll(s)];

  /* ---------- icons ---------- */
  const IC = {
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/>',
    door: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    left: '<path d="M15 18l-6-6 6-6"/>',
    right: '<path d="M9 18l6-6-6-6"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    wand: '<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M15 9h.01M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    deck: '<path d="M2 3h20M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3M12 16v4M8 21l4-4 4 4"/>',
    print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    dollar: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  };
  UI.icon = (name, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[name] || ''}</svg>`;
  const ic = UI.icon;

  /* ---------- small shared helpers ---------- */
  const ROOM_COLORS = ['#2F6DB5', '#C2571A', '#2E8B6A', '#8B5CB8', '#B8860B', '#C2417A', '#2A8A9E', '#6B7F3A', '#A64B2A', '#4B58C9'];
  UI.roomColor = (roomId) => {
    const i = Math.max(0, IH.Store.state.rooms.findIndex((r) => r.id === roomId));
    return ROOM_COLORS[i % ROOM_COLORS.length];
  };
  UI.roomName = (id) => ((IH.Store.room(id) || {}).name) || 'No room';
  UI.initials = (name) => String(name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  UI.staffMini = (s) => `<span class="mini-av" style="background:${s.color}" title="${esc(s.name)}">${esc(UI.initials(s.name))}</span>`;
  UI.itemsText = (ev) => (ev.noAV ? 'No AV' : (ev.items || []).map((i) => `${i.qty > 1 ? i.qty + '× ' : ''}${i.name}`).join(', ') || '—');
  UI.plural = (n, w, pl) => `${n} ${n === 1 ? w : pl || w + 's'}`;
  UI.money = (n) => '$' + Math.round(n).toLocaleString('en-US');
  UI.field = (label, input, hint, cls) => `<label class="f ${cls || ''}">${label}${input}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  UI.opt = (value, text, sel) => `<option value="${esc(value)}"${sel ? ' selected' : ''}>${esc(text)}</option>`;
  UI.formVals = (el) => {
    const o = {};
    UI.$$('[name]', el).forEach((f) => {
      if (f.type === 'checkbox') o[f.name] = f.checked;
      else if (f.type === 'radio') { if (f.checked) o[f.name] = f.value; }
      else o[f.name] = f.value;
    });
    return o;
  };

  /* ---------- week handling ---------- */
  UI.thisWeek = () => IH.Store.weekKeyFor(U.today());
  UI.setWeek = (k) => {
    UI.weekKey = IH.Store.weekKeyFor(k);
    try { sessionStorage.setItem('ih-week', UI.weekKey); } catch (e) { /* ignore */ }
    UI.render();
  };
  UI.defaultWeek = () => {
    const S = IH.Store;
    let saved = null;
    try { saved = sessionStorage.getItem('ih-week'); } catch (e) { /* ignore */ }
    if (saved) return S.weekKeyFor(saved);
    const keys = S.allWeekKeys();
    const now = UI.thisWeek();
    if (!keys.length || keys.includes(now)) return now;
    return keys.find((k) => k > now) || keys[keys.length - 1];
  };
  UI.weekNav = () => `<div class="weeknav noprint">
      <button class="btn ghost icon sm" data-act="week-prev" title="Previous week">${ic('left')}</button>
      <div class="label" title="Pick a week">${esc(U.fmtWeek(UI.weekKey))}<input type="date" data-change="week-pick" value="${UI.weekKey}" aria-label="Jump to a date"></div>
      <button class="btn ghost icon sm" data-act="week-next" title="Next week">${ic('right')}</button>
    </div>${UI.weekKey !== UI.thisWeek() ? `<button class="btn sm ghost noprint" data-act="week-today">This week</button>` : ''}`;
  UI.Acts['week-prev'] = () => UI.setWeek(U.addDays(UI.weekKey, -7));
  UI.Acts['week-next'] = () => UI.setWeek(U.addDays(UI.weekKey, 7));
  UI.Acts['week-today'] = () => UI.setWeek(U.today());
  UI.Changes['week-pick'] = (el) => el.value && UI.setWeek(el.value);

  /* ---------- toast ---------- */
  UI.toast = (msg, kind) => {
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = (kind === 'bad' ? ic('alert') : kind === 'ok' ? ic('check') : '') + `<span>${esc(msg)}</span>`;
    UI.$('#toasts').appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, kind === 'bad' ? 5200 : 2800);
  };

  /* ---------- modal ---------- */
  const stack = [];
  UI.modal = (o) => {
    const veil = document.createElement('div');
    veil.className = 'veil';
    veil.innerHTML = `<div class="dlg ${o.wide ? 'wide' : ''} ${o.narrow ? 'narrow' : ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title || '')}">
        <div class="dh"><h2>${esc(o.title || '')}</h2><button class="btn ghost icon sm right" data-close aria-label="Close">${ic('x')}</button></div>
        <div class="db">${o.body || ''}</div>
        ${o.actions !== false ? `<div class="df">${o.left ? `<div class="l">${o.left}</div>` : ''}<span class="grow"></span></div>` : ''}
      </div>`;
    UI.$('#modal-root').appendChild(veil);
    const m = { el: veil, body: UI.$('.db', veil), close: (v) => { const i = stack.indexOf(m); if (i >= 0) stack.splice(i, 1); veil.remove(); if (o.onClose) o.onClose(v); } };
    const foot = UI.$('.df', veil);
    (o.actions || []).forEach((a) => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.cls || '');
      b.innerHTML = (a.icon ? ic(a.icon, 'sm') : '') + esc(a.label);
      b.onclick = async () => {
        if (a.run) {
          const r = await a.run(m, b);
          if (r === false) return;
        }
        if (a.close !== false) m.close(a.value);
      };
      foot.appendChild(b);
    });
    veil.addEventListener('mousedown', (e) => { if (e.target === veil && o.dismiss !== false) m._down = true; else m._down = false; });
    veil.addEventListener('click', (e) => { if (e.target === veil && m._down) m.close(); });
    UI.$('[data-close]', veil).onclick = () => m.close();
    stack.push(m);
    // Run after the caller has received `m`, so onMount can safely refer to it.
    Promise.resolve().then(() => {
      if (o.onMount) o.onMount(m);
      const first = UI.$('input:not([type=hidden]):not([type=file]):not([type=checkbox]),select,textarea', veil.querySelector('.db'));
      if (first && o.focus !== false && !matchMedia('(max-width:860px)').matches) first.focus();
    });
    return m;
  };
  UI.confirm = (o) =>
    new Promise((res) => {
      UI.modal({
        title: o.title || 'Are you sure?', narrow: true, body: `<p style="margin:0">${o.message || ''}</p>`,
        onClose: (v) => res(!!v),
        actions: [{ label: 'Cancel' }, { label: o.ok || 'Yes', cls: o.danger ? 'primary' : 'navy', value: true }],
      });
    });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close();
  });

  /* ---------- rendering ---------- */
  UI.NAV = [
    ['week', 'This week', 'calendar'],
    ['events', 'Events', 'list'],
    ['schedule', 'Schedule', 'grid'],
    ['staff', 'Staff', 'users'],
    ['equipment', 'Equipment', 'box'],
    ['rooms', 'Rooms', 'door'],
    ['signs', 'Room signs', 'image'],
    ['settings', 'Settings', 'sliders'],
  ];
  const TAB_MAIN = ['week', 'events', 'schedule', 'staff'];

  UI.renderChrome = () => {
    const S = IH.Store, st = S.state;
    const badges = {};
    try {
      const inv = IH.Inv.analyze(st, UI.weekKey);
      const shorts = inv.alerts.filter((a) => a.level === 'short').length;
      if (shorts) badges.equipment = { n: shorts, cls: '' };
      else if (inv.alerts.length) badges.equipment = { n: inv.alerts.length, cls: 'warn' };
      const sc = st.schedules[UI.weekKey];
      const reqs = IH.Sched.requirements(st, UI.weekKey);
      if (sc) {
        const open = sc.shifts.filter((x) => !x.staffId).length;
        if (open) badges.schedule = { n: open, cls: '' };
      } else if (reqs.length) badges.schedule = { n: '!', cls: 'warn' };
    } catch (e) { /* keep nav usable */ }
    UI.$('#nav').innerHTML = UI.NAV.map(([k, label, icon], i) => `${i === 4 ? '<div class="sep"></div>' : ''}<button data-act="go" data-view="${k}" class="${UI.view === k ? 'on' : ''}">${ic(icon)}<span>${label}</span>${badges[k] ? `<span class="badge ${badges[k].cls}">${badges[k].n}</span>` : ''}</button>`).join('');
    UI.$('#tabbar').innerHTML =
      TAB_MAIN.map((k) => { const n = UI.NAV.find((x) => x[0] === k); return `<button data-act="go" data-view="${k}" class="${UI.view === k ? 'on' : ''}">${ic(n[2])}<span>${n[1].replace('This week', 'Week')}</span></button>`; }).join('') +
      `<button data-act="more" class="${TAB_MAIN.includes(UI.view) ? '' : 'on'}">${ic('more')}<span>More</span></button>`;
  };

  UI.render = () => {
    if (!IH.Store.state) return;
    if (!UI.weekKey) UI.weekKey = UI.defaultWeek();
    const v = UI.Views[UI.view] || UI.Views.week;
    const main = UI.$('#main');
    const y = window.scrollY;
    main.innerHTML = v.render();
    UI.renderChrome();
    if (v.mount) v.mount(main);
    document.title = `${v.title || 'AV Scheduler'} · iHotel AV Scheduler`;
    if (UI._keepScroll) window.scrollTo(0, y);
    UI._keepScroll = false;
  };
  UI.rerender = () => { UI._keepScroll = true; UI.render(); };

  UI.go = (view, params) => {
    UI.view = UI.Views[view] ? view : 'week';
    if (params && params.week) UI.weekKey = IH.Store.weekKeyFor(params.week);
    if (location.hash !== '#/' + UI.view) history.replaceState(null, '', '#/' + UI.view);
    window.scrollTo(0, 0);
    UI.render();
  };
  UI.Acts.go = (el) => UI.go(el.dataset.view);
  UI.Acts.more = () => {
    UI.modal({
      title: 'More', narrow: true, actions: false,
      body: `<div class="col">${UI.NAV.filter((n) => !TAB_MAIN.includes(n[0])).map((n) => `<button class="btn" data-act="go" data-view="${n[0]}" style="justify-content:flex-start">${ic(n[2])} ${n[1]}</button>`).join('')}</div>`,
      onMount: (m) => m.el.addEventListener('click', (e) => { if (e.target.closest('[data-act=go]')) m.close(); }),
    });
  };

  UI.pageTop = (title, kicker, actionsHtml) => `<div class="top"><div><span class="kicker">${esc(kicker || 'Hotel Illinois Conference Center')}</span><h1>${esc(title)}</h1></div><div class="actions">${actionsHtml || ''}</div></div>`;

  /* ---------- global event delegation ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = UI.Acts[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el && UI.Changes[el.dataset.change]) UI.Changes[el.dataset.change](el, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (el && UI.Changes[el.dataset.input]) UI.Changes[el.dataset.input](el, e);
  });
})(typeof window !== 'undefined' ? window : globalThis);
