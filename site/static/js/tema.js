// Theme for the site: applied before the first paint (this file loads in <head>) and switched with the header button.
// Same key and values as the app and the switching guides, so one choice applies to the whole website.
// An external file keeps the CSP (no inline scripts).
(function () {
  var KEY = 'switching-manual:theme';
  var THEMES = ['system', 'light', 'dark'];
  var LABELS = { system: 'Sistema', light: 'Claro', dark: 'Oscuro' };
  var root = document.documentElement;

  function read() {
    try {
      var theme = JSON.parse(localStorage.getItem(KEY));
      return THEMES.indexOf(theme) >= 0 ? theme : 'system';
    } catch (e) {
      return 'system';
    }
  }

  function apply(theme) {
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }

  function label(button, theme) {
    var next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    button.textContent = 'Tema: ' + LABELS[theme];
    button.setAttribute('aria-label', 'Tema: ' + LABELS[theme] + '. Cambiar a ' + LABELS[next]);
  }

  var theme = read();
  apply(theme);

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.querySelector('[data-theme-toggle]');
    if (!button) return;
    button.hidden = false;
    label(button, theme);
    button.addEventListener('click', function () {
      theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
      apply(theme);
      label(button, theme);
      try { localStorage.setItem(KEY, JSON.stringify(theme)); } catch (e) { /* blocked storage: lasts this visit */ }
    });
  });
})();
