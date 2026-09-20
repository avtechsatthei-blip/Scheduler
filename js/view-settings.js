/* Settings: scheduling rules, billing, sign defaults, backup/restore */
(function (root) {
  const IH = root.IH, U = IH.U, UI = IH.UI, Store = IH.Store;
  const { esc, icon: ic } = UI;

  const num = (key, label, hint, min, max, step) => {
    const v = Store.state.settings[key];
    return UI.field(label, `<input class="in" type="number" min="${min}" max="${max}" step="${step || 1}" value="${v}" data-change="set" data-key="${key}" data-kind="num">`, hint);
  };

  UI.Views.settings = {
    title: 'Settings',
    render() {
      const s = Store.state.settings;
      const last = Store.state.meta.lastBackup;
      return UI.pageTop('Settings', 'Rules, defaults and backup') + `
      <div class="col" style="gap:20px;max-width:900px">
        <div class="card pad"><h3>Scheduling rules</h3><div class="small muted" style="margin:4px 0 14px">Every schedule option follows these as hard rules. Changing one changes what can be built, so rebuild the week afterward.</div>
          <div class="form-grid">
            <div class="span-4">${num('minDayHrs', 'Shortest shift (hours)', 'Shorter needs are padded to this', 1, 12, 0.5)}</div>
            <div class="span-4">${num('maxDayHrs', 'Longest shift (hours)', 'Longer days are split between people', 4, 16, 0.5)}</div>
            <div class="span-4">${num('minRestHrs', 'Rest between shifts (hours)', 'Stops a close followed by an early open', 0, 24, 0.5)}</div>
            <div class="span-4">${num('bufferBeforeMin', 'Arrive before events (min)', 'Setup and sound check time', 0, 240, 5)}</div>
            <div class="span-4">${num('bufferAfterMin', 'Stay after events (min)', 'Strike and reset time', 0, 240, 5)}</div>
            <div class="span-4">${num('bridgeGapHrs', 'One person covers two events if the gap is at most (hours)', '', 0, 8, 0.5)}</div>
            <div class="span-4">${num('baseCrew', 'People covering the rooms each AV day', 'On top of in-room techs', 1, 5)}</div>
            <div class="span-4">${num('handoffMin', 'Overlap when a long day is split (min)', 'Time two people overlap at handoff', 0, 120, 5)}</div>
            <div class="span-4">${num('maxWeekHrs', 'Default weekly maximum (hours)', 'Used when a person has no maximum of their own', 1, 80)}</div>
            <div class="span-4">${num('overtimeHrs', 'Try to stay under (hours a week)', 'A soft limit, e.g. overtime', 1, 80)}</div>
            <div class="span-4">${UI.field('Week starts on', `<select class="in" data-change="set" data-key="weekStart" data-kind="num">${UI.opt(1, 'Monday', s.weekStart === 1)}${UI.opt(0, 'Sunday', s.weekStart === 0)}</select>`, 'Saved schedules are tied to the week start')}</div>
          </div></div>
        <div class="card pad"><h3>Equipment and billing</h3><div class="form-grid" style="margin-top:12px">
          <div class="span-4">${num('lowStockPct', 'Warn when this much is in use (%)', 'Below your total, but getting close', 30, 100)}</div>
          <div class="span-4">${num('techRate', 'In-room tech rate ($ per hour)', 'For the billing estimate', 0, 500)}</div>
          <div class="span-4">${num('techMinBillHrs', 'In-room tech minimum (hours)', 'Billed even if the event is shorter', 0, 12, 0.5)}</div></div></div>
        <div class="card pad"><h3>Defaults</h3><div class="form-grid" style="margin-top:12px">
          <div class="span-3 keep-half">${UI.field('New event starts', `<input class="in" type="time" value="${s.defaultStart}" data-change="set" data-key="defaultStart" data-kind="str">`, 'Also used when a PDF has no times')}</div>
          <div class="span-3 keep-half">${UI.field('New event ends', `<input class="in" type="time" value="${s.defaultEnd}" data-change="set" data-key="defaultEnd" data-kind="str">`)}</div>
          <div class="span-4">${UI.field('Room sign style', `<select class="in" data-change="set" data-key="signTheme" data-kind="str">${Object.entries(IH.Sign.THEMES).map(([k, t]) => UI.opt(k, t.label, s.signTheme === k)).join('')}</select>`)}</div>
          <div class="span-2" style="align-self:end"><label class="check"><input type="checkbox" ${s.signShowDate ? 'checked' : ''} data-change="set" data-key="signShowDate" data-kind="bool"> Date on signs</label></div></div></div>
        <div class="card pad"><h3>Your data</h3>
          <p class="muted small" style="margin:6px 0 12px">Everything is saved in this browser only. Clearing site data or switching computers loses it, so download a backup now and then. ${last ? `Last backup: ${esc(new Date(last).toLocaleString())}.` : '<b>You haven\'t made a backup yet.</b>'}</p>
          <div class="row wrap"><button class="btn navy" data-act="backup-dl">${ic('download', 'sm')} Download backup</button>
            <label class="btn">${ic('upload', 'sm')} Restore from backup<input type="file" accept="application/json,.json" data-change="backup-load" hidden></label>
            <button class="btn" data-act="load-sample-now">${ic('sparkle', 'sm')} Load sample week</button>
            <button class="btn danger" data-act="reset-all">${ic('trash', 'sm')} Erase everything</button></div></div>
      </div>`;
    },
  };

  UI.Changes.set = (el) => {
    const k = el.dataset.key;
    let v = el.dataset.kind === 'bool' ? el.checked : el.dataset.kind === 'num' ? +el.value : el.value;
    if (el.dataset.kind === 'num' && (isNaN(v) || el.value === '')) { UI.toast('Enter a number', 'bad'); UI.rerender(); return; }
    Store.state.settings[k] = v;
    Store.save();
    UI.renderChrome();
    if (k === 'weekStart') { UI.weekKey = Store.weekKeyFor(UI.weekKey); UI.toast('Week start changed. Saved schedules from before stay under their old weeks.'); UI.rerender(); }
    else UI.toast('Saved', 'ok');
  };
  UI.Acts['backup-dl'] = () => {
    Store.update((s) => { s.meta.lastBackup = Date.now(); });
    U.download(new Blob([Store.exportJSON()], { type: 'application/json' }), `ihotel-av-scheduler-backup_${U.today()}.json`);
    UI.toast('Backup downloaded', 'ok');
  };
  UI.Changes['backup-load'] = (el) => {
    const f = el.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = async () => {
      try {
        const parsed = JSON.parse(r.result);
        if (!parsed || !Array.isArray(parsed.events)) throw new Error('This file is not an iHotel scheduler backup.');
        if (!(await UI.confirm({ title: 'Replace everything with this backup?', message: `This file has ${UI.plural(parsed.events.length, 'event')} and ${UI.plural((parsed.staff || []).length, 'staff member')}. Your current data will be replaced.`, ok: 'Restore', danger: true }))) return;
        Store.importJSON(r.result);
        UI.weekKey = UI.defaultWeek();
        UI.toast('Backup restored', 'ok');
      } catch (e) { UI.toast(e.message || 'Could not read that file', 'bad'); }
    };
    r.readAsText(f);
    el.value = '';
  };
  UI.Acts['load-sample-now'] = async () => {
    if (await UI.confirm({ title: 'Load the sample week?', message: 'This replaces your staff, events, rooms, inventory and schedules with demo data.', ok: 'Load sample', danger: true })) { Store.loadSample(); UI.go('week'); UI.setWeek('2026-09-17'); }
  };
  UI.Acts['reset-all'] = async () => {
    if (await UI.confirm({ title: 'Erase everything?', message: 'Staff, events, rooms, inventory and schedules are all deleted. Download a backup first if you might want them back.', ok: 'Erase everything', danger: true })) { Store.reset(); UI.mem.sched.options = {}; UI.weekKey = UI.thisWeek(); UI.go('week'); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
