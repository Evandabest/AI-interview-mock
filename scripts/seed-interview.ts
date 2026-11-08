import { loadEnvConfig } from '@next/env';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../lib/local/database';
import { hashPassword } from '../lib/local/auth';

loadEnvConfig(process.cwd());
const db = getDatabase();
const listingId = '11111111-1111-4111-8111-111111111111';
const password = 'Interview123!';
const now = new Date();
const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

db.transaction(() => {
  for (const account of [
    { email: 'interview-seller@bidbay.local', username: 'Interview Seller', balance: 0 },
    { email: 'interview-buyer@bidbay.local', username: 'Interview Buyer', balance: 100000 },
  ]) {
    db.prepare(`INSERT INTO Users (id, created_at, username, email, password_hash, type, balance)
      VALUES (?, ?, ?, ?, ?, 'user', ?)
      ON CONFLICT(email) DO UPDATE SET username = excluded.username, password_hash = excluded.password_hash,
        type = 'user', balance = excluded.balance, suspended = 0, suspended_times = 0,
        bad_review = 0, warning = 0, rating = 5`).run(
      randomUUID(), now.toISOString(), account.username, account.email, hashPassword(password), account.balance,
    );
  }
  const seller = db.prepare('SELECT id FROM Users WHERE email = ?').get('interview-seller@bidbay.local') as { id: string };
  const buyer = db.prepare('SELECT id FROM Users WHERE email = ?').get('interview-buyer@bidbay.local') as { id: string };

  // Reset only this fixture and its dependent records so a completed run can be repeated.
  db.prepare('DELETE FROM reviews WHERE order_id IN (SELECT id FROM orders WHERE post = ?)').run(listingId);
  db.prepare('DELETE FROM issues WHERE order_id IN (SELECT id FROM orders WHERE post = ?)').run(listingId);
  db.prepare('DELETE FROM orders WHERE post = ?').run(listingId);
  db.prepare('DELETE FROM bids WHERE post_id = ?').run(listingId);
  db.prepare('DELETE FROM watchlist WHERE post_id = ?').run(listingId);
  db.prepare('DELETE FROM post WHERE id = ?').run(listingId);
  db.prepare(`INSERT INTO post (id, created_at, poster_id, poster_name, title, description,
    starting_bid, current_bid, expire, status, highest_bidder, pictures)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`).run(
    listingId, now.toISOString(), seller.id, 'Interview Seller', 'Mechanical keyboard auction',
    'A mechanical keyboard in excellent condition. Auction closes tomorrow.',
    8000, 10000, expires.toISOString(), buyer.id, '["/demo-keyboard.svg"]',
  );
  db.prepare('INSERT INTO bids (id, created_at, post_id, bidder_id, bid_amount) VALUES (?, ?, ?, ?, ?)')
    .run(randomUUID(), now.toISOString(), listingId, buyer.id, 10000);
})();
console.log(`Interview scenario ready. Auction expires: ${expires.toISOString()}`);
console.log(`Buyer: interview-buyer@bidbay.local | Password: ${password} | Balance: $1,000.00`);
console.log(`Listing: /post/${listingId}`);
console.log(`Checkout: /checkout/${listingId}`);
console.log('Run npm run db:seed:interview again to reset this scenario.');
