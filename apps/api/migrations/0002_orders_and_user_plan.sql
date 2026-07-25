CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  amount_fen INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  wx_code_url TEXT,
  wx_qr_code TEXT,
  wx_transaction_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  paid_at INTEGER,
  expires_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
--> statement-breakpoint
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
--> statement-breakpoint
ALTER TABLE users ADD COLUMN quota_limit_renew_at INTEGER;