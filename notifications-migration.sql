-- Review before applying to the shared Supabase database. Additive only.
CREATE TABLE IF NOT EXISTS careerconnect.notifications (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES careerconnect.users(id) ON DELETE CASCADE,
 application_id TEXT REFERENCES careerconnect.applications(id) ON DELETE CASCADE,
 job_id TEXT REFERENCES careerconnect.jobs(id) ON DELETE CASCADE,
 kind TEXT NOT NULL,
 title TEXT NOT NULL,
 message TEXT NOT NULL,
 created_at TEXT NOT NULL,
 read_at TEXT,
 UNIQUE(user_id, application_id, kind, created_at)
);
CREATE INDEX IF NOT EXISTS notifications_user_date ON careerconnect.notifications(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS notifications_deadline_unique ON careerconnect.notifications(user_id, job_id, kind) WHERE kind = 'deadline';
