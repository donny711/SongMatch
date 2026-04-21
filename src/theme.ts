// ── SongMatch Brand Colors ────────────────────────────────────────────────────

export const COLORS = {
  // Backgrounds
  bg:       '#0D0D0D',              // bgPrimary  — main dark bg
  surface:  'rgba(31,31,40,0.80)',  // bgSurface  — cards / sheets
  surface2: 'rgba(31,31,40,0.95)',  // bgSurface elevated
  border:   'rgba(167,139,250,0.14)', // purplePrimary tinted border

  // Text
  text:      '#FFFFFF',              // textPrimary
  textSub:   '#C4B5FD',              // purpleMuted  — secondary labels
  textMuted: '#6B7280',              // textMuted    — gray-500

  // Accents — like/positive (purple-primary)
  green:    '#A78BFA',
  greenDim: '#7C3AED',

  // Accents — skip/negative
  pink:   '#C96A6A',
  pinkBg: 'rgba(201,106,106,0.12)',

  // Core palette
  purple:      '#A78BFA',  // purplePrimary — Purple 400
  purpleDim:   '#7C3AED',  // purpleDark    — Purple 600
  purpleDeep:  '#4C1D95',  // purpleDeep    — Purple 900
  purpleSurf:  '#1E0A3C',  // purpleSurface — deep purple surface
  purpleTint:  '#EDE9FE',  // purpleTint    — Purple 50
  cyan:        '#C4B5FD',  // purpleMuted   — Purple 300
  fuchsia:     '#E879F9',  // fuchsiaPop    — special highlights
  orange:      '#FDBA74',  // amber-300 — streak / warm accent
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const SHADOW = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.65,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
  btn: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
};

// Subtle depth shadows
export const GLOW = {
  green: {
    shadowColor: '#A78BFA',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  pink: {
    shadowColor: '#C96A6A',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  purple: {
    shadowColor: '#A78BFA',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
};
