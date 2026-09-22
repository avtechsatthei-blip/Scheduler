/* This week: the at-a-glance board for one week */
(function (root) {
  const IH = root.IH, U = IH.U, UI = IH.UI, Store = IH.Store;
  const { esc, icon: ic } = UI;

  UI.eventCard = (ev, sched) => {
    const room = Store.room(ev.roomId);
    const rc = UI.roomColor(ev.roomId);
    const chips = [];
    if (ev.noAV) chips.push('<span class="tag gray">No AV</span>');
    else {
      const n = (ev.items || []).reduce((a, i) => a + (+i.qty || 0), 0);
      if (n) chips.push(`<span class="tag info">${n} AV item${n > 1 ? 's' : ''}</span>`);
    }
    if (IH.Sched.techPeak(ev)) chips.push(`<span class="tag navy">${esc(IH.Sched.techText(ev))}</span>`);
    if (ev.review) chips.push('<span class="tag warn">Review</span>');
    let crew = '';
    if (sched) {
      const ids = [...new Set(sched.shifts.filter((x) => (x.eventIds || []).includes(ev.id)).map((x) => x.staffId))];
      crew = ids.length ? `<div class="crew">${ids.map((id) => (id ? UI.staffMini(Store.staffById(id) || { name: '?', color: '#999' }) : '<span class="mini-av" style="background:#c43d2b" title="Open shift">!</span>')).join('')}</div>` : '';
    }
    return `<button class="evc" style="--rc:${rc}" data-act="ev-edit" data-id="${ev.id}">
      <div class="t">${U.fmtRange(ev.start, ev.end)}</div><div class="n">${esc(ev.name)}</div>
      <div class="r">${esc(room ? room.name : 'No room')}</div>
      ${chips.length ? `<div class="m">${chips.join('')}</div>` : ''}${crew}</button>`;
  };

  function stat(k, v, s, cls) {
    return `<div class="card stat ${cls || ''}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  }

  UI.Views.week = {
    title: 'This week',
    render() {
      const st = Store.state, wk = UI.weekKey;
      const dates = U.weekDates(wk);
      const evs = Store.eventsInWeek(wk); // whole week: used for the numbers above the board
      const shown = evs.filter((e) => UI.evMatches(e));
      const sched = st.schedules[wk] || null;
      const reqs = IH.Sched.requirements(st, wk);
      const inv = IH.Inv.analyze(st, wk);
      const issues = sched ? IH.Sched.validate(st, wk, sched.shifts) : [];
      const bill = IH.Sched.techBilling(st, wk);
      const shorts = inv.alerts.filter((a) => a.level === 'short');
      const lows = inv.alerts.filter((a) => a.level === 'low');
      const reqHrs = reqs.reduce((a, r) => a + (r.e - r.s), 0) / 60;
      const top = UI.pageTop('This week', 'Overview',
        `${UI.weekNav()}<button class="btn" data-act="ev-new">${ic('plus', 'sm')} Add event</button>
         <button class="btn" data-act="import-open">${ic('upload', 'sm')} Import PDF</button>
         <button class="btn primary" data-act="gen-go">${ic('wand', 'sm')} ${sched ? 'Open schedule' : 'Build schedule'}</button>`);

      // ----- first run
      if (st.meta.firstRun && !st.events.length) {
        return top + `<div class="card pad empty" style="margin-top:8px">
          <h3>Welcome. Let's set up your week.</h3>
          <p>Add your staff, rooms and equipment once. After that, drop in a week of events (or import the event-sheet PDF) and get schedule options, equipment warnings and room signs.</p>
          <div class="row wrap" style="justify-content:center"><button class="btn primary" data-act="load-sample">${ic('sparkle', 'sm')} Load the sample week</button><button class="btn" data-act="start-fresh">Start from scratch</button></div>
          <div class="steps">
            <div class="step"><span class="n">1</span><div><b>Equipment</b><div class="small muted">Enter what you actually own. The starting counts are placeholders.</div></div></div>
            <div class="step"><span class="n">2</span><div><b>Staff</b><div class="small muted">Preferred hours, weekly minimums and maximums, days off.</div></div></div>
            <div class="step"><span class="n">3</span><div><b>Events</b><div class="small muted">Type them in, or import a PDF and review the drafts.</div></div></div>
          </div></div>`;
      }

      const needs = []; // [level, icon, text, target]
      if (shorts.length) {
        const by = {};
        shorts.forEach((a) => { by[a.item] = Math.max(by[a.item] || 0, a.need); });
        const days = [...new Set(shorts.map((a) => a.date))].sort().map(U.fmtDay).join(', ');
        needs.push(['bad', 'box', `Short on equipment (${days}): ${Object.entries(by).map(([k, n]) => `${n} ${k}${n > 1 ? 's' : ''}`).join(', ')}.${inv.rentalCost ? ` Renting the gap costs about ${UI.money(inv.rentalCost)}.` : ''}`, 'equipment']);
      }
      if (lows.length) needs.push(['warn', 'box', `Running close on ${[...new Set(lows.map((a) => a.item))].join(', ')}.`, 'equipment']);
      if (!sched && reqs.length) needs.push(['warn', 'grid', `No schedule yet. ${UI.plural(reqs.length, 'shift')} (${Math.round(reqHrs)} staff-hours) need coverage.`, 'schedule']);
      const errs = issues.filter((i) => i.level === 'error');
      errs.slice(0, 3).forEach((i) => needs.push(['bad', 'grid', i.text, 'schedule']));
      if (errs.length > 3) needs.push(['bad', 'grid', `${errs.length - 3} more schedule problems.`, 'schedule']);
      const rev = evs.filter((e) => e.review);
      rev.slice(0, 3).forEach((e) => needs.push(['warn', 'file', `Check ${e.name} (${UI.roomName(e.roomId)}, ${U.fmtDay(e.date)}): ${e.review}`, 'ev:' + e.id]));
      if (rev.length > 3) needs.push(['warn', 'file', `${rev.length - 3} more imported events to check.`, 'events']);

      const todayIso = U.today();
      const showDates = UI.filter.day ? [UI.filter.day] : dates;
      const days = showDates.map((d) => {
        const list = shown.filter((e) => e.date === d);
        const crew = sched ? [...new Set(sched.shifts.filter((x) => x.date === d && x.staffId).map((x) => x.staffId))] : [];
        return `<div class="day ${d === todayIso ? 'today' : ''} ${list.length ? '' : 'quiet'}">
          <div class="dh"><span class="dn">${U.parseDate(d).getDate()}</span><span class="dw">${U.DOW[U.dow(d)]}</span>
            <button class="btn ghost icon xs add noprint" data-act="ev-new" data-date="${d}" title="Add event on ${U.fmtDay(d)}">${ic('plus', 'sm')}</button></div>
          <div class="list">${list.length ? list.map((e) => UI.eventCard(e, sched)).join('') : `<div class="none">${UI.filterActive() ? 'No matching events' : 'No events'}</div>`}
          ${crew.length && list.length ? `<div class="tiny muted" style="margin-top:2px">Working: ${crew.map((id) => esc((Store.staffById(id) || { name: '?' }).name.split(' ')[0])).join(', ')}</div>` : ''}</div></div>`;
      }).join('');

      const statusV = !reqs.length ? '—' : sched ? (issues.some((i) => i.level === 'error') ? 'Needs work' : 'Covered') : 'Not built';
      const statusCls = !reqs.length ? '' : sched ? (issues.some((i) => i.level === 'error') ? 'bad' : 'ok') : 'warn';
      const statusS = !reqs.length ? 'No AV events this week' : sched ? `${esc(sched.optionName || 'Custom')} · ${sched.shifts.filter((x) => x.staffId).length}/${sched.shifts.length} shifts filled` : `${UI.plural(reqs.length, 'shift')} to fill`;

      return top + `
        <div class="stats">
          ${stat('Events', evs.length, `${evs.filter((e) => IH.Sched.needsAV(e)).length} need AV`, 'info')}
          ${stat('Staffing', statusV, statusS, statusCls)}
          ${stat('Equipment', shorts.length ? shorts.length + ' short' : lows.length ? lows.length + ' tight' : 'Fine', shorts.length ? `Rentals about ${UI.money(inv.rentalCost)}` : lows.length ? 'Running close to stock' : 'Stock covers this week', shorts.length ? 'bad' : lows.length ? 'warn' : 'ok')}
          ${stat('In-room tech billing', bill.total ? UI.money(bill.total) : '—', bill.total ? `${Math.round(bill.hours * 10) / 10} tech-hours at ${UI.money(st.settings.techRate)}/hr` : 'No in-room tech booked', 'info')}
        </div>
        ${needs.length ? `<div class="col" style="gap:8px;margin-bottom:20px">${needs.map(([lv, i, t, go]) => `<div class="callout ${lv}">${ic(i)}<div class="grow">${esc(t)}</div><button class="btn xs" data-act="${go.startsWith('ev:') ? 'ev-edit' : 'go'}" data-id="${go.slice(3)}" data-view="${go}">${go.startsWith('ev:') ? 'Open' : 'Open'}</button></div>`).join('')}</div>` : ''}
        ${UI.filterBar({ days: 'week', info: UI.filterActive() ? `Showing ${shown.length} of ${evs.length} events` : '' })}
        <div class="board ${UI.filter.day ? 'one' : ''}">${days}</div>
        <div class="row wrap noprint" style="margin-top:22px">
          <button class="btn" data-act="week-pptx">${ic('deck', 'sm')} Export this week to PowerPoint</button>
          <button class="btn" data-act="go" data-view="signs">${ic('image', 'sm')} Room signs</button>
          <span class="muted small">Tip: click any event to edit it. Hover a day and press + to add one.</span>
        </div>`;
    },
  };

  UI.Acts['gen-go'] = () => { UI.go('schedule'); };
  UI.Acts['load-sample'] = () => { Store.loadSample(); UI.setWeek('2026-09-17'); UI.toast('Sample week loaded', 'ok'); };
  UI.Acts['start-fresh'] = () => { Store.update((s) => { s.meta.firstRun = false; }); UI.go('equipment'); };
})(typeof window !== 'undefined' ? window : globalThis);
