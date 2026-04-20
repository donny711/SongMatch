# Affiliate System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.


**Goal:** Extend the onboarding referral code flow to detect creator affiliate codes, track installs under the creator Firestore CRM entry, and expose an HTTP Cloud Function the website uses to create affiliate records.

**Architecture:** A new `affiliates/{code}` Firestore collection holds creator CRM data. `handleVerify()` in onboarding checks this collection as a fallback when a code is not found in `referrals/`. On finish, affiliate codes route to a new `recordAffiliateInstall()` instead of the existing friend-reward path. A `createAffiliate` HTTP Cloud Function (protected by admin secret) lets the Lovable website create affiliate docs without embedding service credentials.

**Tech Stack:** React Native (Expo), Firebase Firestore (client SDK), Firebase Functions v1 (Node 20, TypeScript, europe-west1)

---

## File Map

| File | Change |
|------|--------|
| `src/firebase/referralService.ts` | Add `AffiliateRecord` interface + `recordAffiliateInstall()` |
| `app/onboarding.tsx` | Add `codeType` state, update `handleVerify()`, update `finish()`, update verified UI text |
| `firestore.rules` | Add `affiliates/{code}` read rule |
| `functions/src/index.ts` | Add `createAffiliate` HTTP function |

---

## Task 1: Add recordAffiliateInstall() to referralService.ts

**Files:**
- Modify: `src/firebase/referralService.ts`

- [ ] **Step 1: Add AffiliateRecord interface after ReferralRecord (around line 33)**

Add immediately after the closing brace of `ReferralRecord`:

```typescript
export interface AffiliateRecord {
  code: string;
  creatorName: string;
  creatorEmail: string;
  platform: string;
  profileUrl: string;
  status: 'active' | 'suspended';
  tier: 'starter' | 'rising' | 'partner' | 'elite';
  installedUids: string[];
  installCount: number;
  createdAt: unknown;
  updatedAt: unknown;
}
```

- [ ] **Step 2: Add recordAffiliateInstall() at the end of the file**

```typescript
// -- Record a new install via affiliate link --
// Tracking only -- no discount or free-month rewards.
export async function recordAffiliateInstall(
  newUid: string,
  affiliateCode: string
): Promise<void> {
  const codeRef = doc(db, 'affiliates', affiliateCode);
  const newUserRef = doc(db, 'users', newUid);

  await runTransaction(db, async (tx) => {
    const codeSnap = await tx.get(codeRef);
    if (!codeSnap.exists()) return;
    const data = codeSnap.data() as AffiliateRecord;
    if (data.status !== 'active') return;
    if (data.installedUids.includes(newUid)) return;
    const userSnap = await tx.get(newUserRef);
    if (userSnap.exists()) {
      const userData = userSnap.data() as { affiliateReferredBy?: string };
      if (userData.affiliateReferredBy) return;
    }
    tx.update(codeRef, {
      installedUids: arrayUnion(newUid),
      installCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    tx.update(newUserRef, {
      affiliateReferredBy: affiliateCode,
      updatedAt: serverTimestamp(),
    });
  });
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd "C:/Users/Radu si Vlad Popa/SoundMatch"
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/firebase/referralService.ts
git commit -m "feat(affiliate): add AffiliateRecord interface and recordAffiliateInstall()"
```

---
## Task 2: Update onboarding.tsx

**Files:**
- Modify: `app/onboarding.tsx`

- [ ] **Step 1: Update import on line 26**

Change:
```typescript
import { recordReferralInstall } from '../src/firebase/referralService';
```
To:
```typescript
import { recordReferralInstall, recordAffiliateInstall } from '../src/firebase/referralService';
```

- [ ] **Step 2: Add codeType state after verifyStatus state (line 44)**

After:
```typescript
const [verifyStatus, setVerifyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
```
Add:
```typescript
const [codeType, setCodeType] = useState<'referral' | 'affiliate' | null>(null);
```

- [ ] **Step 3: Replace handleVerify() entirely (lines 65-74)**

```typescript
const handleVerify = async () => {
  if (!referralInput.trim()) return;
  setVerifyStatus('checking');
  try {
    const code = referralInput.trim().toUpperCase();
    const referralSnap = await getDoc(doc(db, 'referrals', code));
    if (referralSnap.exists()) {
      setCodeType('referral');
      setVerifyStatus('valid');
      return;
    }
    const affiliateSnap = await getDoc(doc(db, 'affiliates', code));
    if (
      affiliateSnap.exists() &&
      (affiliateSnap.data() as { status: string }).status === 'active'
    ) {
      setCodeType('affiliate');
      setVerifyStatus('valid');
      return;
    }
    setCodeType(null);
    setVerifyStatus('invalid');
  } catch {
    setCodeType(null);
    setVerifyStatus('invalid');
  }
};
```

- [ ] **Step 4: Update finish() referral block (lines 116-119)**

Replace:
```typescript
    if (referralCode) {
      const uid = auth.currentUser?.uid;
      if (uid) recordReferralInstall(uid, referralCode);
    }
```
With:
```typescript
    if (referralCode) {
      const uid = auth.currentUser?.uid;
      if (uid) {
        if (codeType === 'affiliate') {
          recordAffiliateInstall(uid, referralCode);
        } else {
          recordReferralInstall(uid, referralCode);
        }
      }
    }
```

- [ ] **Step 5: Update verified feedback text in referral step UI (around line 315)**

Replace:
```tsx
        {verifyStatus === "valid" && (
          <Text style={[styles.feedbackText, { color: COLORS.green }]}>Code verified!</Text>
        )}
```
With:
```tsx
        {verifyStatus === "valid" && (
          <Text style={[styles.feedbackText, { color: COLORS.green }]}>
            {codeType === 'affiliate' ? 'Creator code verified!' : "Code verified! You'll join their squad"}
          </Text>
        )}
```

- [ ] **Step 6: Verify compilation**

```bash
cd "C:/Users/Radu si Vlad Popa/SoundMatch"
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Manual smoke test**

Run the app and reach onboarding step 3:
- Non-existent code -> red "Code not found"
- Known user code (e.g. K7F2A4B3) -> green "Code verified! You'll join their squad"
- Manually create `affiliates/TESTCODE` in Firestore with `status: "active"`, enter `TESTCODE` -> green "Creator code verified!"

- [ ] **Step 8: Commit**

```bash
git add app/onboarding.tsx
git commit -m "feat(affiliate): detect affiliate codes in onboarding, route to recordAffiliateInstall"
```

---
## Task 3: Update Firestore rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add affiliates rule before the final closing braces**

Add after the `subscriptions` match block (before the two closing braces at end of file):

```
    // Affiliate CRM -- authenticated read for onboarding code verification.
    // Writes only via Cloud Functions (admin SDK bypasses these rules).
    match /affiliates/{code} {
      allow read: if request.auth != null;
      allow write: if false;
    }
```

- [ ] **Step 2: Deploy rules**

```bash
cd "C:/Users/Radu si Vlad Popa/SoundMatch"
firebase deploy --only firestore:rules
```
Expected: `firestore: released rules...`

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(affiliate): add Firestore read rule for affiliates collection"
```

---

## Task 4: Add createAffiliate Cloud Function

**Files:**
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Add createAffiliate at the end of functions/src/index.ts**

```typescript
// -- createAffiliate --
// HTTP endpoint for songmatch.net admin panel to create affiliate records.
// Set AFFILIATE_ADMIN_SECRET in Firebase console:
// Functions -> createAffiliate -> Edit -> Environment variables

export const createAffiliate = region.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const adminSecret = process.env.AFFILIATE_ADMIN_SECRET;
  if (!adminSecret || req.headers['x-admin-secret'] !== adminSecret) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }

  const { code, creatorName, creatorEmail, platform, profileUrl, tier } = req.body as {
    code?: string; creatorName?: string; creatorEmail?: string;
    platform?: string; profileUrl?: string; tier?: string;
  };

  if (!code || !creatorName || !creatorEmail || !platform || !tier) {
    res.status(400).json({ error: 'Missing required fields: code, creatorName, creatorEmail, platform, tier' }); return;
  }

  const validTiers = ['starter', 'rising', 'partner', 'elite'];
  if (!validTiers.includes(tier)) {
    res.status(400).json({ error: 'Invalid tier. Must be one of: ' + validTiers.join(', ') }); return;
  }

  const [affiliateSnap, referralSnap] = await Promise.all([
    db.collection('affiliates').doc(code).get(),
    db.collection('referrals').doc(code).get(),
  ]);

  if (affiliateSnap.exists) { res.status(409).json({ error: 'Affiliate code already exists' }); return; }
  if (referralSnap.exists) { res.status(409).json({ error: 'Code already in use as a user referral code' }); return; }

  await db.collection('affiliates').doc(code).set({
    code, creatorName, creatorEmail, platform,
    profileUrl: profileUrl ?? '',
    tier, status: 'active',
    installedUids: [], installCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  res.status(200).json({ success: true, code });
});
```

- [ ] **Step 2: Build functions**

```bash
cd "C:/Users/Radu si Vlad Popa/SoundMatch/functions"
npm run build
```
Expected: no TypeScript errors, `lib/index.js` updated.

- [ ] **Step 3: Set AFFILIATE_ADMIN_SECRET and deploy**

In Firebase console: Functions -> createAffiliate -> Edit -> Environment variables.
Add key `AFFILIATE_ADMIN_SECRET` = (choose a strong random string, 32+ characters).

```bash
cd "C:/Users/Radu si Vlad Popa/SoundMatch"
firebase deploy --only functions:createAffiliate
```

- [ ] **Step 4: Smoke test**

Get the function URL from Firebase console (Functions -> createAffiliate -> Trigger URL).

Test success:
```bash
curl -X POST   https://europe-west1-PROJECT_ID.cloudfunctions.net/createAffiliate   -H "Content-Type: application/json"   -H "x-admin-secret: YOUR_SECRET"   -d '{"code":"TESTCREATOR","creatorName":"Test","creatorEmail":"t@t.com","platform":"TikTok","tier":"starter"}'
```
Expected: `{"success":true,"code":"TESTCREATOR"}`

Test duplicate (run again): Expected 409 `{"error":"Affiliate code already exists"}`
Test wrong secret: Expected 401 `{"error":"Unauthorized"}`
Verify in Firestore console: `affiliates/TESTCREATOR` doc exists with all fields.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Radu si Vlad Popa/SoundMatch"
git add functions/src/index.ts
git commit -m "feat(affiliate): add createAffiliate HTTP Cloud Function"
```

---

## Website Integration Note

Once deployed, call the endpoint from the Lovable admin panel (no Firebase SDK needed):

```javascript
const response = await fetch(
  'https://europe-west1-PROJECT_ID.cloudfunctions.net/createAffiliate',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': process.env.AFFILIATE_ADMIN_SECRET,
    },
    body: JSON.stringify({
      code: 'CREATOR42', creatorName: 'Alex Music',
      creatorEmail: 'alex@example.com', platform: 'TikTok',
      profileUrl: 'https://tiktok.com/@alexmusic', tier: 'starter',
    }),
  }
);
// { success: true, code: "CREATOR42" }
```

Store `AFFILIATE_ADMIN_SECRET` in Lovable env vars matching the Firebase Functions value.
