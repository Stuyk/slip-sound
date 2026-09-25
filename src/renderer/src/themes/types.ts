export type WorkstationCategory = '3d' | 'node' | 'vector' | 'audio' | 'cad' | 'telemetry';

export interface ThemeColors {
  bgMain: string;
  bgPanel: string;
  bgPanelHeader: string;
  bgInput: string;
  border: string;
  accent: string;
  accentText: string;
  textMain: string;
  textMuted: string;
}

export interface WorkstationTheme {
  id: string;
  name: string;
  tagline: string;
  type: WorkstationCategory;
  font: string;
  desc: string;
  uiSize: string;
  uiRadius: string;
  colors: ThemeColors;
  className?: string;
}

export interface ThemeContextValue {
  theme: () => WorkstationTheme;
  setThemeId: (id: string) => void;
  availableThemes: WorkstationTheme[];
  cssVars: () => Record<string, string>;
  activeCategory: () => WorkstationCategory;
  setActiveCategory: (cat: WorkstationCategory) => void;
}
