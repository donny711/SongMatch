export const ICON_CATEGORIES = ['Default', 'Neon', 'Gradient', 'Solid', 'Gold', 'Pastel'] as const;
export type IconCategory = typeof ICON_CATEGORIES[number];

export interface AppIconDef {
  id: string;
  name: string;
  category: IconCategory;
  tag: string;
  tagColor: string;
  tagBg: string;
  bgColors: string[];
  barGradStart: string;
  barGradEnd: string;
  barGradEndOpacity: number;
  opacities: [number, number, number, number, number];
  innerBorder?: string;
  pro: boolean;
}

export const APP_ICONS: AppIconDef[] = [
  // Default
  { id: 'dark_purple',   name: 'Dark Purple',    category: 'Default', tag: 'DEFAULT',  tagColor: '#a78bfa', tagBg: '#1a0a2e',   bgColors: ['#0d0d0d'],            barGradStart: '#a78bfa', barGradEnd: '#7c3aed', barGradEndOpacity: 0.35, opacities: [0.35, 0.65, 1.0, 0.65, 0.35], pro: false },
  { id: 'warm_light',    name: 'Warm Light',     category: 'Default', tag: 'LIGHT',    tagColor: '#7c3aed', tagBg: '#f0e8d8',   bgColors: ['#f5f0ea'],            barGradStart: '#7c3aed', barGradEnd: '#a78bfa', barGradEndOpacity: 0.30, opacities: [0.30, 0.60, 1.0, 0.60, 0.30], pro: true  },
  // Neon
  { id: 'neon_green',    name: 'Neon Green',     category: 'Neon',    tag: 'NEON',     tagColor: '#00ff87', tagBg: '#001a0d',   bgColors: ['#050505'],            barGradStart: '#00ff87', barGradEnd: '#00cc6a', barGradEndOpacity: 0.40, opacities: [0.25, 0.55, 1.0, 0.55, 0.25], pro: true  },
  { id: 'neon_pink',     name: 'Neon Pink',      category: 'Neon',    tag: 'NEON',     tagColor: '#ff0080', tagBg: '#1a0010',   bgColors: ['#050505'],            barGradStart: '#ff0080', barGradEnd: '#cc0066', barGradEndOpacity: 0.40, opacities: [0.25, 0.55, 1.0, 0.55, 0.25], pro: true  },
  { id: 'neon_cyan',     name: 'Neon Cyan',      category: 'Neon',    tag: 'NEON',     tagColor: '#00d4ff', tagBg: '#001a20',   bgColors: ['#020b0f'],            barGradStart: '#00d4ff', barGradEnd: '#0099cc', barGradEndOpacity: 0.40, opacities: [0.25, 0.55, 1.0, 0.55, 0.25], pro: true  },
  { id: 'neon_orange',   name: 'Neon Orange',    category: 'Neon',    tag: 'NEON',     tagColor: '#ff6b00', tagBg: '#1a0a00',   bgColors: ['#050200'],            barGradStart: '#ff6b00', barGradEnd: '#cc5500', barGradEndOpacity: 0.40, opacities: [0.25, 0.55, 1.0, 0.55, 0.25], pro: true  },
  // Gradient
  { id: 'indigo_violet', name: 'Indigo Violet',  category: 'Gradient',tag: 'GRADIENT', tagColor: '#667eea', tagBg: '#667eea22', bgColors: ['#667eea','#764ba2'],  barGradStart: '#ffffff', barGradEnd: '#ffffff', barGradEndOpacity: 0.40, opacities: [0.30, 0.60, 1.0, 0.60, 0.30], pro: true  },
  { id: 'pink_coral',    name: 'Pink Coral',     category: 'Gradient',tag: 'GRADIENT', tagColor: '#f5576c', tagBg: '#f093fb22', bgColors: ['#f093fb','#f5576c'],  barGradStart: '#ffffff', barGradEnd: '#ffffff', barGradEndOpacity: 0.40, opacities: [0.30, 0.60, 1.0, 0.60, 0.30], pro: true  },
  { id: 'ocean_blue',    name: 'Ocean Blue',     category: 'Gradient',tag: 'GRADIENT', tagColor: '#4facfe', tagBg: '#4facfe22', bgColors: ['#4facfe','#00f2fe'],  barGradStart: '#ffffff', barGradEnd: '#ffffff', barGradEndOpacity: 0.40, opacities: [0.30, 0.60, 1.0, 0.60, 0.30], pro: true  },
  { id: 'mint_teal',     name: 'Mint Teal',      category: 'Gradient',tag: 'GRADIENT', tagColor: '#1a8a4a', tagBg: '#43e97b22', bgColors: ['#43e97b','#38f9d7'],  barGradStart: '#ffffff', barGradEnd: '#ffffff', barGradEndOpacity: 0.40, opacities: [0.30, 0.60, 1.0, 0.60, 0.30], pro: true  },
  // Solid
  { id: 'stealth_black',     name: 'Stealth Black',     category: 'Solid', tag: 'SOLID', tagColor: '#888888', tagBg: '#1a1a1a',   bgColors: ['#111111'],            barGradStart: '#ffffff', barGradEnd: '#ffffff', barGradEndOpacity: 0.40, opacities: [0.25, 0.55, 1.0, 0.55, 0.25], pro: true  },
  { id: 'pure_white',        name: 'Pure White',        category: 'Solid', tag: 'SOLID', tagColor: '#444444', tagBg: '#f0f0f0',   bgColors: ['#ffffff'],            barGradStart: '#111111', barGradEnd: '#111111', barGradEndOpacity: 0.40, opacities: [0.25, 0.55, 1.0, 0.55, 0.25], pro: true  },
  { id: 'grape_solid',       name: 'Grape Solid',       category: 'Solid', tag: 'SOLID', tagColor: '#5b21b6', tagBg: '#3b0f8a22', bgColors: ['#5b21b6'],            barGradStart: '#ffffff', barGradEnd: '#e0d0ff', barGradEndOpacity: 0.50, opacities: [0.30, 0.60, 1.0, 0.60, 0.30], pro: true  },
  { id: 'midnight_navy',     name: 'Midnight Navy',     category: 'Solid', tag: 'SOLID', tagColor: '#6666aa', tagBg: '#0d0d1a',   bgColors: ['#1a1a2e'],            barGradStart: '#ffffff', barGradEnd: '#ffffff', barGradEndOpacity: 0.40, opacities: [0.20, 0.45, 0.85, 0.45, 0.20], pro: true  },
  // Gold
  { id: 'gold_black',        name: 'Gold on Black',     category: 'Gold',  tag: 'GOLD',  tagColor: '#ffd700', tagBg: '#1a1200',   bgColors: ['#1a1200','#0d0a00'],  barGradStart: '#ffd700', barGradEnd: '#b8860b', barGradEndOpacity: 0.50, opacities: [0.30, 0.60, 1.0, 0.60, 0.30], pro: true  },
  { id: 'all_gold',          name: 'All Gold',          category: 'Gold',  tag: 'GOLD',  tagColor: '#b8860b', tagBg: '#ffd70022', bgColors: ['#ffd700','#b8860b'],  barGradStart: '#1a0a00', barGradEnd: '#0d0500', barGradEndOpacity: 0.60, opacities: [0.30, 0.60, 1.0, 0.60, 0.30], pro: true  },
  { id: 'chrome_silver',     name: 'Chrome Silver',     category: 'Gold',  tag: 'GOLD',  tagColor: '#555555', tagBg: '#80808022', bgColors: ['#c0c0c0','#808080'],  barGradStart: '#111111', barGradEnd: '#222222', barGradEndOpacity: 0.60, opacities: [0.30, 0.60, 1.0, 0.60, 0.30], pro: true  },
  { id: 'black_gold_border', name: 'Black Gold Border', category: 'Gold',  tag: 'GOLD',  tagColor: '#ffd700', tagBg: '#1a1200',   bgColors: ['#0d0d0d','#1a1a1a'],  barGradStart: '#ffd700', barGradEnd: '#b8860b', barGradEndOpacity: 0.30, opacities: [0.30, 0.60, 1.0, 0.60, 0.30], innerBorder: '#ffd700', pro: true  },
  // Pastel
  { id: 'lavender',          name: 'Lavender',          category: 'Pastel',tag: 'PASTEL',tagColor: '#7c3aed', tagBg: '#ede9fe',   bgColors: ['#ede9fe'],            barGradStart: '#7c3aed', barGradEnd: '#a78bfa', barGradEndOpacity: 0.40, opacities: [0.30, 0.60, 1.0, 0.60, 0.30], pro: true  },
  { id: 'baby_pink',         name: 'Baby Pink',         category: 'Pastel',tag: 'PASTEL',tagColor: '#be185d', tagBg: '#fce7f3',   bgColors: ['#fce7f3'],            barGradStart: '#be185d', barGradEnd: '#db2777', barGradEndOpacity: 0.40, opacities: [0.30, 0.60, 1.0, 0.60, 0.30], pro: true  },
  { id: 'sage_green',        name: 'Sage Green',        category: 'Pastel',tag: 'PASTEL',tagColor: '#065f46', tagBg: '#d1fae5',   bgColors: ['#d1fae5'],            barGradStart: '#065f46', barGradEnd: '#059669', barGradEndOpacity: 0.40, opacities: [0.30, 0.60, 1.0, 0.60, 0.30], pro: true  },
  { id: 'butter_yellow',     name: 'Butter Yellow',     category: 'Pastel',tag: 'PASTEL',tagColor: '#92400e', tagBg: '#fef3c7',   bgColors: ['#fef3c7'],            barGradStart: '#92400e', barGradEnd: '#d97706', barGradEndOpacity: 0.40, opacities: [0.30, 0.60, 1.0, 0.60, 0.30], pro: true  },
];
