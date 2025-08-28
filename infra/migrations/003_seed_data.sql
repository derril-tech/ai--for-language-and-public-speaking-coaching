-- Migration: 003_seed_data.sql
-- Description: Seed initial data for demo and testing

BEGIN;

-- Insert demo organization
INSERT INTO auth.organizations (id, name, slug, settings) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Demo Academy', 'demo-academy', '{"features": {"analytics": true, "coaching": true}}'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Test University', 'test-university', '{"features": {"analytics": true, "coaching": false}}')
ON CONFLICT (slug) DO NOTHING;

-- Insert demo users
INSERT INTO auth.users (id, email, name, avatar_url) VALUES
  ('550e8400-e29b-41d4-a716-446655440010', 'admin@demo.com', 'Demo Admin', 'https://ui-avatars.com/api/?name=Demo+Admin'),
  ('550e8400-e29b-41d4-a716-446655440011', 'coach@demo.com', 'Demo Coach', 'https://ui-avatars.com/api/?name=Demo+Coach'),
  ('550e8400-e29b-41d4-a716-446655440012', 'student@demo.com', 'Demo Student', 'https://ui-avatars.com/api/?name=Demo+Student'),
  ('550e8400-e29b-41d4-a716-446655440013', 'teacher@test.com', 'Test Teacher', 'https://ui-avatars.com/api/?name=Test+Teacher')
ON CONFLICT (email) DO NOTHING;

-- Insert memberships
INSERT INTO auth.memberships (user_id, organization_id, role) VALUES
  -- Demo Academy members
  ('550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440001', 'owner'),
  ('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440001', 'coach'),
  ('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440001', 'student'),
  -- Test University members
  ('550e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440002', 'admin')
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Insert demo projects
INSERT INTO coaching.projects (id, organization_id, name, description, settings) VALUES
  ('550e8400-e29b-41d4-a716-446655440020', '550e8400-e29b-41d4-a716-446655440001', 'Public Speaking 101', 'Introduction to public speaking fundamentals', '{"target_wpm": 150, "language": "en"}'),
  ('550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440001', 'Advanced Presentation Skills', 'Advanced techniques for professional presentations', '{"target_wpm": 140, "language": "en"}'),
  ('550e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440002', 'Academic Speaking', 'Academic presentation and defense skills', '{"target_wpm": 130, "language": "en"}')
ON CONFLICT DO NOTHING;

-- Insert demo sessions
INSERT INTO coaching.sessions (id, project_id, user_id, title, duration_seconds, status, metadata) VALUES
  ('550e8400-e29b-41d4-a716-446655440030', '550e8400-e29b-41d4-a716-446655440020', '550e8400-e29b-41d4-a716-446655440012', 'First Practice Session', 180, 'completed', '{"recording_device": "web", "audio_quality": "good"}'),
  ('550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440020', '550e8400-e29b-41d4-a716-446655440012', 'Week 2 Progress', 240, 'completed', '{"recording_device": "web", "audio_quality": "excellent"}'),
  ('550e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440012', 'Advanced Practice', 300, 'processing', '{"recording_device": "web", "audio_quality": "good"}'),
  ('550e8400-e29b-41d4-a716-446655440033', '550e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440013', 'Research Presentation', 600, 'completed', '{"recording_device": "web", "audio_quality": "excellent"}')
ON CONFLICT DO NOTHING;

-- Insert demo transcripts
INSERT INTO coaching.transcripts (session_id, text, words, language) VALUES
  ('550e8400-e29b-41d4-a716-446655440030', 'Hello everyone, today I will be talking about the importance of public speaking skills in our daily lives. Public speaking is not just about giving presentations, it is about effectively communicating our ideas to others.', 
   '[{"word": "Hello", "start": 0.0, "end": 0.5, "confidence": 0.95}, {"word": "everyone", "start": 0.5, "end": 1.2, "confidence": 0.92}, {"word": "today", "start": 1.2, "end": 1.8, "confidence": 0.94}]', 'en'),
  ('550e8400-e29b-41d4-a716-446655440031', 'In this session, I want to focus on improving our pacing and clarity. The key is to speak at a comfortable rate while maintaining clear pronunciation of each word.', 
   '[{"word": "In", "start": 0.0, "end": 0.3, "confidence": 0.91}, {"word": "this", "start": 0.3, "end": 0.6, "confidence": 0.93}, {"word": "session", "start": 0.6, "end": 1.1, "confidence": 0.89}]', 'en'),
  ('550e8400-e29b-41d4-a716-446655440033', 'My research focuses on the application of machine learning in natural language processing. The results show significant improvements in accuracy when using transformer-based models.', 
   '[{"word": "My", "start": 0.0, "end": 0.4, "confidence": 0.96}, {"word": "research", "start": 0.4, "end": 1.0, "confidence": 0.94}, {"word": "focuses", "start": 1.0, "end": 1.6, "confidence": 0.92}]', 'en')
ON CONFLICT DO NOTHING;

-- Insert demo metrics
INSERT INTO coaching.metrics (time, session_id, metric_type, value, metadata) VALUES
  (NOW() - INTERVAL '2 minutes', '550e8400-e29b-41d4-a716-446655440030', 'wpm', 145.2, '{"window_size": 30}'),
  (NOW() - INTERVAL '1 minute', '550e8400-e29b-41d4-a716-446655440030', 'wpm', 148.7, '{"window_size": 30}'),
  (NOW(), '550e8400-e29b-41d4-a716-446655440030', 'wpm', 152.1, '{"window_size": 30}'),
  (NOW() - INTERVAL '2 minutes', '550e8400-e29b-41d4-a716-446655440030', 'pitch', 220.5, '{"unit": "hz"}'),
  (NOW() - INTERVAL '1 minute', '550e8400-e29b-41d4-a716-446655440030', 'pitch', 218.3, '{"unit": "hz"}'),
  (NOW(), '550e8400-e29b-41d4-a716-446655440030', 'pitch', 225.1, '{"unit": "hz"}'),
  (NOW() - INTERVAL '2 minutes', '550e8400-e29b-41d4-a716-446655440031', 'wpm', 138.9, '{"window_size": 30}'),
  (NOW() - INTERVAL '1 minute', '550e8400-e29b-41d4-a716-446655440031', 'wpm', 142.3, '{"window_size": 30}'),
  (NOW(), '550e8400-e29b-41d4-a716-446655440031', 'wpm', 140.7, '{"window_size": 30}')
ON CONFLICT DO NOTHING;

-- Insert demo scores
INSERT INTO coaching.scores (session_id, rubric_version, pronunciation, prosody, pace, fluency, clarity, overall, confidence_intervals) VALUES
  ('550e8400-e29b-41d4-a716-446655440030', '1.0', 7.5, 6.8, 7.2, 6.5, 7.0, 6.9, '{"pronunciation": [7.2, 7.8], "prosody": [6.5, 7.1], "pace": [6.9, 7.5], "fluency": [6.2, 6.8], "clarity": [6.7, 7.3]}'),
  ('550e8400-e29b-41d4-a716-446655440031', '1.0', 8.1, 7.5, 7.8, 7.2, 7.6, 7.6, '{"pronunciation": [7.8, 8.4], "prosody": [7.2, 7.8], "pace": [7.5, 8.1], "fluency": [6.9, 7.5], "clarity": [7.3, 7.9]}'),
  ('550e8400-e29b-41d4-a716-446655440033', '1.0', 8.5, 8.2, 7.9, 8.0, 8.3, 8.2, '{"pronunciation": [8.2, 8.8], "prosody": [7.9, 8.5], "pace": [7.6, 8.2], "fluency": [7.7, 8.3], "clarity": [8.0, 8.6]}')
ON CONFLICT DO NOTHING;

-- Insert demo fluency data
INSERT INTO coaching.fluency (session_id, fillers_count, grammar_errors, style_suggestions, ttr_ratio) VALUES
  ('550e8400-e29b-41d4-a716-446655440030', 12, '[{"word": "um", "count": 8}, {"word": "uh", "count": 4}]', '[{"suggestion": "Use more varied vocabulary", "priority": "medium"}]', 0.72),
  ('550e8400-e29b-41d4-a716-446655440031', 8, '[{"word": "um", "count": 5}, {"word": "uh", "count": 3}]', '[{"suggestion": "Reduce filler words", "priority": "high"}]', 0.78),
  ('550e8400-e29b-41d4-a716-446655440033', 3, '[{"word": "um", "count": 2}, {"word": "uh", "count": 1}]', '[{"suggestion": "Excellent fluency", "priority": "low"}]', 0.85)
ON CONFLICT DO NOTHING;

-- Insert demo drills
INSERT INTO coaching.drills (session_id, drill_type, content, target_metrics) VALUES
  ('550e8400-e29b-41d4-a716-446655440030', 'minimal_pairs', '{"pairs": [["ship", "sheep"], ["bit", "beat"], ["cat", "cut"]], "instructions": "Practice distinguishing between similar vowel sounds"}', '{"target_pronunciation": 8.0}'),
  ('550e8400-e29b-41d4-a716-446655440030', 'pacing', '{"target_wpm": 150, "text": "Practice reading this passage at exactly 150 words per minute", "metronome_bpm": 75}', '{"target_pace": 7.5}'),
  ('550e8400-e29b-41d4-a716-446655440031', 'shadowing', '{"audio_url": "demo/shadowing_sample.mp3", "transcript": "Follow along with the audio, matching pace and intonation", "difficulty": "intermediate"}', '{"target_prosody": 8.0, "target_fluency": 7.5}')
ON CONFLICT DO NOTHING;

-- Insert demo comments
INSERT INTO coaching.comments (session_id, user_id, timestamp_seconds, text) VALUES
  ('550e8400-e29b-41d4-a716-446655440030', '550e8400-e29b-41d4-a716-446655440011', 45.2, 'Great improvement in pacing here!'),
  ('550e8400-e29b-41d4-a716-446655440030', '550e8400-e29b-41d4-a716-446655440011', 120.5, 'Try to reduce filler words in this section'),
  ('550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440011', 30.0, 'Excellent clarity and pronunciation'),
  ('550e8400-e29b-41d4-a716-446655440033', '550e8400-e29b-41d4-a716-446655440013', 180.0, 'Well-structured presentation of research findings')
ON CONFLICT DO NOTHING;

-- Insert demo plans
INSERT INTO coaching.plans (user_id, coach_id, title, description, exercises, schedule) VALUES
  ('550e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440011', 'Weekly Improvement Plan', 'Focus on reducing filler words and improving pacing', 
   '[{"type": "minimal_pairs", "duration": 15, "frequency": "daily"}, {"type": "pacing_practice", "duration": 20, "frequency": "3x_week"}]', 
   '{"sessions_per_week": 3, "duration_weeks": 4}'),
  ('550e8400-e29b-41d4-a716-446655440013', NULL, 'Self-Study Plan', 'Independent practice for academic presentations', 
   '[{"type": "shadowing", "duration": 30, "frequency": "daily"}, {"type": "recording_practice", "duration": 45, "frequency": "2x_week"}]', 
   '{"sessions_per_week": 5, "duration_weeks": 8}')
ON CONFLICT DO NOTHING;

-- Insert demo shares
INSERT INTO coaching.shares (session_id, token, expires_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440030', 'demo-share-token-123', NOW() + INTERVAL '30 days'),
  ('550e8400-e29b-41d4-a716-446655440033', 'demo-share-token-456', NOW() + INTERVAL '7 days')
ON CONFLICT DO NOTHING;

-- Insert demo audit log entries
INSERT INTO coaching.audit_log (user_id, action, resource_type, resource_id, details) VALUES
  ('550e8400-e29b-41d4-a716-446655440010', 'organization_created', 'organization', '550e8400-e29b-41d4-a716-446655440001', '{"name": "Demo Academy"}'),
  ('550e8400-e29b-41d4-a716-446655440011', 'session_created', 'session', '550e8400-e29b-41d4-a716-446655440030', '{"project": "Public Speaking 101"}'),
  ('550e8400-e29b-41d4-a716-446655440011', 'comment_added', 'comment', '550e8400-e29b-41d4-a716-446655440030', '{"timestamp": 45.2}'),
  ('550e8400-e29b-41d4-a716-446655440012', 'session_completed', 'session', '550e8400-e29b-41d4-a716-446655440031', '{"duration": 240}')
ON CONFLICT DO NOTHING;

COMMIT;
