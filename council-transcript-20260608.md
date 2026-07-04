# LLM Council Transcript — SongMatch Launch Decision
**Date:** June 8, 2026  
**Question:** Should I launch SongMatch to the App Store within 7 days?

---

## Original Question
Solo developer, 3+ months of work on SongMatch. The question: should I ship to the App Store within 7 days?

## Framed Question (with context)
Solo developer, 3+ months of work on SongMatch — an iOS music discovery app (swipe on 30s Deezer previews, build a taste profile, follow friends, earn points, buy cosmetics). Core features complete: recommendation engine v2, email + Apple auth, social layer, gamification (streaks, milestones, shop), 21 app icons, freemium monetization (75 swipes/day free, AdMob ads, RevenueCat Pro subscription). CI/CD via Codemagic ready, App Store Connect ID set. Known issues: tutorial overlay disabled (measurement bug), naming inconsistency ("SongMatch" vs "SoundMatch"), only 1 test, both Firebase and Supabase in use. Should they ship to the App Store within 7 days?

---

## Advisor Responses

### The Contrarian
The naming inconsistency alone should disqualify this from shipping. "SongMatch" vs "SoundMatch" scattered through the codebase and UI isn't a cosmetic issue — it's a sign that nobody has done a full end-to-end audit of the product. App Store reviewers will catch inconsistent naming. Users will be confused about what they downloaded. It signals an unfinished product.

The dual-database situation is a ticking bomb. Firebase AND Supabase in the same app means two billing relationships, two potential points of failure, two sets of security rules to maintain, and almost certainly inconsistent data states. What happens when they diverge? What's the reconciliation strategy? There isn't one.

One test. One. The recommendation engine — the core differentiator — has essentially zero test coverage. You're shipping a taste-profile algorithm with no confidence it works correctly across edge cases.

The disabled tutorial is not a "known issue" — it's broken onboarding. New users will open the app, not understand the mechanic, and immediately churn. You never get a second first impression.

The real fatal flaw: 75 swipes/day free with ads is a hostile monetization structure for a brand-new, unproven app with no user base. You need people to fall in love before you charge them. This will kill organic growth before you even gather data on retention.

Ship in 7 days? No. Take 3 more weeks.

---

### The First Principles Thinker
The question is "should I ship in 7 days?" The actual question is "what problem does shipping solve, and what problem does it create?"

Strip the surface: you are not shipping a finished product. You are shipping a prototype with known defects, two competing databases, a disabled onboarding flow, and a branding inconsistency baked into the binary.

If the answer to "why ship?" is "validate whether people enjoy swipe-based music discovery" — TestFlight solves this with zero review risk and zero reputation cost.

If the answer is "start acquiring users" — a broken tutorial, an identity crisis between SongMatch and SoundMatch, and a single test suite covering one behavior will churn every user you acquire.

If the answer is "prove to myself this is real" — that is a psychological need, not a product decision. Ship to TestFlight. It is equally real.

Fix Supabase-or-Firebase (not both), fix the naming, re-enable onboarding, add one meaningful integration test. That is probably 2 weeks of focused work. Ship when the product answers "what is this?" in under 10 seconds.

---

### The Expansionist
Ship it. Three months of work is a finished product waiting for real data.

Swipe-based music discovery is not a crowded App Store category. You have a mechanic that is genuinely novel for casual listeners who find playlist curation overwhelming.

The social layer is the hidden multiplier. Friends following friends, taste profiles, cosmetics — you have accidentally built the skeleton of a music social network. Spotify tried this and killed it. You have it, and you are small enough to iterate fast.

The freemium + ads + Pro subscription stack means you have three monetization experiments running simultaneously from day one. Real conversion data on all three within the first 30 days is worth more than any further polish.

The naming inconsistency and the disabled tutorial are not blockers — they are version 1.1 tickets. The actual upside scenario: music creators and micro-influencers adopt it as a taste-signaling tool, the social layer grows, and you have acquisition leverage before any well-funded competitor notices the niche. That window is open right now.

Ship in 7 days.

---

### The Outsider
The naming inconsistency alone would make me uninstall before finishing onboarding.

"SongMatch" or "SoundMatch" — which is it? As a new user, I'd see one name in the App Store, a different one somewhere in the app, and immediately wonder if I downloaded the wrong thing. That's a trust issue. First-time users have a 3-second patience window. You burned one of those seconds.

The disabled tutorial is the second problem I'd notice. You built a swipe-based music discovery app with a taste profile, streaks, a shop, and a social layer. None of that is self-explanatory. I'd poke around for 90 seconds, not understand why I'm swiping, and leave.

The question isn't whether your backend is ready. It's whether a stranger who has never heard of this app can download it, understand it in 60 seconds, and want to come back tomorrow. Right now the answer is probably no.

Fix the name. Fix or replace the tutorial with something — even a three-screen static walkthrough. Then ship.

---

### The Executor
Yes. Ship it.

Day 1–2: Pick a name (SongMatch or SoundMatch) and do a global find-replace. Remove all Supabase code or all Firebase code — figure out which one you're actually using and delete the other.

Day 3: Fix the tutorial. The measurement bug is a known, scoped issue. Find the broken measurement call, hardcode the values temporarily, re-enable the overlay.

Day 4: App Store assets — screenshots, description, keywords. This takes longer than you think.

Day 5: Submit a TestFlight build. You need 24–48 hours for App Review.

Day 6–7: Buffer. Something will break. This is your margin.

What you do NOT do: write more tests before shipping, refactor the recommendation engine, add features. Two of the three blockers are mechanical fixes you can finish in an afternoon.

---

## Anonymization Mapping (for peer review)
- Response A → The Expansionist
- Response B → The First Principles Thinker
- Response C → The Executor
- Response D → The Contrarian
- Response E → The Outsider

---

## Peer Review Round (5 reviewers, all independent)

All 5 reviewers agreed on the same answers to all three questions:

**Strongest response:** Response C (The Executor) — unanimously  
Reason: "The only one that converts analysis into an actionable day-by-day plan. It correctly identifies the three real blockers and dismisses the non-blockers."

**Biggest blind spot:** Response A (The Expansionist) — unanimously  
Reason: "Romanticizes the upside while dismissing every known defect as a '1.1 ticket.' Optimism without friction analysis is not strategy."

**What ALL five advisors missed (unanimous):**  
The Deezer API dependency. The entire core mechanic — 30-second previews — runs on Deezer's API. Not one advisor asked about rate limits, commercial use terms, or whether the ads + subscription + App Store distribution model is permitted under the API license. This is potentially the most existential technical and legal risk in the product.

---

## Chairman's Verdict

### Where the Council Agrees
Every advisor — including the one who said ship — identified the same three structural defects as legitimate blockers:
1. The naming inconsistency (SongMatch vs SoundMatch) is a trust-killer visible in the first 60 seconds
2. The disabled tutorial guarantees Day 1 churn — the mechanic is not self-explanatory
3. The dual-database setup (Firebase + Supabase) is an active liability with divergence risk and no reconciliation strategy

### Where the Council Clashes
The Executor + Expansionist say: these are mechanical fixes achievable in 48 hours each — ship in 7 days.
The Contrarian + First Principles Thinker say: these fixes are symptoms of deeper unaudited issues — delay 2–3 weeks and reconsider the free tier.
The resolution hinges on how long those fixes actually take on this codebase — which only the developer can know.

### Blind Spots the Council Caught
**Deezer API commercial terms** — caught unanimously in peer review, missed by all 5 advisors. If the API terms prohibit monetized App Store products, no launch timeline is valid until this is resolved.

### The Recommendation
**Do not ship in 7 days.**

If Deezer permits this monetization: execute the Executor's plan with 14 days instead of 7 — fixing a dual-database situation correctly takes longer than an afternoon. Use TestFlight for one week before App Store submission.

If Deezer does not permit this monetization: no timeline applies until either a commercial license is obtained, an alternative provider is used, or the monetization model is restructured.

### The One Thing to Do First
Read the Deezer API Terms of Service today — specifically the commercial use, monetization, and third-party distribution clauses — and confirm that your ads + subscription + App Store distribution model is permitted. Everything else is downstream of this answer.
