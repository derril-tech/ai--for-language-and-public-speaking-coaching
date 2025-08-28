-- Migration: 002_rls_policies.sql
-- Description: Comprehensive RLS policies for multi-tenant access control

BEGIN;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own data" ON auth.users;
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON auth.organizations;
DROP POLICY IF EXISTS "Users can view their memberships" ON auth.memberships;
DROP POLICY IF EXISTS "Users can access their organization's data" ON coaching.projects;

-- Auth policies
CREATE POLICY "Users can view their own data" ON auth.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON auth.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view organizations they belong to" ON auth.organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.memberships 
      WHERE user_id = auth.uid() AND organization_id = id
    )
  );

CREATE POLICY "Organization owners can update their org" ON auth.organizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.memberships 
      WHERE user_id = auth.uid() AND organization_id = id AND role = 'owner'
    )
  );

CREATE POLICY "Users can view their memberships" ON auth.memberships
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Organization owners can manage memberships" ON auth.memberships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.memberships m2
      WHERE m2.user_id = auth.uid() 
      AND m2.organization_id = auth.memberships.organization_id 
      AND m2.role = 'owner'
    )
  );

-- Coaching policies - Projects
CREATE POLICY "Users can access their organization's projects" ON coaching.projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.memberships 
      WHERE user_id = auth.uid() AND organization_id = coaching.projects.organization_id
    )
  );

CREATE POLICY "Organization admins can manage projects" ON coaching.projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.memberships 
      WHERE user_id = auth.uid() 
      AND organization_id = coaching.projects.organization_id 
      AND role IN ('owner', 'admin')
    )
  );

-- Sessions
CREATE POLICY "Users can access their organization's sessions" ON coaching.sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.memberships m
      JOIN coaching.projects p ON p.id = coaching.sessions.project_id
      WHERE m.user_id = auth.uid() AND m.organization_id = p.organization_id
    )
  );

CREATE POLICY "Users can create sessions in their projects" ON coaching.sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.memberships m
      JOIN coaching.projects p ON p.id = coaching.sessions.project_id
      WHERE m.user_id = auth.uid() AND m.organization_id = p.organization_id
    )
  );

CREATE POLICY "Users can update their own sessions" ON coaching.sessions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Organization admins can manage all sessions" ON coaching.sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.memberships m
      JOIN coaching.projects p ON p.id = coaching.sessions.project_id
      WHERE m.user_id = auth.uid() 
      AND m.organization_id = p.organization_id 
      AND m.role IN ('owner', 'admin')
    )
  );

-- Transcripts
CREATE POLICY "Users can access transcripts for their sessions" ON coaching.transcripts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.memberships m
      JOIN coaching.projects p ON p.id = s.project_id
      JOIN coaching.sessions s ON s.id = coaching.transcripts.session_id
      WHERE m.user_id = auth.uid() AND m.organization_id = p.organization_id
    )
  );

-- Metrics
CREATE POLICY "Users can access metrics for their sessions" ON coaching.metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.memberships m
      JOIN coaching.projects p ON p.id = s.project_id
      JOIN coaching.sessions s ON s.id = coaching.metrics.session_id
      WHERE m.user_id = auth.uid() AND m.organization_id = p.organization_id
    )
  );

-- Scores
CREATE POLICY "Users can access scores for their sessions" ON coaching.scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.memberships m
      JOIN coaching.projects p ON p.id = s.project_id
      JOIN coaching.sessions s ON s.id = coaching.scores.session_id
      WHERE m.user_id = auth.uid() AND m.organization_id = p.organization_id
    )
  );

-- Fluency
CREATE POLICY "Users can access fluency data for their sessions" ON coaching.fluency
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.memberships m
      JOIN coaching.projects p ON p.id = s.project_id
      JOIN coaching.sessions s ON s.id = coaching.fluency.session_id
      WHERE m.user_id = auth.uid() AND m.organization_id = p.organization_id
    )
  );

-- Drills
CREATE POLICY "Users can access drills for their sessions" ON coaching.drills
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.memberships m
      JOIN coaching.projects p ON p.id = s.project_id
      JOIN coaching.sessions s ON s.id = coaching.drills.session_id
      WHERE m.user_id = auth.uid() AND m.organization_id = p.organization_id
    )
  );

-- Plans
CREATE POLICY "Users can access their own plans" ON coaching.plans
  FOR SELECT USING (user_id = auth.uid() OR coach_id = auth.uid());

CREATE POLICY "Users can create plans for themselves" ON coaching.plans
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Coaches can create plans for their students" ON coaching.plans
  FOR INSERT WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Users can update their own plans" ON coaching.plans
  FOR UPDATE USING (user_id = auth.uid() OR coach_id = auth.uid());

-- Comments
CREATE POLICY "Users can access comments for their sessions" ON coaching.comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.memberships m
      JOIN coaching.projects p ON p.id = s.project_id
      JOIN coaching.sessions s ON s.id = coaching.comments.session_id
      WHERE m.user_id = auth.uid() AND m.organization_id = p.organization_id
    )
  );

CREATE POLICY "Users can create comments on their sessions" ON coaching.comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.memberships m
      JOIN coaching.projects p ON p.id = s.project_id
      JOIN coaching.sessions s ON s.id = coaching.comments.session_id
      WHERE m.user_id = auth.uid() AND m.organization_id = p.organization_id
    )
  );

CREATE POLICY "Users can update their own comments" ON coaching.comments
  FOR UPDATE USING (user_id = auth.uid());

-- Reports
CREATE POLICY "Users can access reports for their sessions" ON coaching.reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.memberships m
      JOIN coaching.projects p ON p.id = s.project_id
      JOIN coaching.sessions s ON s.id = coaching.reports.session_id
      WHERE m.user_id = auth.uid() AND m.organization_id = p.organization_id
    )
  );

-- Shares (public access for shared content)
CREATE POLICY "Public access to shared content" ON coaching.shares
  FOR SELECT USING (expires_at IS NULL OR expires_at > NOW());

-- Embeddings
CREATE POLICY "Users can access embeddings for their sessions" ON coaching.embeddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.memberships m
      JOIN coaching.projects p ON p.id = s.project_id
      JOIN coaching.sessions s ON s.id = coaching.embeddings.session_id
      WHERE m.user_id = auth.uid() AND m.organization_id = p.organization_id
    )
  );

-- Audit log (read-only for admins)
CREATE POLICY "Organization admins can view audit logs" ON coaching.audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Create function to automatically set user context
CREATE OR REPLACE FUNCTION auth.set_user_context(user_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get current user ID
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    current_setting('app.current_user_id', true)::UUID,
    NULL
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;
