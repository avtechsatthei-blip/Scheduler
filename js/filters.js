/* Shared search + room + day filter used by This week, Events, Schedule and Room signs */
(function (root) {
  const IH = root.IH, U = IH.U, UI = IH.UI, Store = IH.Store;
  const { esc, icon: ic } = UI;
  const F = (UI.filter = { q: '', rooms: [], day: '' });

  UI.filterActive = () => !!(F.q.trim() || F.rooms.length || F.day);
  UI.filterClear = () => { F.q = ''; F.rooms = []; F.day = ''; };

  // Does this event pass the filter? opts.ignoreDay is used to count events per day for the day picker.
  UI.evMatches = (ev, opts) => {
    if (F.rooms.length && !F.rooms.includes(ev.roomId)) return false;
    if (!(opts && opts.ignoreDay) && F.day && ev.date !== F.day) return false;
    const q = F.q.trim().toLowerCase();
    if (q) {
      const hay = [ev.name, UI.roomName(ev.roomId), ev.contact, ev.setup, ev.notes, UI.itemsText(ev)].join(' ').toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  };

  // Keep a leftover day from another week from silently hiding everything.
  UI.normFilter = () => {
    const weekMode = UI.view === 'week' || UI.view === 'schedule' || (UI.view === 'events' && UI.mem.events && UI.mem.events.scope === 'week') || (UI.view === 'signs' && UI.mem.signs && UI.mem.signs.scope === 'week');
    if (weekMode && F.day && !U.weekDates(UI.weekKey).includes(F.day)) F.day = '';
  };

  /**
   * opts.days: 'week' (pick one of this week's days) | 'date' (any date) | false
   * opts.info: text shown on the right, e.g. "Showing 4 of 13"
   */
  UI.filterBar = (opts) => {
    opts = opts || {};
    const rooms = Store.state.rooms;
    let day = '';
    if (opts.days === 'week') {
      const dates = U.weekDates(UI.weekKey);
      day = `<select class="in sm" data-change="flt-day" style="width:auto" aria-label="Day"><option value="">All days</option>${dates.map((d) => {
        const n = Store.state.events.filter((e) => e.date === d && UI.evMatches(e, { ignoreDay: true })).length;
        return UI.opt(d, `${U.fmtDay(d)}${n ? ` (${n})` : ''}`, F.day === d);
      }).join('')}</select>`;
    } else if (opts.days === 'date') day = `<input class="in sm" type="date" data-change="flt-day" value="${esc(F.day)}" style="width:auto" aria-label="Day">`;
    const active = UI.filterActive();
    return `<div class="fbar noprint ${active ? 'active' : ''}">
      <input class="in sm q" id="flt-q" placeholder="Search events, rooms, items…" value="${esc(F.q)}" data-input="flt-q" aria-label="Search">
      ${day}
      <div class="rooms">${rooms.map((r) => `<button class="rchip ${F.rooms.includes(r.id) ? 'on' : ''}" style="--rc:${UI.roomColor(r.id)}" data-act="flt-room" data-id="${r.id}" aria-pressed="${F.rooms.includes(r.id)}">${esc(r.name)}</button>`).join('')}</div>
      ${active ? `<button class="btn xs" data-act="flt-clear">${ic('x', 'sm')} Clear</button>` : ''}
      ${opts.info ? `<span class="muted small right">${opts.info}</span>` : ''}</div>`;
  };

  UI.Acts['flt-room'] = (el) => {
    const i = F.rooms.indexOf(el.dataset.id);
    if (i >= 0) F.rooms.splice(i, 1); else F.rooms.push(el.dataset.id);
    UI.rerender();
  };
  UI.Acts['flt-clear'] = () => { UI.filterClear(); UI.rerender(); };
  UI.Changes['flt-day'] = (el) => { F.day = el.value; UI.rerender(); };
  UI.Changes['flt-q'] = (el) => {
    F.q = el.value;
    const pos = el.selectionStart;
    UI.rerender();
    const n = UI.$('#flt-q');
    if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
  };
})(typeof window !== 'undefined' ? window : globalThis);
