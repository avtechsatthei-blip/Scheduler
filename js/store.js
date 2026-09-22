/* iHotel AV Scheduler — data store (localStorage + JSON backup) */
(function (root) {
  const IH = (root.IH = root.IH || {});
  const U = IH.U;
  const KEY = 'ihotel-av-scheduler-v1';

  const DEFAULT_SETTINGS = {
    minDayHrs: 4, // shortest shift we'll schedule (shorter needs are padded to this)
    maxDayHrs: 10, // longest shift (longer needs are split between people)
    minRestHrs: 10, // minimum time between the end of one shift and the start of the next
    bufferBeforeMin: 60, // staff arrive this long before an event starts
    bufferAfterMin: 30, // staff stay this long after an event ends
    bridgeGapHrs: 2, // one person can cover two events if the gap between them is this short or less
    handoffMin: 0, // overlap when a long day is split between two people
    baseCrew: 1, // people covering the room set on any AV day (besides in-room techs)
    maxWeekHrs: 40, // default weekly cap when a person has no cap of their own
    overtimeHrs: 40, // soft: schedules avoid pushing people past this
    weekStart: 1, // 0 = Sunday, 1 = Monday
    lowStockPct: 80, // warn when peak use reaches this % of inventory
    techRate: 60, // in-room tech billing, $/hr
    techMinBillHrs: 4, // in-room tech billing minimum
    defaultStart: '08:00', // used when a PDF has no readable times
    defaultEnd: '17:00',
    signTheme: 'classic', // classic | brand
    signShowDate: false,
  };

  const AV_STD = [
    ['Projector', 2],
    ['Screen', 2],
    ['Podium', 1],
    ['Wired Mic', 1],
    ['CC Laptop', 1],
    ['HDMI', 1],
  ];
  const ROOM_SEED = [
    { id: 'r_chancellor', name: 'Chancellor Ballroom', aliases: ['chancellor'], items: AV_STD.concat([['Riser', 3], ['Step', 2]]) },
    { id: 'r_alma', name: 'Alma Mater', aliases: ['alma mater', 'alma'], items: AV_STD },
    { id: 'r_lincoln', name: 'Lincoln Room', aliases: ['lincoln'], items: AV_STD },
    { id: 'r_quad', name: 'Quad Room', aliases: ['quad'], items: [['Projector', 1], ['Screen', 1], ['Podium', 1], ['Wired Mic', 1], ['CC Laptop', 1], ['HDMI', 1]] },
    { id: 'r_tech', name: 'Technology Room', aliases: ['technology', 'tech room'], items: AV_STD },
    { id: 'r_leadership', name: 'Leadership Board Room', aliases: ['leadership', 'lounge', 'boardroom', 'board room'], items: [] },
    { id: 'r_innovation', name: 'Innovation Room', aliases: ['innovation'], items: [] },
  ];
  // Placeholder quantities — the first-run screen asks you to replace these with your real counts.
  const INVENTORY_SEED = [
    // name, qty, rent $/day, category
    ['Projector', 6, 150, 'Video'],
    ['Screen', 6, 60, 'Video'],
    ['Podium', 4, 40, 'Staging'],
    ['Wired Mic', 6, 35, 'Audio'],
    ['CC Laptop', 4, 75, 'Computers'],
    ['HDMI', 8, 0, 'Cables & adapters'],
    ['Riser', 6, 0, 'Staging'],
    ['Step', 4, 0, 'Staging'],
    ['360 Camera', 1, 0, 'Video'],
  ];
  let ordSeq = 0;
  const nextOrd = () => Date.now() * 1000 + (ordSeq++ % 1000); // increasing, so new records sort after old ones on every device
  const CONDITIONS = ['Good', 'Fair', 'Needs repair', 'Retired'];
  const CATEGORIES = ['Video', 'Audio', 'Lighting', 'Computers', 'Cables & adapters', 'Staging', 'Power', 'Other'];

  function newItem(over) {
    if (over) over = Object.fromEntries(Object.entries(over).filter(([, v]) => v !== undefined)); // an undefined id must not wipe the fresh one
    return Object.assign(
      { id: U.uid('inv'), name: '', category: '', model: '', assetTag: '', serial: '', location: '', qty: 1, out: 0, condition: 'Good', purchased: '', value: '', rentable: false, rentCost: 0, notes: '', lastAudit: '', ord: nextOrd() },
      over || {}
    );
  }

  function baseState() {
    return {
      version: 1,
      settings: U.clone(DEFAULT_SETTINGS),
      staff: [],
      rooms: ROOM_SEED.map((r, i) => ({
        id: r.id,
        name: r.name,
        aliases: r.aliases,
        items: r.items.map(([name, qty]) => ({ name, qty, builtIn: false })),
        notes: '',
        ord: i,
      })),
      inventory: INVENTORY_SEED.map(([name, qty, rentCost, category], i) => newItem({ name, qty, rentable: true, rentCost, category, ord: i })),
      events: [],
      audits: [], // monthly equipment audits
      schedules: {}, // weekKey -> { shifts:[], optionName, savedAt }
      meta: { firstRun: true, sampleLoaded: false },
    };
  }

  function newStaff(over) {
    const avail = {};
    for (let i = 0; i < 7; i++) avail[i] = { on: true, from: '', to: '' };
    return Object.assign(
      { id: U.uid('st'), ord: nextOrd(), name: 'New staff', role: 'AV tech', color: U.STAFF_COLORS[0], active: true, minWeek: 0, maxWeek: null, canTech: true, avail, daysOff: [], notes: '' },
      over || {}
    );
  }

  function sampleStaff() {
    const mk = (name, color, minWeek, maxWeek, pref, off) => {
      const s = newStaff({ name, color, minWeek, maxWeek, role: 'AV tech' });
      for (let i = 0; i < 7; i++) s.avail[i] = { on: pref.days.includes(i), from: pref.from, to: pref.to };
      if (off) s.daysOff = off;
      return s;
    };
    return [
      mk('Alex Rivera', U.STAFF_COLORS[0], 16, 40, { days: [1, 2, 3, 4, 5], from: '07:00', to: '16:00' }),
      mk('Jordan Lee', U.STAFF_COLORS[1], 16, 36, { days: [0, 1, 2, 3, 4, 5, 6], from: '10:00', to: '20:00' }),
      mk('Sam Patel', U.STAFF_COLORS[2], 8, 24, { days: [2, 3, 4, 5, 6], from: '12:00', to: '21:00' }),
      mk('Casey Morgan', U.STAFF_COLORS[3], 8, 20, { days: [0, 4, 5, 6], from: '', to: '' }),
      mk('Riley Chen', U.STAFF_COLORS[4], 12, 32, { days: [0, 1, 2, 3, 4, 5, 6], from: '', to: '' }),
      mk('Taylor Brooks', U.STAFF_COLORS[5], 0, 20, { days: [1, 2, 3, 4, 5], from: '08:00', to: '17:00' }, [
        { id: U.uid('off'), start: '2026-09-17', end: '2026-09-17', note: 'Sample day-off request' },
      ]),
    ];
  }

  function sampleEvents(state) {
    const room = (id) => state.rooms.find((r) => r.id === id);
    const mk = (date, roomId, start, end, techCount, attendees, style, extraItems, notes) => {
      const r = room(roomId);
      const items = r.items.map((i) => ({ ...i }));
      (extraItems || []).forEach(([name, qty]) => {
        const ex = items.find((i) => U.itemKey(i.name) === U.itemKey(name));
        if (ex) ex.qty = qty;
        else items.push({ name, qty, builtIn: false });
      });
      return {
        id: U.uid('ev'),
        name: "Fall Conference For Vet's",
        roomId,
        date,
        start,
        end,
        items,
        tech: { count: techCount, start: '', end: '' },
        noAV: items.length === 0 && techCount === 0,
        attendees,
        contact: 'Sample Contact',
        setup: style,
        notes: notes || '',
        source: 'sample',
      };
    };
    const thu = '2026-09-17', fri = '2026-09-18';
    return [
      mk(thu, 'r_chancellor', '09:00', '16:50', 2, 180, '18 rounds of 10', [], 'Agenda: 6:30a contact arrives, 8a guests, 9a session, bar 5–7:30p, room clear 8p'),
      mk(thu, 'r_alma', '09:00', '16:50', 0, 75, '25 classrooms, 3 per'),
      mk(thu, 'r_lincoln', '09:00', '16:50', 1, 75, '25 classrooms, 3 per'),
      mk(thu, 'r_tech', '09:00', '16:50', 1, 60, '6 rounds of 10'),
      mk(thu, 'r_quad', '09:00', '16:50', 0, 60, '6 rounds of 10'),
      mk(thu, 'r_leadership', '09:00', '16:50', 0, 5, 'Boardroom for 5'),
      mk(thu, 'r_innovation', '12:00', '16:00', 0, 40, '4 rounds of 10'),
      mk(fri, 'r_chancellor', '09:00', '16:00', 2, 150, '15 rounds of 8', [['360 Camera', 1]]),
      mk(fri, 'r_alma', '09:00', '16:00', 1, 75, '25 classrooms, 3 per'),
      mk(fri, 'r_lincoln', '09:00', '16:00', 1, 75, '25 classrooms, 3 per'),
      mk(fri, 'r_tech', '09:00', '16:00', 1, 60, '6 rounds of 10'),
      mk(fri, 'r_quad', '09:00', '16:00', 0, 40, '20 classrooms, 2 per'),
      mk(fri, 'r_leadership', '09:00', '16:00', 0, 5, 'Boardroom for 5'),
    ];
  }

  const Store = (IH.Store = {
    state: null,
    listeners: [],
    newStaff,
    newItem,
    nextOrd,
    CONDITIONS,
    CATEGORIES,
    DEFAULT_SETTINGS,

    load() {
      let saved = null;
      try {
        saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      } catch (e) {
        saved = null;
      }
      Store.state = Store.normalize(saved);
      return Store.state;
    },
    normalize(saved) {
      const base = baseState();
      if (!saved || typeof saved !== 'object') return base;
      const s = Object.assign(base, saved);
      s.settings = Object.assign({}, DEFAULT_SETTINGS, saved.settings || {});
      s.staff = (saved.staff || []).map((x, i) => {
        const n = newStaff(x);
        if (x.ord == null) n.ord = i;
        for (let i = 0; i < 7; i++) n.avail[i] = Object.assign({ on: true, from: '', to: '' }, (x.avail || {})[i] || {});
        return n;
      });
      s.events = (saved.events || []).map((e) => Object.assign({ items: [], tech: { count: 0, start: '', end: '' }, noAV: false }, e));
      if (saved.rooms) s.rooms = saved.rooms.map((r, i) => Object.assign({ aliases: [], items: [], notes: '', ord: i }, r, { items: r.items || [], aliases: r.aliases || [] }));
      s.rooms.forEach((r, i) => { if (r.ord == null) r.ord = i; });
      if (saved.inventory) s.inventory = saved.inventory.map((x, i) => newItem(Object.assign({ ord: i }, x)));
      s.audits = (saved.audits || []).map((a) => Object.assign({ lines: [], extras: [], status: 'open' }, a));
      s.schedules = saved.schedules || {};
      s.meta = Object.assign({ firstRun: false }, saved.meta || {});
      return s;
    },
    hooks: { save: [] }, // the cloud layer listens here
    save(silent) {
      try {
        localStorage.setItem(KEY, JSON.stringify(Store.state));
      } catch (e) {
        console.warn('Could not save', e);
      }
      if (!silent) Store.hooks.save.forEach((f) => f());
    },
    // Used by cloud sync: swap in data that came from the server without echoing it back.
    replaceState(next) {
      Store.state = Store.normalize(next);
      Store.save(true);
      Store.listeners.forEach((f) => f());
    },
    update(fn) {
      fn(Store.state);
      Store.save();
      Store.listeners.forEach((f) => f());
    },
    onChange(fn) {
      Store.listeners.push(fn);
    },
    reset() {
      Store.state = baseState();
      Store.save();
      Store.listeners.forEach((f) => f());
    },
    loadSample() {
      Store.update((s) => {
        const fresh = baseState();
        s.rooms = fresh.rooms;
        s.inventory = fresh.inventory;
        s.staff = sampleStaff();
        s.events = sampleEvents(s);
        s.schedules = {};
        s.meta.firstRun = false;
        s.meta.sampleLoaded = true;
      });
    },
    exportJSON() {
      return JSON.stringify(Store.state, null, 2);
    },
    importJSON(text) {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.events)) throw new Error('This file is not an iHotel scheduler backup.');
      Store.state = Store.normalize(parsed);
      Store.save();
      Store.listeners.forEach((f) => f());
    },

    /* ---------- lookups ---------- */
    room(id) {
      return Store.state.rooms.find((r) => r.id === id);
    },
    staffById(id) {
      return Store.state.staff.find((s) => s.id === id);
    },
    findRoomByName(name) {
      const k = String(name || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\b(ballroom|room|hall)\b/g, ' ').replace(/\s+/g, ' ').trim();
      if (!k) return null;
      const rooms = Store.state.rooms;
      let hit = rooms.find((r) => r.name.toLowerCase() === String(name).toLowerCase().trim());
      if (hit) return hit;
      const norm = (s) => String(s).toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\b(ballroom|room|hall)\b/g, ' ').replace(/\s+/g, ' ').trim();
      hit = rooms.find((r) => norm(r.name) === k);
      if (hit) return hit;
      hit = rooms.find((r) => (r.aliases || []).some((a) => norm(a) === k));
      if (hit) return hit;
      hit = rooms.find((r) => k.includes(norm(r.name)) || norm(r.name).includes(k) || (r.aliases || []).some((a) => k.includes(norm(a)) && norm(a).length > 3));
      return hit || null;
    },
    inventoryByKey() {
      const m = {};
      Store.state.inventory.forEach((i) => (m[U.itemKey(i.name)] = i));
      return m;
    },
    weekKeyFor(iso) {
      return U.weekStart(iso, Store.state.settings.weekStart);
    },
    eventsInWeek(weekKey) {
      const d = new Set(U.weekDates(weekKey));
      return Store.state.events
        .filter((e) => d.has(e.date))
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start) || String(a.name).localeCompare(b.name));
    },
    allWeekKeys() {
      const keys = new Set();
      Store.state.events.forEach((e) => keys.add(Store.weekKeyFor(e.date)));
      Object.keys(Store.state.schedules).forEach((k) => keys.add(k));
      return [...keys].sort();
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
