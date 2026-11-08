import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

let database: Database.Database | undefined;
export function getDatabase() {
  if (database) return database;
  const filename = resolve(process.env.SQLITE_PATH || 'data/bidbay.sqlite');
  mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS Users (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, username TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE, password_hash TEXT NOT NULL,
      rating REAL NOT NULL DEFAULT 5, profile_picture TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'visitor' CHECK(type IN ('visitor','user','vip','super-user')),
      balance REAL NOT NULL DEFAULT 0, suspended INTEGER NOT NULL DEFAULT 0,
      suspended_times INTEGER NOT NULL DEFAULT 0, bad_review INTEGER NOT NULL DEFAULT 0,
      warning INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS application (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, user_id TEXT REFERENCES Users(id),
      username TEXT, email TEXT, status TEXT NOT NULL DEFAULT 'initiated'
    );
    CREATE TABLE IF NOT EXISTS post (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, poster_id TEXT REFERENCES Users(id),
      poster_name TEXT, title TEXT, starting_bid REAL NOT NULL DEFAULT 0,
      current_bid REAL NOT NULL DEFAULT 0, expire TEXT, pictures TEXT NOT NULL DEFAULT '[]',
      description TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'active',
      highest_bidder TEXT REFERENCES Users(id), comments TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, post_id TEXT REFERENCES post(id),
      bidder_id TEXT REFERENCES Users(id), bid_amount REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, buyer TEXT REFERENCES Users(id),
      seller TEXT REFERENCES Users(id), post TEXT REFERENCES post(id), shipping_address TEXT
    );
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, issuer TEXT REFERENCES Users(id),
      issuee TEXT REFERENCES Users(id), order_id TEXT REFERENCES orders(id),
      comments TEXT, response TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'initiated'
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, reviewer TEXT REFERENCES Users(id),
      reviewee TEXT REFERENCES Users(id), order_id TEXT REFERENCES orders(id),
      comments TEXT, rate REAL CHECK(rate BETWEEN 1 AND 5), UNIQUE(reviewer, order_id)
    );
    CREATE TABLE IF NOT EXISTS watchlist (
      id TEXT PRIMARY KEY, created_at TEXT NOT NULL, user_id TEXT REFERENCES Users(id),
      post_id TEXT REFERENCES post(id), UNIQUE(user_id, post_id)
    );
    CREATE INDEX IF NOT EXISTS bids_post ON bids(post_id);
    CREATE INDEX IF NOT EXISTS bids_bidder ON bids(bidder_id);
    CREATE INDEX IF NOT EXISTS orders_buyer ON orders(buyer);
    CREATE INDEX IF NOT EXISTS posts_poster ON post(poster_id);
  `);
  database = db;
  return db;
}
