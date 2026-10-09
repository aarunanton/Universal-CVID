/* Shared behaviour for the public pages (homepage, privacy): light/dark switch. */
(function () {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action="theme"]');
    if (!btn) return;
    var root = document.documentElement;
    var dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('ucvid:theme', root.dataset.theme); } catch (_) {}
  });
})();
