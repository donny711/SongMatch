/**
 * Canonical genre → representative artist mapping used in onboarding seeding
 * and taste-engine genre-shift mode. Kept here so both layers share the same data.
 */
export const GENRE_ARTISTS: Record<string, string[]> = {
  'Pop':         ['Taylor Swift', 'Ed Sheeran', 'Dua Lipa'],
  'Rock':        ['Arctic Monkeys', 'Foo Fighters', 'The Killers'],
  'Hip-Hop':     ['Kendrick Lamar', 'Drake', 'J. Cole'],
  'Electronic':  ['Daft Punk', 'Calvin Harris', 'Disclosure'],
  'R&B / Soul':  ['The Weeknd', 'Frank Ocean', 'SZA'],
  'Indie':       ['Tame Impala', 'Vampire Weekend', 'Bon Iver'],
  'Metal':       ['Metallica', 'System of a Down', 'Tool'],
  'Jazz':        ['Miles Davis', 'John Coltrane', 'Herbie Hancock'],
  'Country':     ['Morgan Wallen', 'Chris Stapleton', 'Luke Combs'],
  'Latin':       ['Bad Bunny', 'J Balvin', 'Maluma'],
  'Classical':   ['Ludovico Einaudi', 'Hans Zimmer', 'Max Richter'],
  'Reggae':      ['Bob Marley', 'Damian Marley', 'Chronixx'],
  'Dance':       ['Calvin Harris', 'Kygo', 'Martin Garrix'],
  'Blues':       ['B.B. King', 'Eric Clapton', 'Gary Clark Jr.'],
};

export const GENRES = Object.keys(GENRE_ARTISTS);

export const GENRE_COLORS: Record<string, string> = {
  'Pop':        '#EC4899',
  'Rock':       '#EF4444',
  'Hip-Hop':    '#F59E0B',
  'Electronic': '#22D3EE',
  'R&B / Soul': '#A855F7',
  'Indie':      '#84CC16',
  'Metal':      '#94A3B8',
  'Jazz':       '#F97316',
  'Country':    '#D97706',
  'Latin':      '#F43F5E',
  'Classical':  '#60A5FA',
  'Reggae':     '#22C55E',
  'Dance':      '#8B5CF6',
  'Blues':      '#3B82F6',
};
