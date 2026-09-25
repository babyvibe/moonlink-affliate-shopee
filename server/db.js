import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const dataDirectory = join(process.cwd(), 'data')
mkdirSync(dataDirectory, { recursive: true })

const database = new DatabaseSync(join(dataDirectory, 'moonlink.sqlite'))
database.exec(`
  PRAGMA busy_timeout = 5000;
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS anonymous_sessions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS generated_links (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES anonymous_sessions(id) ON DELETE CASCADE,
    input_url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    affiliate_url TEXT,
    origin_url TEXT,
    item_id TEXT,
    product_name TEXT,
    shop_name TEXT,
    product_price INTEGER,
    product_image_url TEXT,
    commission_estimate INTEGER,
    data_source TEXT NOT NULL,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS generated_links_by_session
    ON generated_links (session_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS generated_links_by_created
    ON generated_links (created_at DESC);

  CREATE TABLE IF NOT EXISTS request_events (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL,
    detail TEXT,
    elapsed_ms INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    scrypt_params TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    user_agent TEXT,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions (expires_at);

  CREATE TABLE IF NOT EXISTS admin_login_attempts (
    username TEXT NOT NULL,
    ip TEXT NOT NULL,
    failed_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (username, ip)
  );
`)

export default database
