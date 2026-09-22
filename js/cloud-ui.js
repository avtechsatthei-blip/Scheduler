/* Cloud sync: the Settings card and the little status line in the sidebar */
(function (root) {
  const IH = root.IH, UI = IH.UI, C = IH.Cloud;
  const { esc, icon: ic } = UI;

  const LABEL = {
    off: ['', 'Saved in this browser'], 'signed-out': ['', 'Cloud sync: sign in'], connecting: ['busy', 'Connecting…'], syncing: ['busy', 'Syncing…'], ok: ['ok', 'Synced to the cloud'],
    offline: ['bad', 'Offline. Saved here'], error: ['bad', 'Sync problem'], 'need-approval': ['bad', 'Needs approval'], paused: ['bad', 'Sync paused'],
  };

  // Before anyone is signed in, every state shows the same sign-in form (so typing is never wiped).
  const isForm = () => !C.user && ['off', 'signed-out', 'connecting', 'error'].includes(C.status);
  const cardKey = () => (isForm() ? 'form|' + (C.status === 'error' ? C.msg : '') : C.status + '|' + C.user + '|' + C.msg + '|' + C.lastSync);

  C.cardInner = () => {
    if (!C.configured()) return `<h3>Cloud sync</h3><p class="muted small" style="margin:6px 0 0">Not set up in this copy of the app. Put your Firebase keys in <code>js/cloud-config.js</code> (steps are in the README).</p>`;
    const s = C.status, [dot, label] = LABEL[s] || ['', s];
    let h = `<div class="row"><h3>Cloud sync</h3><span class="right small" style="display:inline-flex;align-items:center"><span class="cloud-dot ${dot}"></span>${esc(label)}</span></div>`;
    if (isForm()) {
      return h + `<p class="muted small" style="margin:6px 0 14px">Sign in to keep your schedule, staff, events, equipment and audits in the cloud, so you can open them from any computer, tablet or phone. The first time, choose <b>Create account</b>. Everyone on the team can use the same sign-in, or each person can have their own.</p>
        <div class="form-grid" id="cloud-form"><div class="span-5">${UI.field('Email', '<input class="in" type="email" id="cl-email" autocomplete="username" placeholder="you@example.com">')}</div>
        <div class="span-4">${UI.field('Password', '<input class="in" type="password" id="cl-pass" autocomplete="current-password" placeholder="6 or more characters">')}</div>
        <div class="span-3" style="align-self:end"><div class="row" style="gap:8px"><button class="btn primary" data-act="cloud-signin">Sign in</button><button class="btn" data-act="cloud-create">Create account</button></div></div></div>
        <div class="row" style="margin-top:8px"><button class="btn ghost xs" data-act="cloud-reset">Forgot password?</button><span id="cloud-err" class="small" style="color:var(--bad)">${s === 'error' ? esc(C.msg) : ''}</span></div>`;
    }
    h += `<p class="small" style="margin:8px 0">Signed in as <b>${esc(C.user || '')}</b>${C.lastSyncText() ? ` · last synced ${esc(C.lastSyncText())}` : ''}</p>`;
    if (s === 'need-approval') {
      h += `<div class="callout warn" style="margin-bottom:12px">${ic('alert')}<div><b>One more step: approve this account.</b><ol class="small" style="margin:6px 0 0;padding-left:18px"><li>Open the <b>Firebase console</b>, your project, <b>Realtime Database</b>, <b>Data</b>.</li><li>Under the top-level name add a child called <code>avSchedulerAllowed</code>.</li><li>Inside it, add a child whose <b>name is the ID below</b> and whose <b>value is</b> <code>true</code>.</li><li>Come back here and press <b>Check again</b>.</li></ol></div></div>
        <div class="uidbox" id="cl-uid">${esc(C.uid || '')}</div>`;
      return h + `<div class="row wrap" style="margin-top:10px"><button class="btn" data-act="cloud-copy">Copy ID</button><button class="btn navy" data-act="cloud-retry">Check again</button><button class="btn ghost" data-act="cloud-signout">Sign out</button></div>`;
    }
    if (s === 'error') h += `<div class="callout bad" style="margin-bottom:10px">${ic('alert')}<div>${esc(C.msg)}</div></div>`;
    else if (s === 'paused') h += `<div class="callout warn" style="margin-bottom:10px">${ic('alert')}<div>${esc(C.msg)}</div></div>`;
    else if (s === 'offline') h += `<div class="callout info" style="margin-bottom:10px">${ic('info')}<div>${esc(C.msg)}</div></div>`;
    else h += `<p class="muted small" style="margin:0 0 10px">Changes sync in a few seconds and show up on your other devices without reloading. This browser also keeps its own copy, so the app still works offline.</p>`;
    return h + `<div class="row wrap"><button class="btn navy" data-act="cloud-sync">${ic('refresh', 'sm')} Sync now</button>${s === 'error' || s === 'paused' ? '<button class="btn" data-act="cloud-retry">Try again</button>' : ''}<button class="btn ghost" data-act="cloud-signout">Sign out and stop syncing</button></div>`;
  };
  C.cardHtml = () => `<div class="card pad" id="cloud-card" data-key="${esc(cardKey())}">${C.cardInner()}</div>`;

  UI.cloudChanged = () => {
    const foot = UI.$('#cloud-status');
    if (foot) { const [dot, label] = LABEL[C.status] || ['', '']; foot.innerHTML = `<span class="cloud-dot ${dot}"></span>${esc(label)}`; }
    const card = UI.$('#cloud-card');
    // The sign-in form looks the same for "off" and "signed out"; don't rebuild it (and wipe what was typed).
    const key = cardKey();
    if (card && card.dataset.key !== key) { card.dataset.key = key; card.innerHTML = C.cardInner(); }
  };

  const val = (id) => (UI.$(id) ? UI.$(id).value.trim() : '');
  const err = (t) => { const e = UI.$('#cloud-err'); if (e) e.textContent = t || ''; };
  const busy = (el, on) => { if (el) el.disabled = on; };
  async function go(el, create) {
    const email = val('#cl-email'), pass = UI.$('#cl-pass') ? UI.$('#cl-pass').value : '';
    if (!email || !pass) { err('Enter your email and a password.'); return; }
    err(''); busy(el, true);
    const r = await C.signIn(email, pass, create);
    busy(el, false);
    if (r.error) err(r.error);
  }
  UI.Acts['cloud-signin'] = (el) => go(el, false);
  UI.Acts['cloud-create'] = (el) => go(el, true);
  UI.Acts['cloud-reset'] = async () => {
    const email = val('#cl-email');
    if (!email) { err('Type your email above first, then press Forgot password.'); return; }
    const r = await C.reset(email);
    if (r.error) err(r.error); else UI.toast('Password reset email sent', 'ok');
  };
  UI.Acts['cloud-signout'] = async () => {
    if (await UI.confirm({ title: 'Stop syncing?', message: 'This browser keeps its copy of your data. The cloud copy is not deleted. You can sign in again any time.', ok: 'Sign out' })) { await C.signOut(); UI.toast('Signed out. Data stays on this device.'); }
  };
  UI.Acts['cloud-sync'] = () => C.syncNow();
  UI.Acts['cloud-retry'] = () => C.retry();
  UI.Acts['cloud-copy'] = async () => { try { await navigator.clipboard.writeText(C.uid || ''); UI.toast('ID copied', 'ok'); } catch (e) { UI.toast('Select the ID and copy it by hand'); } };
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.id === 'cl-pass') UI.Acts['cloud-signin'](UI.$('[data-act=cloud-signin]')); });
})(typeof window !== 'undefined' ? window : globalThis);
