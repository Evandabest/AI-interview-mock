import { loadEnvConfig } from '@next/env';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../lib/local/database';
import { hashPassword } from '../lib/local/auth';

loadEnvConfig(process.cwd());
const db = getDatabase();
const accounts = [
  { email: 'admin@bidbay.local', username: 'Admin', type: 'super-user' },
  { email: 'seller@bidbay.local', username: 'Seller', type: 'user' },
  { email: 'buyer@bidbay.local', username: 'Buyer', type: 'user' },
];
db.transaction(() => {
  for (const account of accounts) {
    db.prepare(`INSERT OR IGNORE INTO Users (id, created_at, username, email, password_hash, type, balance)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(randomUUID(), new Date().toISOString(), account.username,
        account.email, hashPassword('Interview123!'), account.type, 1000000);
  }
  const seller = db.prepare('SELECT id FROM Users WHERE email = ?').get('seller@bidbay.local') as { id: string };
  const exists = db.prepare('SELECT id FROM post WHERE poster_id = ? AND title = ?').get(seller.id, 'Demo mechanical keyboard');
  if (!exists) db.prepare(`INSERT INTO post (id, created_at, poster_id, poster_name, title, starting_bid, current_bid, expire, pictures, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(randomUUID(), new Date().toISOString(), seller.id, 'Seller', 'Demo mechanical keyboard',
      5000, 5000, new Date(Date.now() + 7 * 86400000).toISOString(), '["/demo-keyboard.svg"]', 'A sample listing for trying the local auction flow.');
})();
console.log('Demo accounts ready (password: Interview123!):');
for (const account of accounts) console.log(`${account.type}: ${account.email}`);
