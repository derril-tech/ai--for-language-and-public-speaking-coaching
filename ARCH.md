# Architecture — AI for Language & Public Speaking Coaching

## Topology
- **Frontend/BFF**: Next.js 14 (Vercel). Server Actions for presigned URLs; SSR/ISR for reports and share pages.
- **API Gateway**: NestJS (Node 20) — REST `/v1` + WebSocket; Zod/AJV; Problem+JSON; RBAC (Casbin); RLS; rate limits; Idempotency-Key; Request-ID.
- **Workers (Py 3.11 + FastAPI)**:
  - `asr-worker` (WhisperX) — word timings, conf.
  - `prosody-worker` (Praat/Parselmouth + librosa) — F0/RMS/jitter/shimmer, pauses, WPM.
  - `fluency-worker` (filler/grammar/style via spaCy/LanguageTool).
  - `scoring-worker` — rubric aggregation + uncertainty.
  - `drill-worker` — minimal pairs, pacing/shadowing packs.
  - `clip-worker` (ffmpeg) — stumbles/best with captions.
  - `report-worker` — PDF/CSV/JSON exports.
  - `search-worker` — embeddings for semantic search.
- **Event Bus**: NATS (`media.ingest`, `asr.done`, `prosody.done`, `fluency.done`, `score.done`, `drill.make`, `clip.make`, `report.make`).
- **Datastores**: Postgres 16 + **TimescaleDB** (metrics hypertable), **pgvector** (embedding search), S3/R2 (media/exports), Redis (cache/session); optional ClickHouse (events).
- **Observability**: OTel → Prometheus/Grafana; Sentry.
- **Secrets**: Cloud KMS/Secrets Manager; scoped tokens for optional commercial STT/pronunciation APIs.

## Data Model (high level)
- Tenancy: `orgs`, `users`, `memberships` (RLS by `org_id`).
- Sessions: `projects`, `sessions`, `media`.
- NLP/Audio: `transcripts` (words), `alignments` (phonemes — post-MVP), `metrics` (Timescale), `scores`, `fluency`.
- Coaching: `drills`, `plans`, `comments`, `shares`, `reports`.
- Search/Entities: `embeddings`, `entities`.
- **Invariants**: time-series units consistent; share tokens signed & expiring; re-score when rubric version changes.

## Public API (REST/WebSocket)
- Auth: `POST /auth/login`, `POST /auth/refresh`, `GET /me`.
- Sessions: `POST /sessions`, `POST /sessions/:id/process`, `GET /sessions/:id`, `DELETE /sessions/:id`.
- Data: `GET /sessions/:id/transcript`, `GET /sessions/:id/metrics`, `GET /sessions/:id/scores|fluency|drills`.
- Clips/Reports: `POST /sessions/:id/clips`, `POST /reports`.
- Collab/Search: `POST /comments`, `POST /shares`, `POST /search`.
- **WS**: `session:{id}:tokens|metrics|score` streams.

## Pipelines
1. **Ingest**: WebRTC/upload → S3 → enqueue `media.ingest`.
2. **ASR**: WhisperX → words/timestamps → store `transcripts`.
3. **Prosody**: F0/RMS/pauses/WPM → write `metrics` (Timescale).
4. **Fluency**: fillers/grammar/style → `fluency`.
5. **Scoring**: combine metrics → `scores` (with CI).
6. **Drills**: generate exercises from weakest subscores.
7. **Clips**: render best/stumbles with captions; thumbnails.
8. **Report/Search**: exports + embeddings; share tokens.

## Realtime
- WS push for ASR tokens and rolling metrics; SSE fallback for restricted networks.

## Caching & Performance
- Redis: presigned URLs, recent metrics, voice profile caches.
- Timescale continuous aggregates (per-minute); compression for cold data.
- GPU pool autoscaling for ASR; CPU fallback.

## Security & Compliance
- TLS/HSTS/CSP; KMS-wrapped secrets; Postgres RLS; S3 tenant prefixes.
- Consent capture; optional PII masking; retention windows; DSR endpoints.
- Not for clinical use — disclaimers embedded in reports.

## SLOs
- ASR RTF ≤ **0.6×** (GPU) / ≤ **1.5×** (CPU).
- First metrics visible **< 60s p95** (10-min input).
- Report render **< 8s p95**; WS delivery **< 250ms p95**; 5xx **< 0.5%/1k**.
