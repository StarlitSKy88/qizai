CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  quota_limit INTEGER NOT NULL DEFAULT 30,
  quota_used INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  platforms TEXT NOT NULL,                -- JSON array string
  persona_count INTEGER NOT NULL,
  content_hash TEXT NOT NULL,             -- sha256(content) for dedup
  status TEXT NOT NULL DEFAULT 'streaming', -- 'streaming' | 'done' | 'error'
  diversity REAL,
  boosted_count INTEGER DEFAULT 0,
  report_json TEXT,
  evidence_pack TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  completed_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (ip, window_start)
);
