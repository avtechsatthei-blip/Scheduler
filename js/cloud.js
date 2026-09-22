/* iHotel AV Scheduler — cloud sync (Firebase Realtime Database + email sign-in).
 *
 * Every device keeps a full local copy (works offline). When signed in, changes are merged record by record
 * with the copy in the cloud (see merge.js), so two people or two devices can edit different things safely.
 * Setup steps and the security rules are in README.md and firebase-rules.json.
 */
(function (root) {
  const IH = root.IH, U = IH.U, Store = IH.Store, M = IH.Merge;
  const C = (IH.Cloud = { status: 'off', msg: '', user: null, uid: null, lastSync: null, ready: false });
  const KEY_ON = 'ihotel-cloud-on', KEY_BASE = 'ihotel-cloud-base', KEY_LAST = 'ihotel-cloud-last';
  let auth = null, db = null, ref = null, connRef = null;
  let lastRemote = {}, applying = false, pushTimer = null, queue = Promise.resolve(), started = false;

  const cfg = () => (IH.CLOUD_CONFIG || {});
  C.configured = () => !!(cfg().firebase && cfg().firebase.apiKey && cfg().firebase.databaseURL);
  const ls = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage full or blocked */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  C.enabled = () => ls.get(KEY_ON) === '1';
  const loadBase = () => { try { return JSON.parse(ls.get(KEY_BASE) || '{}') || {}; } catch (e) { return {}; } };
  const saveBase = (m) => ls.set(KEY_BASE, JSON.stringify(m));

  C.setStatus = (status, msg) => {
    C.status = status; C.msg = msg || '';
    if (root.IH.UI && IH.UI.cloudChanged) IH.UI.cloudChanged();
  };

  /* ---------------- SDK + auth ---------------- */
  C.loadSdk = async () => {
    if (root.firebase && root.firebase.apps) return; // already there (or a test stand-in)
    const v = cfg().sdkVersion || '10.12.2';
    const base = `https://www.gstatic.com/firebasejs/${v}/`;
    for (const f of ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-database-compat.js']) await IH.Imp.loadScript(base + f);
  };

  C.start = async () => {
    if (!C.configured() || started) return;
    started = true;
    C.setStatus('connecting', 'Connecting…');
    try {
      await C.loadSdk();
      const fb = root.firebase;
      if (!fb.apps.length) fb.initializeApp(cfg().firebase);
      auth = fb.auth();
      db = fb.database();
      auth.onAuthStateChanged((user) => { queue = queue.then(() => onUser(user)).catch((e) => fail(e)); });
    } catch (e) {
      started = false;
      C.setStatus('error', 'Could not load the sync service. Check your internet connection.');
    }
  };

  const friendly = (e) => {
    const code = (e && e.code) || '';
    const m = {
      'auth/invalid-email': 'That email address does not look right.',
      'auth/user-not-found': 'No account with that email. Use Create account first.',
      'auth/wrong-password': 'That password is not right.',
      'auth/invalid-credential': 'The email or password is not right.',
      'auth/email-already-in-use': 'There is already an account with that email. Use Sign in.',
      'auth/weak-password': 'Use a password with at least 6 characters.',
      'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
      'auth/network-request-failed': 'No internet connection.',
      'auth/operation-not-allowed': 'Email sign-in is not turned on in Firebase yet (Authentication, Sign-in method, Email/Password).',
      'auth/configuration-not-found': 'This Firebase project has no sign-in method set up yet. In the Firebase console, go to Authentication, click "Get started" if you see it, then turn on Email/Password under Sign-in method.',
    };
    return m[code] || (e && e.message) || 'Something went wrong.';
  };
  const fail = (e) => {
    console.warn('cloud', e);
    if (e && /permission_denied|PERMISSION_DENIED/i.test(e.code + ' ' + e.message)) C.setStatus('need-approval', 'Signed in, but this account is not approved yet.');
    else C.setStatus('error', friendly(e));
  };

  C.signIn = async (email, password, create) => {
    ls.set(KEY_ON, '1');
    await C.start();
    if (!auth) return { error: C.msg || 'Could not start sync.' };
    try {
      if (create) await auth.createUserWithEmailAndPassword(email, password);
      else await auth.signInWithEmailAndPassword(email, password);
      return {};
    } catch (e) { return { error: friendly(e) }; }
  };
  C.reset = async (email) => {
    await C.start();
    try { await auth.sendPasswordResetEmail(email); return {}; } catch (e) { return { error: friendly(e) }; }
  };
  C.signOut = async () => {
    ls.del(KEY_ON); ls.del(KEY_BASE); ls.del(KEY_LAST);
    detach();
    C.user = null; C.uid = null; C.ready = false; lastRemote = {};
    try { if (auth) await auth.signOut(); } catch (e) { /* ignore */ }
    C.setStatus('off', '');
  };

  /* ---------------- connect and merge ---------------- */
  function detach() {
    try { if (ref) ref.off('value'); if (connRef) connRef.off('value'); } catch (e) { /* ignore */ }
    ref = null; connRef = null;
  }

  async function onUser(user) {
    detach();
    C.ready = false;
    if (!user) { C.user = null; C.uid = null; C.setStatus(C.enabled() ? 'signed-out' : 'off', ''); return; }
    C.user = user.email || 'signed in'; C.uid = user.uid;
    C.setStatus('connecting', 'Syncing…');
    ref = db.ref(cfg().root || 'avScheduler');
    let first = true;
    const onSnap = (snap) => {
      queue = queue.then(async () => {
        lastRemote = flatten(snap.val());
        if (first) { first = false; await firstSync(lastRemote); }
        else if (C.ready) await syncFrom(lastRemote);
      }).catch(fail);
    };
    ref.on('value', onSnap, (err) => fail(err));
    connRef = db.ref('.info/connected');
    connRef.on('value', (s) => { if (C.ready) C.setStatus(s.val() === false ? 'offline' : 'ok', s.val() === false ? 'Offline. Changes are saved here and will sync when you reconnect.' : ''); });
  }

  const flatten = (val) => {
    const out = {};
    Object.entries(val || {}).forEach(([col, recs]) => {
      if (!recs || typeof recs !== 'object') return;
      Object.entries(recs).forEach(([id, r]) => { if (r && typeof r.d === 'string') out[`${col}/${id}`] = r.d; });
    });
    return out;
  };
  const stampNow = () => root.firebase.database.ServerValue.TIMESTAMP;
  const toUpdate = (push, remove) => {
    const o = {};
    Object.entries(push).forEach(([k, d]) => { o[k] = { d, u: stampNow() }; });
    remove.forEach((k) => { o[k] = null; });
    return o;
  };
  const applyLocal = (final, resetWeek) => {
    applying = true;
    try { Store.replaceState(M.fromRecords(final, Store.state.meta)); } finally { applying = false; }
    // Adopting a whole different dataset (not just a few merged changes): if the week on screen has
    // nothing in it, jump to one that does, the same way the app picks a week on first load.
    if (resetWeek && root.IH.UI && root.IH.UI.weekKey) {
      try { sessionStorage.removeItem('ih-week'); } catch (e) { /* ignore */ }
      root.IH.UI.weekKey = root.IH.UI.defaultWeek();
      root.IH.UI.render();
    }
  };
  const done = (final) => {
    saveBase(final);
    C.lastSync = Date.now(); ls.set(KEY_LAST, String(C.lastSync));
    C.ready = true;
    C.setStatus('ok', '');
  };

  async function firstSync(R) {
    const L = M.toRecords(Store.state);
    const B = loadBase();
    const cloudHasData = Object.keys(R).some((k) => !/^(settings|meta)\//.test(k));
    if (!Object.keys(B).length) {
      if (!cloudHasData) { // brand-new cloud: upload this browser's data
        await ref.update(toUpdate(L, []));
        return done(L);
      }
      if (M.isPristine(Store.state)) { applyLocal(R, true); return done(R); }
      const strip = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => !/^(settings|meta)\//.test(k)));
      if (!M.differs(strip(L), strip(R))) { done(R); return; }
      const choice = await chooseSource(L, R);
      if (choice === 'cloud') { applyLocal(R, true); return done(R); }
      if (choice === 'local') {
        const remove = Object.keys(R).filter((k) => !(k in L));
        await ref.update(toUpdate(L, remove));
        return done(L);
      }
      C.setStatus('paused', 'Cloud sync is paused. Nothing was changed.');
      return;
    }
    await runMerge(L, B, R);
  }

  async function syncFrom(R) {
    if (applying) return;
    await runMerge(M.toRecords(Store.state), loadBase(), R);
  }

  async function runMerge(L, B, R) {
    const plan = M.three(L, B, R);
    const changedLocal = Object.keys(plan.apply).length + plan.deleteLocal.length;
    const hasPush = Object.keys(plan.push).length + plan.remove.length;
    if (hasPush) { C.setStatus('syncing', 'Saving to the cloud…'); await ref.update(toUpdate(plan.push, plan.remove)); }
    if (changedLocal) {
      applyLocal(plan.final);
      if (IH.UI && IH.UI.toast && !hasPush) IH.UI.toast('Updated from another device');
    }
    if (plan.conflicts.length && IH.UI && IH.UI.toast) IH.UI.toast(`${plan.conflicts.length} item${plan.conflicts.length === 1 ? ' was' : 's were'} edited on two devices at once. The newer cloud version was kept.`, 'bad');
    done(plan.final);
  }

  function chooseSource(L, R) {
    const n = (m, c) => M.count(m, c);
    return new Promise((res) => {
      IH.UI.modal({
        title: 'Which data should we keep?', dismiss: false,
        body: `<p style="margin-top:0">This browser and the cloud both already have data, and they are different.</p>
          <div class="row wrap" style="gap:14px"><div class="card pad grow"><b>This browser</b><div class="small muted">${n(L, 'events')} events · ${n(L, 'staff')} staff · ${n(L, 'inventory')} equipment items · ${n(L, 'audits')} audits</div></div>
          <div class="card pad grow"><b>The cloud</b><div class="small muted">${n(R, 'events')} events · ${n(R, 'staff')} staff · ${n(R, 'inventory')} equipment items · ${n(R, 'audits')} audits</div></div></div>
          <p class="small muted" style="margin-bottom:0">Whichever you pick replaces the other. If unsure, download a backup from Settings first, then choose the cloud.</p>`,
        onClose: (v) => res(v || 'cancel'),
        actions: [{ label: 'Not now', value: 'cancel' }, { label: 'Use this browser\'s data', value: 'local' }, { label: 'Use the cloud data', cls: 'primary', value: 'cloud' }],
      });
    });
  }

  /* ---------------- local edits go up ---------------- */
  C.onLocalSave = () => {
    if (!C.ready || applying || !ref) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      queue = queue.then(async () => {
        if (!C.ready || !ref) return;
        const L = M.toRecords(Store.state), B = loadBase();
        if (!M.differs(L, B)) return;
        await runMerge(L, B, lastRemote);
      }).catch(fail);
    }, 600);
  };
  Store.hooks.save.push(C.onLocalSave);

  C.syncNow = async () => {
    if (!ref) return;
    C.setStatus('syncing', 'Syncing…');
    try { const snap = await ref.once('value'); lastRemote = flatten(snap.val()); queue = queue.then(() => syncFrom(lastRemote)).catch(fail); await queue; } catch (e) { fail(e); }
  };

  // Try again after an error or after the account was approved.
  C.retry = () => {
    if (!auth) { started = false; return C.start(); }
    queue = queue.then(() => onUser(auth.currentUser)).catch(fail);
    return queue;
  };

  C.init = () => {
    if (C.configured() && C.enabled()) C.start();
    else C.setStatus('off', '');
  };
  C.lastSyncText = () => { const t = C.lastSync || +ls.get(KEY_LAST) || 0; return t ? new Date(t).toLocaleString() : ''; };
})(typeof window !== 'undefined' ? window : globalThis);
