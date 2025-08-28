-- Migration: 001_initial_schema.sql
-- Description: Initial database schema with auth, coaching, and search tables

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS coaching;

-- Organizations and users
CREATE TABLE auth.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth.memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES auth.organizations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- Projects and sessions
CREATE TABLE coaching.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES auth.organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE coaching.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES coaching.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  duration_seconds INTEGER,
  audio_url TEXT,
  status VARCHAR(50) DEFAULT 'processing',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transcripts
CREATE TABLE coaching.transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES coaching.sessions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  words JSONB NOT NULL,
  language VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metrics (TimescaleDB hypertable)
CREATE TABLE coaching.metrics (
  time TIMESTAMPTZ NOT NULL,
  session_id UUID REFERENCES coaching.sessions(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  metadata JSONB DEFAULT '{}'
);

SELECT create_hypertable('coaching.metrics', 'time');

-- Scores and fluency
CREATE TABLE coaching.scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES coaching.sessions(id) ON DELETE CASCADE,
  rubric_version VARCHAR(20) NOT NULL,
  pronunciation DECIMAL(3,2),
  prosody DECIMAL(3,2),
  pace DECIMAL(3,2),
  fluency DECIMAL(3,2),
  clarity DECIMAL(3,2),
  overall DECIMAL(3,2),
  confidence_intervals JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE coaching.fluency (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES coaching.sessions(id) ON DELETE CASCADE,
  fillers_count INTEGER DEFAULT 0,
  grammar_errors JSONB,
  style_suggestions JSONB,
  ttr_ratio DECIMAL(5,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drills and coaching
CREATE TABLE coaching.drills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES coaching.sessions(id) ON DELETE CASCADE,
  drill_type VARCHAR(50) NOT NULL,
  content JSONB NOT NULL,
  target_metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE coaching.plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  exercises JSONB,
  schedule JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments and collaboration
CREATE TABLE coaching.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES coaching.sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp_seconds DECIMAL(8,3),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports and sharing
CREATE TABLE coaching.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES coaching.sessions(id) ON DELETE CASCADE,
  report_type VARCHAR(50) NOT NULL,
  file_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE coaching.shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES coaching.sessions(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search and embeddings
CREATE TABLE coaching.embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES coaching.sessions(id) ON DELETE CASCADE,
  text_chunk TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE coaching.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_project_id ON coaching.sessions(project_id);
CREATE INDEX idx_sessions_user_id ON coaching.sessions(user_id);
CREATE INDEX idx_transcripts_session_id ON coaching.transcripts(session_id);
CREATE INDEX idx_metrics_session_id ON coaching.metrics(session_id);
CREATE INDEX idx_scores_session_id ON coaching.scores(session_id);
CREATE INDEX idx_fluency_session_id ON coaching.fluency(session_id);
CREATE INDEX idx_drills_session_id ON coaching.drills(session_id);
CREATE INDEX idx_comments_session_id ON coaching.comments(session_id);
CREATE INDEX idx_reports_session_id ON coaching.reports(session_id);
CREATE INDEX idx_shares_token ON coaching.shares(token);
CREATE INDEX idx_embeddings_session_id ON coaching.embeddings(session_id);
CREATE INDEX idx_audit_log_user_id ON coaching.audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON coaching.audit_log(created_at);

-- Vector similarity search index
CREATE INDEX idx_embeddings_vector ON coaching.embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS on all tables
ALTER TABLE auth.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching.metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching.fluency ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching.drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching.shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching.embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching.audit_log ENABLE ROW LEVEL SECURITY;

COMMIT;
