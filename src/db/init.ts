import "dotenv/config";
import { getDb } from "./connection";

export function initializeDatabase(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS anonymous_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anonymous_user_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bottles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_user_key TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'drifting' CHECK (status IN ('drifting', 'returned')),
      target_comment_count INTEGER NOT NULL CHECK (target_comment_count BETWEEN 3 AND 5),
      comment_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      returned_at TEXT,
      FOREIGN KEY (author_user_key) REFERENCES anonymous_users(anonymous_user_key)
    );

    CREATE TABLE IF NOT EXISTS bottle_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bottle_id INTEGER NOT NULL,
      commenter_user_key TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (bottle_id) REFERENCES bottles(id) ON DELETE CASCADE,
      FOREIGN KEY (commenter_user_key) REFERENCES anonymous_users(anonymous_user_key),
      UNIQUE (bottle_id, commenter_user_key)
    );

    CREATE TABLE IF NOT EXISTS bottle_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bottle_id INTEGER NOT NULL,
      visitor_user_key TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('viewed', 'commented')),
      visited_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (bottle_id) REFERENCES bottles(id) ON DELETE CASCADE,
      FOREIGN KEY (visitor_user_key) REFERENCES anonymous_users(anonymous_user_key)
    );

    CREATE INDEX IF NOT EXISTS idx_bottles_author ON bottles(author_user_key);
    CREATE INDEX IF NOT EXISTS idx_bottles_status ON bottles(status);
    CREATE INDEX IF NOT EXISTS idx_comments_bottle ON bottle_comments(bottle_id);
    CREATE INDEX IF NOT EXISTS idx_comments_user ON bottle_comments(commenter_user_key);
    CREATE INDEX IF NOT EXISTS idx_visits_user ON bottle_visits(visitor_user_key);
  `);
}

if (require.main === module) {
  initializeDatabase();
  console.log("SQLite database initialized.");
}
