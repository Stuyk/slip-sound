import { WorkstationTheme } from './types';

export const FUSION_360_THEME: WorkstationTheme = {
  id: 'cad',
  name: 'Fusion 360 / SolidWorks',
  tagline: 'Parametric Mechanical CAD',
  type: 'cad',
  font: 'Inter',
  desc: 'High-precision engineering workstation with blueprint dimension blue.',
  uiSize: '12px',
  uiRadius: '3px',
  className: 'style-cad',
  colors: {
    bgMain: '#2b2d30',
    bgPanel: '#32353a',
    bgPanelHeader: '#26282b',
    bgInput: '#1e2022',
    accent: '#007acc',
    accentText: '#ffffff',
    border: '#1c1d1f',
    textMain: '#f0f3f6',
    textMuted: '#8b949e',
  },
};

export const WORKSTATION_THEMES: WorkstationTheme[] = [FUSION_360_THEME];

