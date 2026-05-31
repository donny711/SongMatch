# Radu Vlad Popa — Developer Portfolio

> GitHub: [github.com/donny711](https://github.com/donny711)  
> Email: radupopa214@gmail.com

---

## Summary

Mobile developer who builds and ships complete products end-to-end — from architecture and backend to UI, monetization, and growth mechanics. Currently launching **SoundMatch**, a music discovery app live on iOS with a real subscription model, gamification system, and social features. Not a tutorial project or CRUD app: a polished consumer product with real users.

---

## Tech Stack

| Area | Technologies |
|---|---|
| **Mobile** | React Native 0.81, Expo (New Architecture), iOS & Android |
| **Language** | TypeScript, React 19 |
| **Routing** | Expo Router (file-based, Next.js-style) |
| **Backend / DB** | Firebase Firestore (with security rules), Supabase |
| **State** | Zustand, TanStack React Query |
| **Monetization** | RevenueCat — subscriptions & in-app purchases |
| **Ads** | Google Mobile Ads |
| **Auth** | Sign in with Apple, OAuth |
| **AI / Voice** | VAPI voice AI platform, webhook integrations |
| **Testing** | Jest / jest-expo — 13 unit tests covering all business logic |
| **Media** | expo-av (audio previews), expo-image-picker |
| **Tooling** | TypeScript strict mode, conventional commits, GitHub Pages |

---

## Featured Projects

### 1. SoundMatch — Music Discovery App (Live on iOS)
**[github.com/donny711/SongMatch](https://github.com/donny711/SongMatch)** · TypeScript · React Native · Firebase

A full consumer app — think **Tinder for music**. Users swipe through 30-second song previews, building a music taste profile while earning points, climbing ranks, and connecting with friends who share their taste.

**Core product features (shipped):**

- **Swipe-to-discover feed** — 30-second song previews play automatically; Like ❤️ or Skip ✗. "For You" algorithmically personalised feed + "Friends" social feed
- **Gamification layer** — Match Points (MP), daily streaks, ranked tiers (Silver I → Silver II → … → Gold), progress bars and rank badges
- **Social graph** — followers/following, People tab, profile showcases — users discover music through each other
- **Cosmetics shop** — profile frames, badges, and cosmetics purchasable with MP or via Pro subscription
- **Pro subscription** — 3 pricing tiers integrated via RevenueCat:
  - Monthly: €3.99/mo
  - Quarterly: €9.99 / 3 months (save 17%)
  - Annual: €36/year — €3.00/mo (best value)
  - Perks: full shop access, early access to new features
- **Tiered referral system** — deep link capture on install, install deduplication via Firestore transactions, anti-double-reward guard, two reward tiers:
  - Tier 1 (3rd referred install): referrer + 3 friends each get 30% off for 3 months
  - Tier 2 (7th referred install): referrer gets 1 free month
- **Security** — custom Firestore security rules for referrals and subscriptions; no client-side trust
- **Tested** — 13 Jest unit tests covering all referral business logic: deduplication, tier triggers, friend discount gating, double-reward prevention
- **Clean commit history** — conventional commits (`feat/fix/docs/test`) throughout; structured and reviewable

**Design:** Dark theme with a purple/violet colour palette, smooth animations, Tinder-style card UI — polished consumer-grade visual quality.

**Stack:** React Native · TypeScript · Expo Router · Firebase Firestore · Supabase · Zustand · React Query · RevenueCat · Google Mobile Ads · Sign in with Apple · expo-av

---

### 2. vapi-webhook — Voice AI Webhook Integration
**[github.com/donny711/vapi-webhook](https://github.com/donny711/vapi-webhook)** · VAPI · Webhooks

Webhook server handling real-time events from the [VAPI](https://vapi.ai) voice AI platform. Demonstrates practical knowledge of conversational AI integrations and event-driven architecture. Received community recognition (⭐ starred by others).

---

### 3. songmatch-legal — App Store Legal Pages
**[donny711.github.io/songmatch-legal](https://donny711.github.io/songmatch-legal/)** · HTML · GitHub Pages

Privacy policy and Terms of Service for SoundMatch, hosted on GitHub Pages as required for App Store submission. Shows ownership of the full product lifecycle — not just the code.

---

## What Sets This Work Apart

**Ships a real product, not demos.** SoundMatch has a live subscription paywall, a gamification economy (MP, ranks, streaks), a social graph, and a cosmetics shop — the full feature set of a consumer app competing in the App Store, built solo.

**Product thinking alongside engineering.** The referral system was designed with growth mechanics in mind (viral loops, tiered incentives, anti-fraud) — not just implemented as a feature ticket. The subscription pricing (3 tiers with a clear "best value" anchor) reflects deliberate monetization thinking.

**Full vertical ownership.** Auth → database → security rules → business logic → UI → monetization → legal pages → App Store submission. Every layer, one developer.

**Discipline in the invisible details.** Firestore security rules written before launch. 13 unit tests covering edge cases. Conventional commits for a clean, reviewable history. These are the habits that separate junior from mid-level engineers.

**AI-adjacent experience.** Voice AI integration (VAPI) shows active curiosity about the AI space — relevant to most companies hiring in 2025–2026.

---

## Contact

- **Email:** radupopa214@gmail.com  
- **GitHub:** [github.com/donny711](https://github.com/donny711)
