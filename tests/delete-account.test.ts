import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authenticate, deleteAccount, getUser } from '../lib/local/auth';
import { getDatabase } from '../lib/local/database';

test('account deletion requires a session, preserves history, and invalidates all account sessions', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bidbay-delete-'));
  process.env.SQLITE_PATH = join(directory, 'test.sqlite');
  const db = getDatabase();
  try {
    const signup = (email: string) => authenticate('signup', {
      email, password: 'test1234', options: { data: { username: email } },
    });
    const buyer = signup('buyer@example.com');
    const seller = signup('seller@example.com');
    const secondSession = authenticate('login', { email: buyer.user.email, password: 'test1234' });
    const now = new Date().toISOString();
    db.prepare('INSERT INTO post (id, created_at, poster_id, highest_bidder) VALUES (?, ?, ?, ?)')
      .run('listing', now, seller.user.id, buyer.user.id);
    db.prepare('INSERT INTO bids (id, created_at, post_id, bidder_id) VALUES (?, ?, ?, ?)')
      .run('bid', now, 'listing', buyer.user.id);
    db.prepare('INSERT INTO orders (id, created_at, post, buyer, seller) VALUES (?, ?, ?, ?, ?)')
      .run('order', now, 'listing', buyer.user.id, seller.user.id);
    const history = () => ['post', 'bids', 'orders'].map(table => db.prepare(`SELECT * FROM ${table}`).all());
    const before = history();

    assert.throws(() => deleteAccount(), /log in/);
    assert.throws(() => deleteAccount('invalid'), /log in/);
    deleteAccount(buyer.token);
    assert.equal(db.prepare('SELECT id FROM Users WHERE id = ?').get(buyer.user.id), undefined);
    assert.equal(getUser(buyer.token), null);
    assert.equal(getUser(secondSession.token), null);
    assert.equal(getUser(seller.token)?.id, seller.user.id);
    assert.deepEqual(history(), before);
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
    assert.throws(() => authenticate('login', { email: buyer.user.email, password: 'test1234' }), /Invalid/);
    assert.throws(() => db.prepare('INSERT INTO bids (id, created_at, bidder_id) VALUES (?, ?, ?)')
      .run('invalid-bid', now, 'missing-user'), /FOREIGN KEY/);
    // Deleting a seller with existing listings and purchases also preserves history.
    deleteAccount(seller.token);
    assert.deepEqual(history(), before);
    assert.equal(getUser(seller.token), null);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
