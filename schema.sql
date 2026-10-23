PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
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
  category TEXT NOT NULL, min REAL NOT NULL, max REAL NOT NULL CHECK (max >= min),
  description TEXT NOT NULL, responsibilities TEXT NOT NULL, requirements TEXT NOT NULL,
  tags TEXT NOT NULL, initials TEXT NOT NULL, color TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Open', 'Closed')),
  deadline TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL, size INTEGER NOT NULL CHECK (size > 0 AND size <= 5242880),
  content BLOB NOT NULL, created_at TEXT NOT NULL,
  listed INTEGER NOT NULL DEFAULT 0 CHECK (listed IN (0, 1))
);
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  resume_id TEXT NOT NULL REFERENCES resumes(id),
  name TEXT NOT NULL, email TEXT NOT NULL, note TEXT NOT NULL,
  profile TEXT NOT NULL, resume_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Applied', 'Interview', 'Offered', 'Rejected')),
  created_at TEXT NOT NULL, history TEXT NOT NULL,
  UNIQUE (user_id, job_id)
);
CREATE TABLE IF NOT EXISTS saved_jobs (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, job_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY);
CREATE INDEX IF NOT EXISTS jobs_owner ON jobs(owner_id);
CREATE INDEX IF NOT EXISTS resumes_user ON resumes(user_id);
CREATE INDEX IF NOT EXISTS applications_job ON applications(job_id);
