export interface RankDefinition {
  id: string;
  name: string;
  label: string;
  minLikes: number;
  color: string;
  labelColor: string;
  bgTint: string;
  timeEstimate: string;
}

export const RANKS: RankDefinition[] = [
  // ── Silver ─────────────────────────────────────────────────────────────
  { id: 'silver_1', name: 'Silver I',    label: 'SILVER · I',    minLikes: 0,     color: '#94a3b8', labelColor: '#cbd5e1', bgTint: '#1e293b', timeEstimate: 'Starting rank' },
  { id: 'silver_2', name: 'Silver II',   label: 'SILVER · II',   minLikes: 250,   color: '#94a3b8', labelColor: '#cbd5e1', bgTint: '#1e293b', timeEstimate: '~1 month'      },
  { id: 'silver_3', name: 'Silver III',  label: 'SILVER · III',  minLikes: 500,   color: '#94a3b8', labelColor: '#cbd5e1', bgTint: '#1e293b', timeEstimate: '~2 months'     },
  { id: 'silver_4', name: 'Silver IV',   label: 'SILVER · IV',   minLikes: 750,   color: '#94a3b8', labelColor: '#cbd5e1', bgTint: '#1e293b', timeEstimate: '~3 months'     },
  // ── Gold ───────────────────────────────────────────────────────────────
  { id: 'gold_1',   name: 'Gold I',      label: 'GOLD · I',      minLikes: 1000,  color: '#fbbf24', labelColor: '#fcd34d', bgTint: '#451a03', timeEstimate: '~4 months'     },
  { id: 'gold_2',   name: 'Gold II',     label: 'GOLD · II',     minLikes: 2500,  color: '#fbbf24', labelColor: '#fcd34d', bgTint: '#451a03', timeEstimate: '~6 months'     },
  { id: 'gold_3',   name: 'Gold III',    label: 'GOLD · III',    minLikes: 5000,  color: '#fbbf24', labelColor: '#fcd34d', bgTint: '#451a03', timeEstimate: '~8 months'     },
  { id: 'gold_4',   name: 'Gold IV',     label: 'GOLD · IV',     minLikes: 7500,  color: '#fbbf24', labelColor: '#fcd34d', bgTint: '#451a03', timeEstimate: '~10 months'    },
  // ── Diamond ────────────────────────────────────────────────────────────
  { id: 'diamond_1', name: 'Diamond I',   label: 'DIAMOND · I',   minLikes: 10000, color: '#38bdf8', labelColor: '#7dd3fc', bgTint: '#0c2340', timeEstimate: '~1 year'       },
  { id: 'diamond_2', name: 'Diamond II',  label: 'DIAMOND · II',  minLikes: 15000, color: '#38bdf8', labelColor: '#7dd3fc', bgTint: '#0c2340', timeEstimate: '~1.5 years'    },
  { id: 'diamond_3', name: 'Diamond III', label: 'DIAMOND · III', minLikes: 20000, color: '#38bdf8', labelColor: '#7dd3fc', bgTint: '#0c2340', timeEstimate: '~2 years'      },
  { id: 'diamond_4', name: 'Diamond IV',  label: 'DIAMOND · IV',  minLikes: 30000, color: '#38bdf8', labelColor: '#7dd3fc', bgTint: '#0c2340', timeEstimate: '~3 years'      },
  // ── Legend ─────────────────────────────────────────────────────────────
  { id: 'legend_1',  name: 'Legend I',    label: 'LEGEND · I',    minLikes: 40000, color: '#a78bfa', labelColor: '#c4b5fd', bgTint: '#1e0a3c', timeEstimate: '~4 years'      },
  { id: 'legend_2',  name: 'Legend II',   label: 'LEGEND · II',   minLikes: 50000, color: '#a78bfa', labelColor: '#c4b5fd', bgTint: '#1e0a3c', timeEstimate: '~5 years'      },
  { id: 'legend_3',  name: 'Legend III',  label: 'LEGEND · III',  minLikes: 65000, color: '#a78bfa', labelColor: '#c4b5fd', bgTint: '#1e0a3c', timeEstimate: '~6 years'      },
  { id: 'legend_4',  name: 'Legend IV',   label: 'LEGEND · IV',   minLikes: 80000, color: '#a78bfa', labelColor: '#c4b5fd', bgTint: '#1e0a3c', timeEstimate: 'Top 0.1%'      },
];

export function getRankForLikes(likedCount: number): RankDefinition {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (likedCount >= r.minLikes) rank = r;
    else break;
  }
  return rank;
}

export function getNextRank(current: RankDefinition): RankDefinition | null {
  const idx = RANKS.findIndex((r) => r.id === current.id);
  return idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
}

export function getProgressToNext(likedCount: number): number {
  const current = getRankForLikes(likedCount);
  const next = getNextRank(current);
  if (!next) return 1;
  const range = next.minLikes - current.minLikes;
  const progress = likedCount - current.minLikes;
  return Math.min(progress / range, 1);
}
