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
  { id: 'silver_1', name: 'Silver I',    label: 'SILVER · I',    minLikes: 0,    color: '#94a3b8', labelColor: '#cbd5e1', bgTint: '#1e293b', timeEstimate: 'Starting rank' },
  { id: 'silver_2', name: 'Silver II',   label: 'SILVER · II',   minLikes: 15,   color: '#94a3b8', labelColor: '#cbd5e1', bgTint: '#1e293b', timeEstimate: '~1 day'        },
  { id: 'silver_3', name: 'Silver III',  label: 'SILVER · III',  minLikes: 40,   color: '#94a3b8', labelColor: '#cbd5e1', bgTint: '#1e293b', timeEstimate: '~3 days'       },
  { id: 'silver_4', name: 'Silver IV',   label: 'SILVER · IV',   minLikes: 70,   color: '#94a3b8', labelColor: '#cbd5e1', bgTint: '#1e293b', timeEstimate: '~5 days'       },
  // ── Gold ───────────────────────────────────────────────────────────────
  { id: 'gold_1',   name: 'Gold I',      label: 'GOLD · I',      minLikes: 100,  color: '#fbbf24', labelColor: '#fcd34d', bgTint: '#451a03', timeEstimate: '~1 week'       },
  { id: 'gold_2',   name: 'Gold II',     label: 'GOLD · II',     minLikes: 135,  color: '#fbbf24', labelColor: '#fcd34d', bgTint: '#451a03', timeEstimate: '~10 days'      },
  { id: 'gold_3',   name: 'Gold III',    label: 'GOLD · III',    minLikes: 175,  color: '#fbbf24', labelColor: '#fcd34d', bgTint: '#451a03', timeEstimate: '~2 weeks'      },
  { id: 'gold_4',   name: 'Gold IV',     label: 'GOLD · IV',     minLikes: 210,  color: '#fbbf24', labelColor: '#fcd34d', bgTint: '#451a03', timeEstimate: '~3 weeks'      },
  // ── Diamond ────────────────────────────────────────────────────────────
  { id: 'diamond_1', name: 'Diamond I',   label: 'DIAMOND · I',   minLikes: 250,  color: '#38bdf8', labelColor: '#7dd3fc', bgTint: '#0c2340', timeEstimate: '~1 month'      },
  { id: 'diamond_2', name: 'Diamond II',  label: 'DIAMOND · II',  minLikes: 310,  color: '#38bdf8', labelColor: '#7dd3fc', bgTint: '#0c2340', timeEstimate: '~5 weeks'      },
  { id: 'diamond_3', name: 'Diamond III', label: 'DIAMOND · III', minLikes: 375,  color: '#38bdf8', labelColor: '#7dd3fc', bgTint: '#0c2340', timeEstimate: '~6 weeks'      },
  { id: 'diamond_4', name: 'Diamond IV',  label: 'DIAMOND · IV',  minLikes: 440,  color: '#38bdf8', labelColor: '#7dd3fc', bgTint: '#0c2340', timeEstimate: '~2 months'     },
  // ── Legend ─────────────────────────────────────────────────────────────
  { id: 'legend_1',  name: 'Legend I',    label: 'LEGEND · I',    minLikes: 500,  color: '#a78bfa', labelColor: '#c4b5fd', bgTint: '#1e0a3c', timeEstimate: '~2.5 months'   },
  { id: 'legend_2',  name: 'Legend II',   label: 'LEGEND · II',   minLikes: 650,  color: '#a78bfa', labelColor: '#c4b5fd', bgTint: '#1e0a3c', timeEstimate: '~3 months'     },
  { id: 'legend_3',  name: 'Legend III',  label: 'LEGEND · III',  minLikes: 800,  color: '#a78bfa', labelColor: '#c4b5fd', bgTint: '#1e0a3c', timeEstimate: '~4 months'     },
  { id: 'legend_4',  name: 'Legend IV',   label: 'LEGEND · IV',   minLikes: 1000, color: '#a78bfa', labelColor: '#c4b5fd', bgTint: '#1e0a3c', timeEstimate: 'Top 0.1%'      },
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
