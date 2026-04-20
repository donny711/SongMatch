# Affiliate System Design — SoundMatch

**Date:** 2026-04-20
**Scope:** Extend the existing referral code flow to distinguish between user referral codes and creator affiliate codes, track affiliate installs in Firestore, and expose a Cloud Function for the website to create affiliate records.

---

## Context

SoundMatch already has a user referral system (`referrals/{code}` collection, `recordReferralInstall()`, onboarding step 3). This system gives friend-invite rewards (discounts, free months).

A separate affiliate program exists on the website (`songmatch.net/affiliates`) where content creators apply to earn recurring commissions. Currently these two systems are disconnected — there is no affiliate code support in the app.

---

## Goal

When a new user enters a code during onboarding, the app should:
1. Detect whether it's a **user referral code** or a **creator affiliate code**
2. For affiliate codes: mark the user as affiliate-referred and update the creator's CRM entry in Firestore
3. For user codes: keep existing friend-reward logic unchanged

---

## Firestore Schema

### New collection: `affiliates/{code}`

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | The affiliate code (e.g. `CREATOR42`) — also the document ID |
| `creatorName` | string | Full name from the apply form |
| `creatorEmail` | string | Email from the apply form |
| `platform` | string | TikTok / Instagram / YouTube / etc. |
| `profileUrl` | string | Creator's profile URL |
| `status` | `"active"` or `"suspended"` | Only active codes are accepted in the app |
| `tier` | `"starter"` / `"rising"` / `"partner"` / `"elite"` | Commission tier (set manually) |
| `installedUids` | string[] | UIDs of users who installed via this code |
| `installCount` | number | Denormalised count of installedUids |
| `createdAt` | timestamp | When the affiliate was approved |
| `updatedAt` | timestamp | Last modified |

### Modified: `users/{uid}`

New optional field added on affiliate install:

| Field | Type | Description |
|-------|------|-------------|
| `affiliateReferredBy` | string | The affiliate code used during onboarding |

This is separate from the existing `referredBy` field (user referral codes). A user can have at most one of these set.

---

## Cloud Function: `createAffiliate`

**Purpose:** Allows the Lovable website to create affiliate records in Firestore without embedding service account credentials in the frontend.

**Endpoint:** `POST https://<region>-<project>.cloudfunctions.net/createAffiliate`

**Auth:** Admin secret passed in the `x-admin-secret` header. The secret is stored as a Firebase environment variable.

**Request body:**
```json
{
  "code": "CREATOR42",
  "creatorName": "Alex Music",
  "creatorEmail": "alex@example.com",
  "platform": "TikTok",
  "profileUrl": "https://tiktok.com/@alexmusic",
  "tier": "starter"
}
```

**Behaviour:**
- Validates the admin secret
- Rejects if `code` already exists in `affiliates`
- Rejects if `code` already exists in `referrals` (collision guard)
- Creates the `affiliates/{code}` doc with `status: "active"`, `installCount: 0`, `installedUids: []`
- Returns `{ success: true, code }` or an error

**Website integration:** The Lovable site calls this endpoint from its admin panel when approving an application and assigning a code. No Firebase SDK required on the website side.

---

## App Changes

### 1. `referralService.ts` — new `recordAffiliateInstall()`

```
recordAffiliateInstall(newUid: string, affiliateCode: string): Promise<void>
```

Runs in a Firestore transaction:
- Reads `affiliates/{affiliateCode}` — returns early if not found or status !== "active"
- Returns early if `installedUids` already contains `newUid` (idempotent)
- Returns early if `users/{newUid}.affiliateReferredBy` is already set
- Atomically:
  - Increments `affiliates/{code}.installCount`
  - Appends `newUid` to `affiliates/{code}.installedUids`
  - Sets `users/{newUid}.affiliateReferredBy = affiliateCode`

Does NOT trigger any discount or free-month logic. No subscription document is modified.

### 2. `onboarding.tsx` — `handleVerify()`

Current behaviour: checks `referrals/{code}` only.

New behaviour:
1. Check `referrals/{code}` — if exists, set codeType = "referral"
2. Else check `affiliates/{code}` — if exists and status === "active", set codeType = "affiliate"
3. Else — verifyStatus = "invalid"

New state: `codeType: 'referral' | 'affiliate' | null`

### 3. `onboarding.tsx` — verified UI feedback

| Code type | Message |
|-----------|---------|
| `"referral"` | ✓ Code verified! You'll join their squad (existing green text) |
| `"affiliate"` | ✓ Creator code verified! (same green style) |

No other UI change — the step looks identical to the user.

### 4. `onboarding.tsx` — `finish()`

```ts
if (referralCode) {
  if (codeType === 'affiliate') {
    recordAffiliateInstall(uid, referralCode);  // new path
  } else {
    recordReferralInstall(uid, referralCode);   // existing path
  }
}
```

Both calls are fire-and-forget (non-blocking), same as the current recordReferralInstall call.

---

## Firestore Rules

Add a rule for the new `affiliates` collection:

```
match /affiliates/{code} {
  // App reads the code to verify it during onboarding
  allow read: if request.auth != null;
  // Only Cloud Functions (admin SDK) can write
  allow write: if false;
}
```

---

## What This Does NOT Include

- No affiliate dashboard inside the app
- No commission calculation or payout logic in the app
- No in-app rewards for users who install via an affiliate code
- The website's admin panel UI is out of scope — only the HTTP endpoint is defined here

---

## Files Affected

| File | Change |
|------|--------|
| `src/firebase/referralService.ts` | Add `recordAffiliateInstall()` |
| `app/onboarding.tsx` | Update `handleVerify()`, add `codeType` state, update `finish()`, update verified UI |
| `firestore.rules` | Add read rule for `affiliates` collection |
| `functions/index.ts` | Add `createAffiliate` Cloud Function |
