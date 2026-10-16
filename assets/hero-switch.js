/* Homepage: switch the hero between the CV checker and the CV builder */
(function () { // hero tool switch: CV checker | CV builder
  var hero = document.getElementById('heroTools'); if (!hero) return;
  var tabs = hero.querySelectorAll('.h-switch [role="tab"]');
  function pick(tool, focus) {
    hero.setAttribute('data-tool', tool);
    tabs.forEach(function (t) { var on = t.getAttribute('data-tool') === tool; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); document.getElementById(t.getAttribute('aria-controls')).hidden = !on; });
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { pick(t.getAttribute('data-tool')); });
    t.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); pick(t.getAttribute('data-tool') === 'check' ? 'build' : 'check', true); } });
  });
  if (location.hash === '#builder') pick('build');
})();
