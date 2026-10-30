import { useEffect, useState } from 'react';

// Same key and values as the switching guides (and the site's tema.js): one choice for the whole website.
const KEY = 'switching-manual:theme';
const THEMES = ['system', 'light', 'dark'] as const;
type Theme = typeof THEMES[number];
const LABELS: Record<Theme, string> = { system: 'Sistema', light: 'Claro', dark: 'Oscuro' };

function readTheme(): Theme {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '"system"');
    return THEMES.includes(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Cycles system → light → dark; "system" leaves the colours to prefers-color-scheme. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, JSON.stringify(theme)); } catch { /* blocked storage: the choice lasts this visit */ }
  }, [theme]);

  return (
    <button type="button" className="theme-toggle" aria-label={`Tema: ${LABELS[theme]}. Cambiar a ${LABELS[next]}`} onClick={() => setTheme(next)}>
      Tema: {LABELS[theme]}
    </button>
  );
}
