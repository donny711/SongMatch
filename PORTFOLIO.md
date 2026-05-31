# Radu Vlad Popa — Developer Portfolio

> GitHub: [github.com/donny711](https://github.com/donny711)

---

## Summary

Full-stack mobile developer building production-ready apps with TypeScript, React Native, and Firebase. Focused on shipping real products: implementing monetization, growth mechanics, security, and automated tests — not just demos. Currently building **SoundMatch**, a cross-platform mobile app, end-to-end from architecture to App Store readiness.

---

## Tech Stack

| Area | Technologies |
|---|---|
| **Mobile** | React Native 0.81, Expo (New Architecture), iOS & Android |
| **Language** | TypeScript, React 19 |
| **Routing** | Expo Router (file-based, similar to Next.js) |
| **Backend / DB** | Firebase Firestore, Supabase |
| **State** | Zustand, TanStack React Query |
| **Monetization** | RevenueCat (in-app purchases & subscriptions) |
| **Ads** | Google Mobile Ads (react-native-google-mobile-ads) |
| **Auth** | Sign in with Apple, OAuth (expo-auth-session) |
| **AI / Voice** | VAPI voice AI platform, webhook integrations |
| **Testing** | Jest, jest-expo (unit tests with full coverage) |
| **Media** | expo-av (audio), expo-image-picker, expo-document-picker |
| **Tooling** | Git (conventional commits), GitHub Pages, TypeScript strict mode |

---

## Featured Projects

### 1. SoundMatch — Cross-Platform Music App
**[github.com/donny711/SongMatch](https://github.com/donny711/SongMatch)** · TypeScript · React Native · Firebase

A full-featured mobile app for iOS and Android, built on Expo's New Architecture. Covers the full product lifecycle: auth, media, monetization, growth, and security.

**Key engineering highlights:**

- **Tiered referral system** built from scratch — deep link capture on install, install deduplication, Firestore transactions to prevent double-rewards, and two reward tiers:
  - Tier 1 (3rd referred install): referrer + 3 friends each get 30% off for 3 months
  - Tier 2 (7th referred install): referrer gets 1 free month
- **Monetization** — RevenueCat subscription management integrated with a custom upgrade screen showing contextual discount banners based on pending referral rewards
- **Security** — custom Firestore security rules locking down `referrals` and `subscriptions` collections; no client-side trust
- **Tested** — 13 Jest unit tests covering all business logic: install deduplication, tier 1/2 triggers, double-reward prevention, and friend discount gating
- **Clean commit discipline** — conventional commits (`feat/fix/docs/test`) throughout; structured, reviewable history

**Stack:** React Native · Expo Router · Firebase Firestore · Supabase · Zustand · React Query · RevenueCat · Google Mobile Ads · Sign in with Apple · TypeScript

---

### 2. vapi-webhook — Voice AI Webhook Integration
**[github.com/donny711/vapi-webhook](https://github.com/donny711/vapi-webhook)** · HTML · VAPI

A webhook server handling real-time events from the [VAPI](https://vapi.ai) voice AI platform. Demonstrates familiarity with conversational AI integrations and event-driven backend architecture.

- Built a working integration with a production voice AI API
- Received community recognition (1 ⭐)

---

### 3. songmatch-legal — Legal Pages (GitHub Pages)
**[donny711.github.io/songmatch-legal](https://donny711.github.io/songmatch-legal/)** · HTML · GitHub Pages

Privacy policy and terms of service for SoundMatch, hosted on GitHub Pages — part of the App Store submission requirements. Shows product ownership beyond just writing code.

---

## What Sets This Work Apart

- **Ships real products** — SoundMatch has monetization (RevenueCat), ads (Google Mobile Ads), and legal pages ready for App Store review. This is not a tutorial or CRUD app.
- **Product thinking** — The referral system was designed with growth mechanics in mind (tiered rewards, anti-fraud), not just implemented as a feature ticket.
- **Testing discipline** — Writing 13 unit tests to cover edge cases in a referral service shows engineering maturity beyond "it works on my machine."
- **Security by default** — Firestore security rules were written before shipping, not added as an afterthought.
- **Emerging tech interest** — Voice AI (VAPI) and Microsoft Teams AI exploration show curiosity about the AI space.

---

## Contact

- **Email:** radupopa214@gmail.com
- **GitHub:** [github.com/donny711](https://github.com/donny711)
