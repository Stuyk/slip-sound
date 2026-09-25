import { createContext, useContext, createSignal, createMemo, createEffect, JSX } from 'solid-js';
import { WorkstationCategory, WorkstationTheme, ThemeContextValue } from './types';
import { WORKSTATION_THEMES } from './definitions';

const THEME_STORAGE_KEY = 'slipsound:theme';

const ThemeContext = createContext<ThemeContextValue>();

export function ThemeProvider(props: { children: JSX.Element }) {
  const initialTheme = () => 'cad';

  const [themeId, setThemeIdRaw] = createSignal<string>(initialTheme());

  const setThemeId = (id: string) => {
    setThemeIdRaw(id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  };

  const theme = createMemo<WorkstationTheme>(() => {
    return WORKSTATION_THEMES.find((t) => t.id === themeId()) || WORKSTATION_THEMES[0];
  });

  const [activeCategory, setActiveCategory] = createSignal<WorkstationCategory>('cad');

  createEffect(() => {
    const currentTheme = theme();
    setActiveCategory(currentTheme.type);
  });

  const cssVars = createMemo(() => {
    const current = theme();
    const c = current.colors;
    return {
      '--bg-main': c.bgMain,
      '--bg-panel': c.bgPanel,
      '--bg-panel-header': c.bgPanelHeader,
      '--bg-input': c.bgInput,
      '--accent-color': c.accent,
      '--accent-text': c.accentText,
      '--border-color': c.border,
      '--text-main': c.textMain,
      '--text-muted': c.textMuted,
      '--ui-size': current.uiSize,
      '--ui-radius': current.uiRadius,
      '--font-main': current.font === 'JetBrains Mono' ? "'JetBrains Mono', monospace" : current.font === 'Titillium Web' ? "'Titillium Web', sans-serif" : "'Inter', sans-serif",
      '--font-mono': "'JetBrains Mono', monospace",
    };
  });

  // Inject CSS variables to documentElement for global consistency
  createEffect(() => {
    const vars = cssVars();
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });

    // Also update theme class on body
    const allThemeClasses = WORKSTATION_THEMES.map((t) => t.className).filter(Boolean) as string[];
    allThemeClasses.forEach((cls) => document.body.classList.remove(cls));
    const currentCls = theme().className;
    if (currentCls) {
      document.body.classList.add(currentCls);
    }
  });

  const value: ThemeContextValue = {
    theme,
    setThemeId,
    availableThemes: WORKSTATION_THEMES,
    cssVars,
    activeCategory,
    setActiveCategory,
  };

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
