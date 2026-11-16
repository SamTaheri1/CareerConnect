-- Private server-only schema: never expose password hashes or sessions via the Data API.
CREATE SCHEMA IF NOT EXISTS careerconnect;
REVOKE ALL ON SCHEMA careerconnect FROM PUBLIC;
SET LOCAL search_path = careerconnect, pg_catalog;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  role TEXT NOT NULL CHECK (role IN ('seeker', 'recruiter')),
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  location TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '', headline TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '',
  skills TEXT NOT NULL DEFAULT '', updated_at TEXT,
  checklists TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id),
  title TEXT NOT NULL, company TEXT NOT NULL, location TEXT NOT NULL,
  type TEXT NOT NULL, arrangement TEXT NOT NULL, level TEXT NOT NULL,
  category TEXT NOT NULL, min DOUBLE PRECISION NOT NULL, max DOUBLE PRECISION NOT NULL CHECK (max >= min),
  description TEXT NOT NULL, responsibilities TEXT NOT NULL, requirements TEXT NOT NULL,
  tags TEXT NOT NULL, initials TEXT NOT NULL, color TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Open', 'Closed')),
  deadline TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL, size INTEGER NOT NULL CHECK (size > 0 AND size <= 5242880),
  content BYTEA NOT NULL, created_at TEXT NOT NULL,
  listed INTEGER NOT NULL DEFAULT 0 CHECK (listed IN (0, 1))
);
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  resume_id TEXT NOT NULL REFERENCES resumes(id),
  name TEXT NOT NULL, email TEXT NOT NULL, note TEXT NOT NULL,
  profile TEXT NOT NULL, resume_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Applied', 'Under Review', 'Interview', 'Offered', 'Rejected')),
  created_at TEXT NOT NULL, history TEXT NOT NULL,
  UNIQUE (user_id, job_id)
);
-- Keep existing Sprint 1/2 databases compatible with the Sprint 3 status list.
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check
  CHECK (status IN ('Applied', 'Under Review', 'Interview', 'Offered', 'Rejected'));
CREATE TABLE IF NOT EXISTS application_notes (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL
    REFERENCES applications(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS application_notes_application
  ON application_notes(application_id);

CREATE INDEX IF NOT EXISTS application_notes_user
  ON application_notes(user_id);

-- Sprint 3: Job seeker and recruiter notifications (US22 and US23).
-- Stores notifications so users can view and mark them as read.
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id TEXT REFERENCES applications(id) ON DELETE CASCADE,
  job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  UNIQUE(user_id, application_id, kind, created_at)
);

-- Retrieve a user's newest notifications efficiently.
CREATE INDEX IF NOT EXISTS notifications_user_date
  ON notifications(user_id, created_at DESC);

-- Prevent duplicate deadline reminders for the same saved job.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_deadline_unique
  ON notifications(user_id, job_id, kind)
  WHERE kind = 'deadline';

CREATE TABLE IF NOT EXISTS saved_jobs (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, job_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY);
CREATE INDEX IF NOT EXISTS jobs_owner ON jobs(owner_id);
CREATE INDEX IF NOT EXISTS resumes_user ON resumes(user_id);
CREATE INDEX IF NOT EXISTS applications_job ON applications(job_id);

CREATE INDEX IF NOT EXISTS applications_user ON applications(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS applications_resume ON applications(resume_id);
REVOKE ALL ON ALL TABLES IN SCHEMA careerconnect FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA careerconnect FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA careerconnect FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA careerconnect FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA careerconnect FROM authenticated;
  END IF;
END $$;
INSERT INTO migrations(name) VALUES ('001-initial') ON CONFLICT DO NOTHING;
INSERT INTO migrations(name) VALUES ('002-under-review-status') ON CONFLICT DO NOTHING;
