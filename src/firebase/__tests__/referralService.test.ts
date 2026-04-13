import {
  recordReferralInstall,
  getPendingRewards,
  markDiscountRedeemed,
} from '../referralService';
import {
  runTransaction,
  getDoc,
  setDoc,
} from 'firebase/firestore';

// Mocks
jest.mock('../config', () => ({ db: {} }));
jest.mock('../subscriptionService', () => ({}));

jest.mock('firebase/firestore', () => ({
  runTransaction: jest.fn(),
  doc: jest.fn((_db, collection, id) => ({ path: `${collection}/${id}` })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  arrayUnion: jest.fn((val) => ({ __arrayUnion: val })),
  increment: jest.fn((n) => ({ __increment: n })),
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
}));

// Helpers
function makeSnap(data) {
  return { exists: () => data !== null, data: () => data ?? {} };
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

  it('triggers tier 1 on 3rd install: rewards referrer + all 3 friends', async () => {
    setupSnaps(
      { referrerId: 'r1', installedUids: ['uid0', 'uid1'], installCount: 2, tier1Rewarded: false, tier2Rewarded: false },
      {},
    );
    await recordReferralInstall('uid2', 'CODE');
    expect(mockTx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'subscriptions/r1' }),
      expect.objectContaining({ pendingDiscount: 0.30, pendingDiscountMonths: 3, pendingDiscountReason: 'referral_tier1' }),
      { merge: true },
    );
    for (const uid of ['uid0', 'uid1', 'uid2']) {
      expect(mockTx.set).toHaveBeenCalledWith(
        expect.objectContaining({ path: `subscriptions/${uid}` }),
        expect.objectContaining({ pendingDiscount: 0.30, pendingDiscountMonths: 3, pendingDiscountReason: 'referral_friend_tier1' }),
        { merge: true },
      );
    }
    expect(mockTx.set).toHaveBeenCalledTimes(4);
  });

  it('does not re-reward tier 1 when already rewarded', async () => {
    setupSnaps(
      { referrerId: 'r1', installedUids: ['uid0','uid1','uid2'], installCount: 3, tier1Rewarded: true, tier2Rewarded: false },
      {},
    );
    await recordReferralInstall('uid3', 'CODE');
    expect(mockTx.set).not.toHaveBeenCalled();
  });

  it('triggers tier 2 on 7th install: grants referrer free month', async () => {
    setupSnaps(
      { referrerId: 'r1', installedUids: ['uid0','uid1','uid2','uid3','uid4','uid5'], installCount: 6, tier1Rewarded: true, tier2Rewarded: false },
      {},
    );
    await recordReferralInstall('uid6', 'CODE');
    expect(mockTx.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'subscriptions/r1' }),
      expect.objectContaining({ freeMonthGranted: true, freeMonthReason: 'referral_tier2' }),
      { merge: true },
    );
    expect(mockTx.set).toHaveBeenCalledTimes(1);
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
