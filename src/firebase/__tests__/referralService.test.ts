import {
  recordReferralInstall,
  getPendingRewards,
  markDiscountRedeemed,
  getSquadMembers,
  getReferralLeaderboard,
} from '../referralService';
import {
  runTransaction,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';

// Mocks
jest.mock('../config', () => ({ db: {} }));
jest.mock('../subscriptionService', () => ({}));

jest.mock('firebase/firestore', () => ({
  runTransaction: jest.fn(),
  doc: jest.fn((_db, collection, id) => ({ path: `${collection}/${id}` })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  arrayUnion: jest.fn((val) => ({ __arrayUnion: val })),
  increment: jest.fn((n) => ({ __increment: n })),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
  query: jest.fn((...args) => args),
  collection: jest.fn((_db, col) => col),
  orderBy: jest.fn((field, dir) => ({ field, dir })),
  limit: jest.fn((n) => ({ limit: n })),
}));

// Helpers
function makeSnap(data) {
  return { exists: () => data !== null, data: () => data ?? {} };
}

function makeQuerySnap(docs: Record<string, unknown>[]) {
  return { docs: docs.map((d) => ({ data: () => d })) };
}



// recordReferralInstall
describe('recordReferralInstall', () => {
  const mockTx = { get: jest.fn(), update: jest.fn(), set: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    runTransaction.mockImplementation(async (_db, fn) => fn(mockTx));
  });

  function setupSnaps(referralData, newUserData = {}) {
    mockTx.get.mockImplementation((ref) => {
      if (ref.path.startsWith('referrals/')) return Promise.resolve(makeSnap(referralData));
      if (ref.path.startsWith('users/')) return Promise.resolve(makeSnap(newUserData));
      return Promise.resolve(makeSnap(null));
    });
  }

  it('does nothing when referral code does not exist', async () => {
    setupSnaps(null);
    await recordReferralInstall('uid1', 'CODE');
    expect(mockTx.update).not.toHaveBeenCalled();
    expect(mockTx.set).not.toHaveBeenCalled();
  });

  it('does nothing when uid already recorded', async () => {
    setupSnaps({ referrerId: 'r1', installedUids: ['uid1'], installCount: 1, tier1Rewarded: false, tier2Rewarded: false });
    await recordReferralInstall('uid1', 'CODE');
    expect(mockTx.update).not.toHaveBeenCalled();
  });

  it('does nothing when user already has referredBy', async () => {
    setupSnaps(
      { referrerId: 'r1', installedUids: [], installCount: 0, tier1Rewarded: false, tier2Rewarded: false },
      { referredBy: 'OTHERCODE' },
    );
    await recordReferralInstall('uid1', 'CODE');
    expect(mockTx.update).not.toHaveBeenCalled();
  });

  it('records install and marks user referredBy', async () => {
    setupSnaps(
      { referrerId: 'r1', installedUids: ['uid0'], installCount: 1, tier1Rewarded: false, tier2Rewarded: false },
      {},
    );
    await recordReferralInstall('uid1', 'CODE');
    expect(mockTx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'referrals/CODE' }),
      expect.objectContaining({ installCount: expect.anything() }),
    );
    expect(mockTx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/uid1' }),
      { referredBy: 'CODE' },
    );
    expect(mockTx.set).not.toHaveBeenCalled();
  });

  it('does not trigger tier 1 before 3rd install', async () => {
    setupSnaps(
      { referrerId: 'r1', installedUids: ['uid0'], installCount: 1, tier1Rewarded: false, tier2Rewarded: false },
      {},
    );
    await recordReferralInstall('uid1', 'CODE');
    expect(mockTx.set).not.toHaveBeenCalled();
  });

  it('sets the tier 1 flag on the 3rd install (no subscription writes)', async () => {
    setupSnaps(
      { referrerId: 'r1', installedUids: ['uid0', 'uid1'], installCount: 2, tier1Rewarded: false, tier2Rewarded: false },
      {},
    );
    await recordReferralInstall('uid2', 'CODE');
    // Tier flags drive UI badges only; the subscription-discount rewards were
    // removed (they wrote to other users' subscription docs, denied by rules).
    expect(mockTx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'referrals/CODE' }),
      expect.objectContaining({ tier1Rewarded: true }),
    );
    expect(mockTx.set).not.toHaveBeenCalled();
  });

  it('does not re-reward tier 1 when already rewarded', async () => {
    setupSnaps(
      { referrerId: 'r1', installedUids: ['uid0','uid1','uid2'], installCount: 3, tier1Rewarded: true, tier2Rewarded: false },
      {},
    );
    await recordReferralInstall('uid3', 'CODE');
    expect(mockTx.set).not.toHaveBeenCalled();
  });

  it('sets the tier 2 flag on the 7th install (no subscription writes)', async () => {
    setupSnaps(
      { referrerId: 'r1', installedUids: ['uid0','uid1','uid2','uid3','uid4','uid5'], installCount: 6, tier1Rewarded: true, tier2Rewarded: false },
      {},
    );
    await recordReferralInstall('uid6', 'CODE');
    expect(mockTx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'referrals/CODE' }),
      expect.objectContaining({ tier2Rewarded: true }),
    );
    expect(mockTx.set).not.toHaveBeenCalled();
  });

  it('does not re-reward tier 2 when already rewarded', async () => {
    setupSnaps(
      { referrerId: 'r1', installedUids: ['uid0','uid1','uid2','uid3','uid4','uid5'], installCount: 6, tier1Rewarded: true, tier2Rewarded: true },
      {},
    );
    await recordReferralInstall('uid6', 'CODE');
    expect(mockTx.set).not.toHaveBeenCalled();
  });
});

// getPendingRewards
describe('getPendingRewards', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns nulls when subscription doc does not exist', async () => {
    getDoc.mockResolvedValueOnce(makeSnap(null));
    expect(await getPendingRewards('uid1')).toEqual({ pendingDiscount: null, pendingDiscountMonths: null, freeMonthGranted: false });
  });

  it('returns discount values when present', async () => {
    getDoc.mockResolvedValueOnce(makeSnap({ pendingDiscount: 0.30, pendingDiscountMonths: 3, freeMonthGranted: true }));
    expect(await getPendingRewards('uid1')).toEqual({ pendingDiscount: 0.30, pendingDiscountMonths: 3, freeMonthGranted: true });
  });

  it('handles missing fields gracefully', async () => {
    getDoc.mockResolvedValueOnce(makeSnap({}));
    expect(await getPendingRewards('uid1')).toEqual({ pendingDiscount: null, pendingDiscountMonths: null, freeMonthGranted: false });
  });
});

// markDiscountRedeemed
describe('markDiscountRedeemed', () => {
  beforeEach(() => jest.clearAllMocks());

  it('clears all reward fields on the subscription doc', async () => {
    setDoc.mockResolvedValueOnce(undefined);
    await markDiscountRedeemed('uid1');
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'subscriptions/uid1' }),
      expect.objectContaining({ pendingDiscount: null, pendingDiscountReason: null, freeMonthGranted: null, freeMonthReason: null }),
      { merge: true },
    );
  });
});

// getSquadMembers
describe('getSquadMembers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty when user doc does not exist', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce(makeSnap(null));
    expect(await getSquadMembers('uid1')).toEqual({ members: [], isReferrer: false, installCount: 0, tier1Rewarded: false, tier2Rewarded: false });
  });

  it('returns empty when user has no referralCode or referredBy', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce(makeSnap({}));
    expect(await getSquadMembers('uid1')).toEqual({ members: [], isReferrer: false, installCount: 0, tier1Rewarded: false, tier2Rewarded: false });
  });

  it('returns squad when user is referrer with installs', async () => {
    (getDoc as jest.Mock)
      .mockResolvedValueOnce(makeSnap({ referralCode: 'CODE' }))
      .mockResolvedValueOnce(makeSnap({ referrerId: 'uid1', installedUids: ['uid2', 'uid3'], installCount: 2, tier1Rewarded: false, tier2Rewarded: false }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Alice', avatarUrl: null, username: null }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Bob', avatarUrl: null, username: null }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Carol', avatarUrl: null, username: null }));
    const result = await getSquadMembers('uid1');
    expect(result.members).toHaveLength(3);
    expect(result.isReferrer).toBe(true);
    expect(result.members.find((m) => m.uid === 'uid1')?.isReferrer).toBe(true);
    expect(result.members.find((m) => m.uid === 'uid2')?.isReferrer).toBe(false);
  });

  it('falls back to referredBy group when own code has 0 installs', async () => {
    (getDoc as jest.Mock)
      .mockResolvedValueOnce(makeSnap({ referralCode: 'MYCODE', referredBy: 'THEIRCODE' }))
      .mockResolvedValueOnce(makeSnap({ referrerId: 'uid1', installedUids: [], installCount: 0, tier1Rewarded: false, tier2Rewarded: false }))
      .mockResolvedValueOnce(makeSnap({ referrerId: 'uid0', installedUids: ['uid1'], installCount: 1, tier1Rewarded: false, tier2Rewarded: false }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Referrer', avatarUrl: null, username: null }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Me', avatarUrl: null, username: null }));
    const result = await getSquadMembers('uid1');
    expect(result.isReferrer).toBe(false);
    expect(result.members.find((m) => m.uid === 'uid0')?.isReferrer).toBe(true);
    expect(result.members).toHaveLength(2);
  });

  it('skips deleted accounts', async () => {
    (getDoc as jest.Mock)
      .mockResolvedValueOnce(makeSnap({ referralCode: 'CODE' }))
      .mockResolvedValueOnce(makeSnap({ referrerId: 'uid1', installedUids: ['uid2', 'uid_gone'], installCount: 2, tier1Rewarded: false, tier2Rewarded: false }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Alice', avatarUrl: null, username: null }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Bob', avatarUrl: null, username: null }))
      .mockResolvedValueOnce(makeSnap(null));
    const result = await getSquadMembers('uid1');
    expect(result.members).toHaveLength(2);
    expect(result.members.map((m) => m.uid)).not.toContain('uid_gone');
  });
});

// getReferralLeaderboard
describe('getReferralLeaderboard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty when no referral docs', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce(makeQuerySnap([]));
    expect(await getReferralLeaderboard(50)).toEqual([]);
  });

  it('filters out entries with 0 installs', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce(makeQuerySnap([
      { referrerId: 'uid1', installCount: 0, tier1Rewarded: false, tier2Rewarded: false },
    ]));
    expect(await getReferralLeaderboard(50)).toHaveLength(0);
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('returns entries with user profiles', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce(makeQuerySnap([
      { referrerId: 'uid1', installCount: 5, tier1Rewarded: true, tier2Rewarded: false },
      { referrerId: 'uid2', installCount: 3, tier1Rewarded: true, tier2Rewarded: false },
    ]));
    (getDoc as jest.Mock)
      .mockResolvedValueOnce(makeSnap({ displayName: 'Alice', avatarUrl: null, username: 'alice' }))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Bob', avatarUrl: null, username: 'bob' }));
    const result = await getReferralLeaderboard(50);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ uid: 'uid1', displayName: 'Alice', installCount: 5 });
    expect(result[1]).toMatchObject({ uid: 'uid2', displayName: 'Bob', installCount: 3 });
  });

  it('skips entries where user doc does not exist', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce(makeQuerySnap([
      { referrerId: 'uid_gone', installCount: 10, tier1Rewarded: true, tier2Rewarded: true },
      { referrerId: 'uid2', installCount: 3, tier1Rewarded: false, tier2Rewarded: false },
    ]));
    (getDoc as jest.Mock)
      .mockResolvedValueOnce(makeSnap(null))
      .mockResolvedValueOnce(makeSnap({ displayName: 'Bob', avatarUrl: null, username: null }));
    const result = await getReferralLeaderboard(50);
    expect(result).toHaveLength(1);
    expect(result[0].uid).toBe('uid2');
  });
});
