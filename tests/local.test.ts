import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authenticate, getUser, signOut } from '../lib/local/auth';
import { getDatabase } from '../lib/local/database';
import { executeQuery } from '../lib/local/query';
import type { Query, User } from '../lib/local/types';

const directory = mkdtempSync(join(tmpdir(), 'bidbay-test-'));
process.env.SQLITE_PATH = join(directory, 'test.sqlite');
after(() => { getDatabase().close(); rmSync(directory, { recursive: true, force: true }); });
const query = (table: string, overrides: Partial<Query> = {}, user: User | null = null) => executeQuery({ table, action: 'select', columns: '*', filters: [], ...overrides }, user);
const eq = (column: string, value: unknown) => ({ column, op: 'eq', value });

test('local authentication, auction data, relations, authorization and persistence', () => {
  const seller = authenticate('signup', { email: 'seller@example.com', password: 'test1234', options: { data: { username: 'Seller' } } });
  const buyer = authenticate('signup', { email: 'buyer@example.com', password: 'test1234', options: { data: { username: 'Buyer' } } });
  assert.equal(getUser(seller.token)?.id, seller.user.id);
  assert.throws(() => authenticate('login', { email: 'seller@example.com', password: 'wrong123' }), /Invalid/);
  assert.throws(() => authenticate('signup', { email: 'SELLER@example.com', password: 'test1234', options: { data: { username: 'Duplicate' } } }), /registered/);
  const session = authenticate('login', { email: 'SELLER@example.com', password: 'test1234' });
  assert.equal(session.user.id, seller.user.id);
  const profile = query('Users', { filters: [eq('id', seller.user.id)], single: true });
  assert.equal(profile.data.type, 'user');
  assert.equal(profile.data.balance, 100000);
  assert.equal(profile.data.suspended, false);
  assert.equal('password_hash' in profile.data, false);
  assert.match(query('Users', { columns: 'password_hash' }).error!.message, /Unknown column/);
  assert.ok(query('sessions').error);
  assert.ok(query('post; DROP TABLE Users').error);
  assert.ok(query('Users', { filters: [eq('id; DROP TABLE Users', seller.user.id)] }).error);

  assert.ok(query('post', { action: 'insert', values: { title: 'Anonymous' } }).error);
  const listing = query('post', { action: 'insert', values: { poster_id: seller.user.id, title: 'Keyboard', pictures: '["/test.png"]', comments: [], current_bid: 5000 } }, seller.user);
  assert.equal(listing.error, null);
  const postId = listing.data[0].id;
  assert.deepEqual(listing.data[0].comments, []);
  const detail = query('post', { columns: '*, poster:Users!poster_id(username, rating)', filters: [eq('id', postId)], single: true });
  assert.equal(detail.data.poster.username, 'Seller');
  assert.ok(query('post', { action: 'delete', filters: [eq('id', postId)] }, buyer.user).error);
  assert.equal(detail.data.pictures, '["/test.png"]');

  const bid = query('bids', { action: 'insert', values: { post_id: postId, bidder_id: buyer.user.id, bid_amount: 6000 } }, buyer.user);
  assert.equal(bid.error, null);
  const leading = query('post', { action: 'update', values: { current_bid: 6000, highest_bidder: buyer.user.id }, filters: [eq('id', postId)], single: true }, buyer.user);
  assert.equal(leading.error, null);
  assert.equal(leading.data.highest_bidder, buyer.user.id);
  const history = query('bids', { columns: '*, post:post_id(title), bidder:bidder_id(username)', order: { column: 'bid_amount', ascending: false }, limit: 1, count: true });
  assert.equal(history.count, 1);
  assert.equal(history.data[0].post.title, 'Keyboard');
  assert.equal(history.data[0].bidder.username, 'Buyer');
  assert.deepEqual(query('bids', { columns: 'count', filters: [{ column: 'bid_amount', op: 'gte', value: 5000 }] }).data, [{ count: 1 }]);

  const watch = query('watchlist', { action: 'insert', values: { user_id: buyer.user.id, post_id: postId } }, buyer.user);
  assert.equal(watch.error, null);
  assert.equal(query('watchlist', {}, seller.user).data.length, 0);
  assert.equal(query('watchlist', { columns: 'id, post:post_id(title)' }, buyer.user).data[0].post.title, 'Keyboard');
  assert.equal(query('watchlist', { action: 'delete', filters: [eq('id', watch.data[0].id)] }, buyer.user).error, null);
  assert.equal(query('watchlist', { single: true, optional: true }, buyer.user).data, null);
  assert.ok(query('watchlist', { single: true }, buyer.user).error);

  const order = query('orders', { action: 'insert', values: { buyer: buyer.user.id, seller: seller.user.id, post: postId, shipping_address: '{"city":"New York"}' }, single: true }, buyer.user);
  assert.equal(order.error, null);
  assert.equal(query('orders', { columns: '*, post!inner(title)', single: true }, buyer.user).data.post.title, 'Keyboard');
  const issue = query('issues', { action: 'insert', values: { issuer: buyer.user.id, issuee: seller.user.id, order_id: order.data.id, comments: 'Help' }, single: true }, buyer.user);
  assert.equal(issue.error, null);
  const nested = query('issues', { columns: '*, issuer:Users!issues_issuer_fkey(username), order:orders(*, post(title), buyer:Users!orders_buyer_fkey(username), seller:Users!orders_seller_fkey(username))', or: `issuer.eq.${buyer.user.id},issuee.eq.${buyer.user.id}`, single: true }, buyer.user);
  assert.equal(nested.error, null);
  assert.equal(nested.data.issuer.username, 'Buyer');
  assert.equal(nested.data.order.seller.username, 'Seller');
  assert.equal(nested.data.order.post.title, 'Keyboard');
  assert.equal(query('issues', { action: 'update', values: { response: [{ message: 'Reply' }] }, filters: [eq('id', issue.data.id)] }, seller.user).error, null);
  assert.equal(query('issues', { single: true }, buyer.user).data.response[0].message, 'Reply');

  const review = { reviewer: buyer.user.id, reviewee: seller.user.id, order_id: order.data.id, rate: 5 };
  assert.equal(query('reviews', { action: 'insert', values: review }, buyer.user).error, null);
  assert.ok(query('reviews', { action: 'insert', values: review }, buyer.user).error);
  assert.equal(query('Users', { action: 'update', values: { rating: 5 }, filters: [eq('id', seller.user.id)] }, buyer.user).error, null);
  assert.ok(query('Users', { action: 'update', values: { type: 'super-user' }, filters: [eq('id', buyer.user.id)] }, buyer.user).error);
  assert.ok(query('Users', { action: 'update', values: { type: 'super-user' }, filters: [eq('id', seller.user.id)] }, buyer.user).error);

  // Failed batches roll back instead of leaving partially inserted records.
  const before = query('bids').data.length;
  assert.ok(query('bids', { action: 'insert', values: [{ post_id: postId, bidder_id: buyer.user.id }, { post_id: 'missing', bidder_id: buyer.user.id }] }, buyer.user).error);
  assert.equal(query('bids').data.length, before);
  assert.ok(getDatabase().prepare('SELECT id FROM post WHERE id = ?').get(postId));
  signOut(session.token);
  assert.equal(getUser(session.token), null);
  getDatabase().prepare('UPDATE sessions SET expires_at = 0 WHERE user_id = ?').run(buyer.user.id);
  assert.equal(getUser(buyer.token), null);
});
