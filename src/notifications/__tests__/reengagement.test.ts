import { computeNudges, MANAGED_IDS, type ReengagementState } from '../reengagement';

const base: ReengagementState = { enabled: true, currentStreak: 0, checkedInToday: false };
const ids = (s: ReengagementState) => computeNudges(s).map((n) => n.id).sort();

describe('computeNudges', () => {
  it('returns nothing when disabled', () => {
    expect(computeNudges({ ...base, enabled: false, currentStreak: 5 })).toEqual([]);
  });

  it('always schedules both inactivity nudges when enabled', () => {
    expect(ids(base)).toEqual(['inactivity-3d', 'inactivity-7d']);
  });

  it('uses 3-day and 7-day delays for the inactivity nudges', () => {
    const nudges = computeNudges(base);
    const d3 = nudges.find((n) => n.id === 'inactivity-3d')!;
    const d7 = nudges.find((n) => n.id === 'inactivity-7d')!;
    expect(d3.trigger).toEqual({ type: 'delay', seconds: 3 * 24 * 3600 });
    expect(d7.trigger).toEqual({ type: 'delay', seconds: 7 * 24 * 3600 });
  });

  it('skips the streak nudge when there is no active streak', () => {
    expect(ids({ ...base, currentStreak: 0 })).not.toContain('streak');
  });

  it('adds the streak nudge at 8pm when streak >= 1 and not checked in', () => {
    const nudges = computeNudges({ ...base, currentStreak: 5, checkedInToday: false });
    const streak = nudges.find((n) => n.id === 'streak');
    expect(streak).toBeDefined();
    expect(streak!.trigger).toEqual({ type: 'clock', hour: 20, minute: 0 });
    expect(streak!.body).toContain('5-day streak');
  });

  it('skips the streak nudge when already checked in today', () => {
    expect(ids({ ...base, currentStreak: 5, checkedInToday: true })).not.toContain('streak');
  });

  it('MANAGED_IDS covers every id computeNudges can emit', () => {
    const emitted = computeNudges({ enabled: true, currentStreak: 9, checkedInToday: false }).map((n) => n.id);
    for (const id of emitted) expect(MANAGED_IDS).toContain(id);
  });
});
