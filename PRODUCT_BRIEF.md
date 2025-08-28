# AI FOR LANGUAGE & PUBLIC SPEAKING COACHING — END‑TO‑END PRODUCT BLUEPRINT

*(React 18 + Next.js 14 App Router; **Chakra UI** + Tailwind utilities; TypeScript‑first contracts; Node/NestJS API gateway; Python 3.11 speech/NLP workers (WhisperX ASR, pyannote diarization optional, Praat/Parselmouth for prosody, librosa, Montreal Forced Aligner/Gentle for alignment, spaCy/LanguageTool/GRAMMAR‑L for grammar/style, Sentence‑BERT for semantics); Postgres 16 + **TimescaleDB** for time‑series + **pgvector** for embeddings; Redis; NATS event bus; S3/R2 for media; optional ClickHouse for analytics; WebRTC; multi‑tenant; seats + usage‑based billing.)*

---

## 1) Product Description & Presentation

**One‑liner**
“Record or rehearse a talk, and get instant, objective feedback on pronunciation, pace, clarity, and impact — with targeted drills to improve.”

**What it produces**

* **Transcript** with word‑level timestamps, speaker labels (optional), confidence, and language auto‑detection.
* **Pronunciation & prosody scores** (phoneme‑level accuracy, stress/intonation, pitch and energy contours, articulation rate, pauses).
* **Fluency & style analysis** (filler words, repetition, vocabulary richness, grammar/style suggestions).
* **Coaching plan**: personalized drills, targeted readings, tongue twisters, pacing exercises, vocabulary goals.
* **Exports**: PDF coaching report, CSV metrics, JSON bundle, captioned practice video clips.

**Scope/Safety**

* Skill coaching for communication and language practice; **not therapy or clinical speech intervention**.
* Consent reminder for multi‑party recordings; PII masking optional; voice data deletion controls.

---

## 2) Target User

* Professionals rehearsing talks, interviews, or sales demos.
* ESL/EFL learners targeting CEFR levels and accent clarity.
* Universities, bootcamps, and corporate enablement teams running cohorts.

---

## 3) Features & Functionalities (Extensive)

### Capture & Sessions

* **Web & PWA recorder** (WebRTC + MediaRecorder) with device picker, echo cancel/AGC/noise suppression; mobile‑friendly.
* **Scripted vs free‑speak modes**: paste a script (teleprompter) or choose prompts (elevator pitch, STAR interview).
* **Role‑play**: LLM interviewer with configurable persona (technical, behavioral, customer) and time‑boxed Q\&A.

### Pronunciation & Alignment

* **ASR** with WhisperX → word timings + confidence; **forced alignment** (MFA/Gentle) → phoneme alignments and duration targets.
* **Phoneme scoring**: posteriorgrams and confusion pairs (e.g., /r/↔/l/); stress and vowel length deviations.
* **Accent profile**: baseline calibration by reading a passage; model adapts targets per profile.

### Prosody, Pace & Pauses

* **Prosody extraction**: F0 (pitch), intensity (RMS), jitter/shimmer proxies; **articulation rate** (syllables/min) vs **speech rate** (wpm).
* **Pause analysis**: silent gaps, filled pauses, pause placement vs punctuation; late‑closing pauses flagged.
* **Intonation patterns**: rising/falling contours; monotone score; excitement/energy index.

### Fluency, Grammar & Style

* **Filler detection**: um/uh/like/you know; per‑minute rate; contextual trims.
* **Grammar/style**: grammar checks, passive voice, nominalizations, hedging, verbosity; suggested rewrites.
* **Vocabulary**: type‑token ratio, rare word usage, domain term coverage; alternative phrasing suggestions.

### Scoring & Rubrics

* Composite score across **Pronunciation, Prosody, Pace, Fluency, Clarity, Vocabulary, Structure, Engagement**.
* CEFR‑aligned rubrics (A2→C2) with descriptors; custom corporate rubrics.
* **Confidence bands** and uncertainty indicators; explainable contributions per metric.

### Drills & Coaching Plans

* **Targeted drills** auto‑generated from weak phonemes/metrics (minimal pairs, stress drills, tongue twisters).
* **Pacing drills** with metronome cues and breath markers.
* **Shadowing**: choose model audio; line‑by‑line mimic with **DTW** alignment and similarity scores.
* **Spaced repetition** for persistent issues; weekly practice plans.

### Clips, Highlights & Sharing

* **Auto‑clip** stumbles and best segments; burned‑in captions and waveform overlays.
* **Before/after overlay** charts (pitch, WPM, fillers) across sessions.
* Share read‑only reports or coach feedback links; **coach review** with inline comments.

### Search & Knowledge

* Semantic search over transcripts; keyword/entity filters (jargon, product names).
* Tips library with examples, video snippets, and localized guidance per language/accent.

### Integrations

* **Calendars** (Google/Microsoft) for practice schedules; **LMS/LXP** via LTI; **Zoom/Meet** import; **Loom** link ingest.
* **Docs**: Notion/Google Docs export of summaries and action plans; Slack/Teams share.

### Collaboration & Governance

* Roles: Owner, Admin, Coach, Learner, Viewer.
* Cohorts/groups; assignments; grading rubrics; approvals for rubric edits; audit trail.

---

## 4) Backend Architecture (Extremely Detailed & Deployment‑Ready)

### 4.1 Topology

* **Frontend/BFF:** Next.js 14 (Vercel). Server Actions for presigned URLs & light mutations; SSR for report viewer; ISR for share pages.
* **API Gateway:** **NestJS (Node 20)** — REST `/v1`, WebSocket endpoints; OpenAPI 3.1; Zod/AJV validation; RBAC (Casbin); RLS; rate limits; Idempotency‑Key; Request‑ID (ULID).
* **Workers (Python 3.11 + FastAPI control):**
  `asr-worker` (WhisperX), `align-worker` (MFA/Gentle), `prosody-worker` (Praat/Parselmouth + librosa), `fluency-worker` (filler/grammar/style), `scoring-worker` (rubrics/aggregation), `drill-worker` (exercise generator), `clip-worker` (ffmpeg renders), `shadow-worker` (DTW similarity), `search-worker` (embeddings), `report-worker` (PDF/CSV/JSON), `import-worker` (Zoom/Loom), `calendar-worker` (schedules), `coach-worker` (LLM feedback drafts).
* **Event Bus/Queues:** NATS subjects `media.ingest`, `asr.done`, `align.done`, `prosody.done`, `fluency.done`, `score.done`, `drill.make`, `clip.make`, `report.make`, `import.*`, `calendar.*` + Redis Streams; Celery/RQ orchestration.
* **Datastores:** Postgres 16 + **TimescaleDB** (metrics time‑series), **pgvector** (embeddings), **S3/R2** (media/exports), **Redis** (cache/session), optional **ClickHouse** (events).
* **Observability:** OpenTelemetry traces/logs/metrics; Prometheus/Grafana; Sentry.
* **Secrets:** Cloud Secrets Manager/KMS; optional connectors to commercial STT/Pronunciation APIs (Azure/Google/AWS) with scoped tokens.

### 4.2 Data Model (Postgres + TimescaleDB + pgvector)

```sql
-- Tenancy & Identity
CREATE TABLE orgs (id UUID PRIMARY KEY, name TEXT NOT NULL, plan TEXT DEFAULT 'pro', region TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE users (id UUID PRIMARY KEY, org_id UUID REFERENCES orgs(id) ON DELETE CASCADE, email CITEXT UNIQUE NOT NULL, name TEXT, role TEXT DEFAULT 'learner', tz TEXT, locale TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE memberships (user_id UUID, org_id UUID, role TEXT CHECK (role IN ('owner','admin','coach','learner','viewer')), PRIMARY KEY (user_id, org_id));

-- Projects & Sessions
CREATE TABLE projects (id UUID PRIMARY KEY, org_id UUID, name TEXT, description TEXT, cohort TEXT, created_by UUID, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE sessions (
  id UUID PRIMARY KEY, org_id UUID, project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id UUID, title TEXT, mode TEXT CHECK (mode IN ('free','script','roleplay','shadow')), lang TEXT, status TEXT CHECK (status IN ('recording','processing','ready','failed')) DEFAULT 'recording',
  duration_sec INT, wpm NUMERIC, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE media (
  id UUID PRIMARY KEY, session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT CHECK (kind IN ('audio','video','clip','thumb','captions')), s3_key TEXT, mime TEXT, duration_sec INT, meta JSONB, created_at TIMESTAMPTZ DEFAULT now()
);

-- Transcripts & Alignment
CREATE TABLE transcripts (
  id UUID PRIMARY KEY, session_id UUID, text TEXT, words JSONB, diarization JSONB, lang TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE alignments (
  id UUID PRIMARY KEY, session_id UUID, phonemes JSONB, -- [{ph,start_ms,end_ms,conf,stress?}]
  model TEXT, created_at TIMESTAMPTZ DEFAULT now()
);

-- Metrics (Timescale hypertables)
CREATE TABLE metrics (
  ts TIMESTAMPTZ NOT NULL, session_id UUID, key TEXT, value DOUBLE PRECISION, meta JSONB,
  PRIMARY KEY (ts, session_id, key)
);
SELECT create_hypertable('metrics', 'ts');

-- Scores & Rubrics
CREATE TABLE scores (
  id UUID PRIMARY KEY, session_id UUID, rubric JSONB, subscores JSONB, total NUMERIC, ci JSONB, created_at TIMESTAMPTZ DEFAULT now()
);

-- Fluency & Grammar
CREATE TABLE fluency (
  id UUID PRIMARY KEY, session_id UUID, fillers JSONB, repeats JSONB, ttr NUMERIC, sentences INT, grammar JSONB, style JSONB
);

-- Drills & Plans
CREATE TABLE drills (
  id UUID PRIMARY KEY, session_id UUID, kind TEXT, prompt TEXT, targets JSONB, audio_ref_s3_key TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE plans (
  id UUID PRIMARY KEY, org_id UUID, user_id UUID, week_start DATE, goals JSONB, assignments JSONB, created_at TIMESTAMPTZ DEFAULT now()
);

-- Entities & Embeddings
CREATE TABLE entities (
  id UUID PRIMARY KEY, session_id UUID, kind TEXT, value TEXT, start_ms INT, end_ms INT, normalized JSONB
);
CREATE TABLE embeddings (
  id UUID PRIMARY KEY, session_id UUID, owner_kind TEXT, owner_id UUID, text TEXT, embedding VECTOR(768), meta JSONB
);
CREATE INDEX embeddings_idx ON embeddings USING ivfflat (embedding vector_cosine_ops);

-- Feedback & Sharing
CREATE TABLE comments (
  id UUID PRIMARY KEY, session_id UUID, author UUID, anchor JSONB, body TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE shares (
  id UUID PRIMARY KEY, session_id UUID, token TEXT, expires_at TIMESTAMPTZ, permissions TEXT[], created_at TIMESTAMPTZ DEFAULT now()
);

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY, session_id UUID, kind TEXT, s3_key TEXT, meta JSONB, created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit
CREATE TABLE audit_log (id BIGSERIAL PRIMARY KEY, org_id UUID, user_id UUID, action TEXT, target TEXT, meta JSONB, created_at TIMESTAMPTZ DEFAULT now());
```

**Invariants**

* RLS by `org_id`; data retention configurable per org; share tokens are signed and time‑limited.
* `metrics` are keyed (e.g., `wpm`, `f0_mean`, `pause_ms`, `fillers_per_min`) with consistent units.
* `scores.total` computed from rubric weights; changes require recomputation versioning.

### 4.3 API Surface (REST `/v1`, WebSocket)

**Auth/Orgs/Users**

* `POST /auth/login`, `POST /auth/refresh`, `GET /me`.

**Projects & Sessions**

* `POST /projects` `{name,description,cohort?}`
* `POST /sessions` `{project_id?, title?, mode, lang}` → presigned upload / WebRTC token
* `POST /sessions/:id/process` `{steps?:['asr','align','prosody','fluency','score','drills','clips']}`
* `GET /sessions/:id` snapshot
* `DELETE /sessions/:id`

**Transcripts & Metrics**

* `GET /sessions/:id/transcript`
* `GET /sessions/:id/metrics?keys=wpm,f0_mean,pause_ms`
* `GET /sessions/:id/scores|fluency|plans|drills`

**Clips & Reports**

* `POST /sessions/:id/clips` `{highlights?:'stumbles'|'best', aspect?:'16:9'|'9:16'}`
* `POST /reports` `{session_id, kind:'pdf'|'csv'|'json'}` → signed URL

**Search**

* `POST /search` `{q, project_id?, user_id?}` (semantic/keyword)
* `GET /entities?session_id`

**Collaboration**

* `POST /comments` `{session_id, anchor, body}`
* `POST /shares` `{session_id, expires_at, permissions}`

**Conventions**

* Mutations require Idempotency‑Key; Problem+JSON errors; cursor pagination; rate limits per org/user.

### 4.4 Pipelines & Workers

**Ingest**

1. Upload/stream → `asr-worker` produces words + timestamps → store transcript.
   **Align**
2. `align-worker` aligns phonemes against script (if provided) or hypothesized phoneme sequence → durations + stress.
   **Prosody**
3. `prosody-worker` extracts F0/RMS/jitter/shimmer, pace (wpm), pauses; emits time‑series metrics.
   **Fluency**
4. `fluency-worker` detects fillers, repetitions, grammar/style issues; computes TTR and readability.
   **Scoring**
5. `scoring-worker` aggregates to rubric with explanations and confidence bands.
   **Drills**
6. `drill-worker` generates targeted exercises and shadowing packs; schedules reminders.
   **Clips**
7. `clip-worker` renders stumbles/best clips with captions and overlays.
   **Search/Report**
8. `search-worker` builds embeddings; `report-worker` compiles PDF/CSV/JSON with charts and timelines.

### 4.5 Realtime

* WebSockets: `session:{id}:tokens` (ASR words), `session:{id}:metrics` (wpm, fillers/min, f0), `session:{id}:score` updates.
* SSE fallback for restricted networks and long renders.

### 4.6 Caching & Performance

* Redis caches: voice model profiles, script text, recent metrics; presigned URLs.
* Timescale continuous aggregates for per‑minute metrics; compression for cold data.
* GPU pool autoscaling for ASR; CPU fallbacks.

### 4.7 Observability

* OTel spans across `asr`, `align`, `prosody`, `fluency`, `score`, `drill`, `clip`, `report`.
* Metrics: ASR real‑time factor, alignment success, filler detection precision, WPM stability, report p95, cost/min.
* Alerts: ASR failures, alignment drift, render queue saturation.

### 4.8 Security & Compliance

* TLS/HSTS/CSP; KMS‑wrapped secrets; RLS; signed URLs; tenant S3 prefixes.
* Consent capture for recordings; PII redaction of names if enabled; DSR endpoints; retention windows; SSO/SAML/OIDC; SCIM.
* Not for clinical use; disclaimers in reports; coach review mode for enterprise.

---

## 5) Frontend Architecture (React 18 + Next.js 14)

### 5.1 Tech Choices

* **UI:** Chakra UI (AppShell, Drawer, Modal, Tabs, Menu, Tooltip, Slider, Stat, Progress) + Tailwind layout.
* **Charts:** Recharts (radar for rubric, line for pitch/WPM, bar for fillers).
* **Audio/Video:** Web Audio API visualizer; video.js for clip playback; waveform (wavesurfer.js).
* **State/Data:** TanStack Query; Zustand for recorder/editor panels; URL‑synced filters.
* **Realtime:** WS client; SSE fallback.
* **i18n/A11y:** next‑intl; ARIA for timelines; keyboard shortcuts.

### 5.2 App Structure

```
/app
  /(marketing)/page.tsx
  /(auth)/sign-in/page.tsx
  /(app)/dashboard/page.tsx
  /(app)/projects/page.tsx
  /(app)/sessions/new/page.tsx
  /(app)/sessions/[sessionId]/page.tsx
  /(app)/reports/page.tsx
  /(app)/cohorts/page.tsx
  /(app)/coach/page.tsx
  /(app)/integrations/page.tsx
  /(app)/search/page.tsx
/components
  Recorder/*            // MicButton, LevelsMeter, Teleprompter, PersonaPicker
  Timeline/*            // PitchLine, WPMTrack, PauseBars
  Rubric/*              // RadarScore, SubscoreList
  Fluency/*             // FillersTable, GrammarPanel
  Drills/*              // MinimalPairs, TongueTwisters, ShadowPack
  Clips/*               // ClipCard, RenderQueue
  Reports/*             // PDFPreview, MetricCards
  Coach/*               // ReviewPanel, InlineComments
  Search/*              // SemanticResults, EntityChips
/lib
  api-client.ts
  ws-client.ts
  zod-schemas.ts
  rbac.ts
/store
  useRecorderStore.ts
  useSessionStore.ts
  useRealtimeStore.ts
  useCoachStore.ts
```

### 5.3 Key Pages & UX Flows

**New Session**

* Choose mode (free/script/roleplay/shadow), language, persona; paste or upload script; mic test; start recording; live WPM and filler counters; stop → processing shows progress.

**Session Workspace**

* Three‑pane: Transcript, Timeline (pitch/WPM/pauses), and Rubric/Fluency; click on filler or mispronounced word to jump; accept suggestions; generate drills; render clips.

**Coach Review**

* Coach annotates timeline and transcript; attaches sample audio; sets goals; publishes plan; learner receives tasks with reminders.

**Dashboard**

* Trends (before/after), rubric radar deltas, weekly goals, practice streaks; cohort overviews for coaches.

**Search**

* Semantic search across sessions; filter by entity (product name), metric thresholds (WPM>150), or rubric deficits.

### 5.4 Component Breakdown (Selected)

* **Recorder/Teleprompter.tsx**
  Props: `{ script, wpmTarget }`
  Scrolls text in sync with reading rate; highlights current line; warns if >15% above target.

* **Timeline/PitchLine.tsx**
  Props: `{ series, markers }`
  Plots F0 with smoothing; highlights flat segments (monotone) and excessive rises.

* **Fluency/GrammarPanel.tsx**
  Props: `{ issues, onApply }`
  Lists grammar/style issues with rewrites; one‑click apply to script for next attempt.

* **Drills/MinimalPairs.tsx**
  Props: `{ targets }`
  Plays reference and records user; shows phoneme alignment and similarity score.

### 5.5 Data Fetching & Caching

* Server Components for dashboard/session snapshots.
* Query caching for transcripts/metrics; optimistic UI for grammar fixes and plan edits; WS pushes live metrics.

### 5.6 Validation & Error Handling

* Zod schemas; Problem+JSON renderer (mic blocked, codec unsupported, quota exceeded).
* Guards: scoring requires transcript + metrics; drills disabled until targets detected; clip render capped by max duration.

### 5.7 Accessibility & i18n

* Keyboard‑first controls; caption tracks on clips; high‑contrast charts; localized numbers/dates; RTL.

---

## 6) SDKs & Integration Contracts

**Create Session & Process**

```http
POST /v1/sessions {"project_id":"prj_123","mode":"script","lang":"en"}
POST /v1/sessions/sess_123/process {"steps":["asr","align","prosody","fluency","score","drills"]}
```

**Get Scores & Metrics**

```http
GET /v1/sessions/sess_123/scores
GET /v1/sessions/sess_123/metrics?keys=wpm,fillers_per_min,f0_mean
```

**Generate Report**

```http
POST /v1/reports {"session_id":"sess_123","kind":"pdf"}
```

**JSON Bundle** keys: `session`, `media[]`, `transcript`, `alignments`, `metrics[]`, `scores`, `fluency`, `entities[]`, `drills[]`, `reports[]`.

---

## 7) DevOps & Deployment

* **FE:** Vercel (Next.js).
* **APIs/Workers:** Render/Fly/GKE; GPU pool for ASR; autoscaling by queue depth; CPU fallbacks.
* **DB:** Managed Postgres + TimescaleDB + pgvector; PITR; replicas.
* **Cache/Bus:** Redis + NATS; DLQ with retries/backoff/jitter.
* **Storage:** S3/R2 with lifecycle for media/exports; CDN for clip delivery.
* **CI/CD:** GitHub Actions (lint/typecheck/unit/integration, Docker, scan, sign, deploy); blue/green; migration approvals.
* **IaC:** Terraform modules for DB/Redis/NATS/buckets/CDN/secrets/DNS.
* **Envs:** dev/staging/prod; regional GPU nodes optional; error budgets & alerts.

**Operational SLOs**

* ASR real‑time factor **≤ 0.6×** on GPU / **≤ 1.5×** CPU.
* First metrics visible **< 60 s p95** for 10‑minute recording.
* Report render p95 **< 8 s**; WS p95 **< 250 ms**; 5xx **< 0.5%/1k**.

---

## 8) Testing

* **Unit:** phoneme alignment sanity; WPM & pause calculations; F0 extraction; filler detection; grammar rewrite safety; drill generator output.
* **Integration:** record → ASR → align → prosody → fluency → score → drills → report; shadowing similarity.
* **Regression:** rubric stability; multilingual edge cases; accent calibration; diarization interference.
* **E2E (Playwright):** create session → record 2 min → view live metrics → accept grammar fixes → generate drills → render clip → export PDF.
* **Load:** concurrent role‑plays and renders; long session recoveries.
* **Chaos:** GPU node kill; forced aligner unavailable; ensure retries and fallbacks.
* **Security:** RLS checks; signed URL expiry; consent storage; deletion flows.

---

## 9) Success Criteria

**Product KPIs**

* Median **WPM within target ±10%** after 2 weeks of practice.
* **Fillers/min reduced by ≥ 40%** over 3 sessions.
* **Pronunciation score +15%** for targeted phonemes after 2 weeks.
* Coach feedback turnaround **< 48 h** for assigned sessions.

**Engineering SLOs**

* Pipeline success **≥ 99%** excl. provider outages; alignment success **≥ 97%** on scripted reads; report error rate **< 1%**.

---

## 10) Visual/Logical Flows

**A) Record → Analyze**
User records (scripted or free) → ASR tokens stream → alignment & prosody computed → fluency/grammar analyzed → dashboard updates.

**B) Score → Coach**
Rubric aggregation and explanations → drill generation → coach reviews and assigns plan → learner practices.

**C) Compare → Improve**
Before/after charts and clips → spaced repetition exercises → streaks and goals drive habit formation → export/share report if needed.
