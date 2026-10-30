// Applies the saved theme before the first paint, so a dark choice does not flash light.
// Same key and values as the switching guides and the site; an external file keeps the CSP (script-src 'self').
(function () {
  try {
    var theme = JSON.parse(localStorage.getItem('switching-manual:theme'));
    if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
  } catch (e) { /* no saved choice or blocked storage: follow the system */ }
})();
