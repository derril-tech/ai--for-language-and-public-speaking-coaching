# Project Plan — AI for Language & Public Speaking Coaching

## Current Goal
Ship an MVP that helps a learner **record or upload speech** and receive **objective, actionable feedback** (pronunciation, prosody, pace, fluency/grammar) with **targeted drills** and a **coach-ready report**.

## MVP Scope (Vertical Slice)
1. **Capture**: WebRTC recorder (mic test, echo cancel), file upload; basic teleprompter for scripted mode.
2. **ASR & Metrics**: WhisperX transcription (word timings), core prosody (F0, RMS), WPM, pauses, filler detection.
3. **Scoring**: Simple rubric (Pronunciation, Prosody, Pace, Fluency, Clarity) with uncertainty bands.
4. **Drills**: Minimal pairs & pacing drills auto-generated from weak targets.
5. **Clips & Report**: Auto-clip stumbles/best; PDF coaching report + JSON bundle; share link.
6. **Dashboard**: Before/after deltas (WPM, fillers/min), session list, trend lines.
7. **Coach Review (lite)**: Inline comments on timeline/transcript; assign weekly plan.

## Build Strategy
- **FE**: Next.js 14 (React 18, TS), **Chakra UI** + Tailwind, Recharts; WS for live tokens/metrics.
- **API**: NestJS `/v1` + WebSocket; Zod/AJV, Problem+JSON, RBAC (Casbin), RLS, Idempotency-Key, Request-ID.
- **Workers** (Py 3.11 + FastAPI): `asr`, `prosody`, `fluency`, `scoring`, `drill`, `clip`, `report`, `search`.
- **Data**: Postgres 16 + **TimescaleDB** (metrics), **pgvector** (embeddings/search), S3/R2 (media/exports), Redis (cache/session).
- **Bus**: NATS subjects `media.ingest`, `asr.done`, `prosody.done`, `fluency.done`, `score.done`, `drill.make`, `clip.make`, `report.make`.
- **Observability/Sec**: OTel → Prom/Grafana; Sentry; KMS secrets; tenant RLS; consent/retention controls.

## Milestones
- **M0 — Scaffolding (Week 1)**: Monorepo, CI/CD, envs, base schema.
- **M1 — Capture & Upload (Week 2)**: Recorder + upload; S3; session lifecycle.
- **M2 — ASR & Metrics (Week 3–4)**: WhisperX; WPM/pauses/F0/RMS; live WS streams.
- **M3 — Fluency & Scoring (Week 5)**: Filler/grammar basics; rubric & confidence.
- **M4 — Drills & Clips (Week 6)**: Minimal pairs/pacing; clip renders; thumbnails.
- **M5 — Reports & Share (Week 7)**: PDF/CSV/JSON; share tokens; coach comments.
- **M6 — Hardening (Week 8)**: i18n, rate limits, dashboards, QA gates.

## Non-Goals (MVP)
- Full diarization & phoneme-level forced alignment across all languages; enterprise SSO/SCIM; LMS/LTI; Zoom/Loom import (hooks only).

## Success Criteria
- First metrics visible **< 60s p95** for 10-min recording.
- **Fillers/min −30%** over 3 sessions; **WPM within ±10%** target for 60% of learners by week 2.
- Report render p95 **< 8s**; WS p95 **< 250ms**; 5xx **< 0.5%/1k**.
