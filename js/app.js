/* iHotel AV Scheduler — boot */
(function (root) {
  const IH = root.IH, UI = IH.UI, Store = IH.Store;
  function route() {
    const v = (location.hash.replace(/^#\/?/, '') || 'week').split(/[?/]/)[0];
    UI.view = UI.Views[v] ? v : 'week';
  }
  window.addEventListener('hashchange', () => { route(); UI.render(); });
  window.addEventListener('DOMContentLoaded', () => {
    Store.load();
    Store.onChange(() => UI.render());
    route();
    UI.weekKey = UI.defaultWeek();
    UI.render();
    if (IH.Cloud) IH.Cloud.init();
  });
  // warn before closing while a PDF import or export is running is overkill; data autosaves on every change.
})(window);
