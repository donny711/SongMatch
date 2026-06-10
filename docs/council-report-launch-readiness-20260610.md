# Council Report: Launch Readiness — 2026-06-10

Five-advisor LLM council assessment of SongMatch's distance from App Store launch.

## Consensus
- TestFlight-first is mandatory: 2 weeks minimum, 10–20 real users, focused on
  cold-install tutorial and real-network social flows.
- Unverified device fixes gate everything else.
- The core loop (preview → swipe → good next rec) is the product; social and
  gamification are worth ~zero on day one.
- Deezer/Last.fm ToS must actually be read — the only existential item, though
  likely resolvable (Deezer's API exists for third-party discovery).

## Disagreements & rulings
- **Keys in binary**: blocker vs. acceptable-at-zero-users → moot; extend the
  existing Cloudflare worker to proxy AudD/Last.fm (1–2 days). DONE direction.
- **Empty social layer**: hide it vs. seed it → seed via founding TestFlight
  cohort; soften empty states rather than surgery.
- **Timeline**: days / ~3 weeks / 4–6 weeks → ~3 weeks to submission is the
  best-reasoned case.

## What everyone missed
1. Moderation *documentation*: report/block exists; the policy page should
   state the moderation commitment + 24h report handling.
2. No Deezer/Last.fm attribution anywhere in the UI — near-universal API ToS
   requirement and the cheapest compliance win available. (Fixed same day.)

## Verdict
Conditional green, ~3 weeks: device verification → key proxying + attribution
→ ToS read → listing + ToS page → 2-week TestFlight → submit.

Single next action: the device verification build session.
