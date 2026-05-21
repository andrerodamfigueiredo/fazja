const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'tasks.db')
  : path.join(__dirname, 'tasks.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    emoji        TEXT    DEFAULT '⭐',
    slot         TEXT    DEFAULT 'manha',
    position     INTEGER DEFAULT 0,
    has_time     INTEGER DEFAULT 0,
    due_at       TEXT,
    done         INTEGER DEFAULT 0,
    done_at      TEXT,
    created_at   TEXT    DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS streak (
    id               INTEGER PRIMARY KEY CHECK (id = 1),
    current_streak   INTEGER DEFAULT 0,
    longest_streak   INTEGER DEFAULT 0,
    last_active_date TEXT,
    total_tasks_done INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription TEXT NOT NULL UNIQUE,
    created_at   TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// Ensure streak row exists
db.prepare(`INSERT OR IGNORE INTO streak (id) VALUES (1)`).run();

module.exports = { db };
