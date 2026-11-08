import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const listingId = '11111111-1111-4111-8111-111111111111';
test('interview seed creates reproducible prerequisites and resets only its scenario', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bidbay-interview-'));
  const filename = join(directory, 'interview.sqlite');
  const seed = () => execFileSync(process.execPath, ['--import', 'tsx', 'scripts/seed-interview.ts'], {
    env: { ...process.env, SQLITE_PATH: filename }, stdio: 'pipe',
  });
  try {
    const started = Date.now();
    seed();
    const db = new Database(filename);
    db.pragma('foreign_keys = ON');
    const listing = db.prepare('SELECT * FROM post WHERE id = ?').get(listingId) as any;
    const buyer = db.prepare('SELECT * FROM Users WHERE email = ?').get('interview-buyer@bidbay.local') as any;
    const seller = db.prepare('SELECT * FROM Users WHERE email = ?').get('interview-seller@bidbay.local') as any;
    assert.equal(listing.status, 'active');
    assert.ok(Date.parse(listing.expire) >= started + 86400000);
    assert.ok(Date.parse(listing.expire) <= Date.now() + 86400000);
    assert.equal(listing.highest_bidder, buyer.id);
    assert.equal(listing.poster_id, seller.id);
    assert.equal(listing.current_bid, 10000);
    assert.equal(buyer.balance, 100000);
    assert.equal(buyer.type, 'user');
    assert.equal(buyer.suspended, 0);
    assert.equal(seller.balance, 0);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM bids WHERE post_id = ? AND bidder_id = ? AND bid_amount = ?').get(listingId, buyer.id, 10000) as any).n, 1);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM orders WHERE post = ?').get(listingId) as any).n, 0);
    // Simulate a completed run with dependent records and an unrelated listing.
    db.prepare("INSERT INTO orders (id, created_at, buyer, seller, post) VALUES ('fixture-order', ?, ?, ?, ?)").run(new Date().toISOString(), buyer.id, seller.id, listingId);
    db.prepare("INSERT INTO issues (id, created_at, order_id) VALUES ('fixture-issue', ?, 'fixture-order')").run(new Date().toISOString());
    db.prepare("INSERT INTO reviews (id, created_at, order_id, reviewer, reviewee, rate) VALUES ('fixture-review', ?, 'fixture-order', ?, ?, 5)").run(new Date().toISOString(), buyer.id, seller.id);
    db.prepare("UPDATE post SET status = 'completed' WHERE id = ?").run(listingId);
    db.prepare('UPDATE Users SET balance = 1 WHERE id = ?').run(buyer.id);
    db.prepare("INSERT INTO post (id, created_at, title) VALUES ('unrelated-listing', ?, 'Keep me')").run(new Date().toISOString());
    db.close();
    seed();
    const reset = new Database(filename);
    assert.equal((reset.prepare('SELECT balance FROM Users WHERE id = ?').get(buyer.id) as any).balance, 100000);
    assert.equal((reset.prepare('SELECT status FROM post WHERE id = ?').get(listingId) as any).status, 'active');
    assert.ok(reset.prepare("SELECT id FROM post WHERE id = 'unrelated-listing'").get());
    for (const table of ['orders', 'issues', 'reviews']) assert.equal((reset.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as any).n, 0);
    assert.equal((reset.prepare('SELECT COUNT(*) AS n FROM bids WHERE post_id = ?').get(listingId) as any).n, 1);
    reset.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
