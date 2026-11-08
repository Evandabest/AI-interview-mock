import { randomUUID } from 'node:crypto';
import { getDatabase } from './database';
import type { Query, Result, Row, User } from './types';

const tables = ['Users', 'application', 'post', 'bids', 'orders', 'issues', 'reviews', 'watchlist'];
const relations: Record<string, Record<string, [string, string]>> = {
  post: { poster: ['Users', 'poster_id'], poster_id: ['Users', 'poster_id'], Users: ['Users', 'poster_id'] },
  bids: { post: ['post', 'post_id'], post_id: ['post', 'post_id'], bidder_id: ['Users', 'bidder_id'] },
  orders: { post: ['post', 'post'], buyer: ['Users', 'buyer'], seller: ['Users', 'seller'] },
  application: { Users: ['Users', 'user_id'] },
  watchlist: { post_id: ['post', 'post_id'] },
  issues: { issuer: ['Users', 'issuer'], issuee: ['Users', 'issuee'], orders: ['orders', 'order_id'],
    issues_issuer_fkey: ['Users', 'issuer'], issues_issuee_fkey: ['Users', 'issuee'] },
};
const booleanColumns = ['suspended', 'warning'];
const jsonColumns = ['comments', 'response'];
function columns(table: string): string[] {
  if (!tables.includes(table)) throw new Error('Unknown table.');
  return (getDatabase().prepare(`PRAGMA table_info("${table}")`).all() as Row[])
    .map(row => row.name).filter(name => name !== 'password_hash');
}
function identifier(table: string, column: string) {
  if (!columns(table).includes(column)) throw new Error(`Unknown column: ${column}`);
  return `"${column}"`;
}
function encode(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === 'boolean') return Number(value);
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' || typeof value === 'number') return value;
  throw new Error('Invalid value.');
}
function decode(row: Row): Row {
  const result = { ...row };
  delete result.password_hash;
  for (const column of booleanColumns) if (column in result) result[column] = Boolean(result[column]);
  // pictures is intentionally a JSON string because the existing pages parse it.
  for (const column of jsonColumns) {
    if (typeof result[column] === 'string') {
      try { result[column] = JSON.parse(result[column]); } catch { /* Plain issue comments remain text. */ }
    }
  }
  return result;
}
function splitSelection(selection: string) {
  let depth = 0, start = 0;
  const parts: string[] = [];
  for (let i = 0; i < selection.length; i++) {
    if (selection[i] === '(') depth++;
    if (selection[i] === ')') depth--;
    if (selection[i] === ',' && depth === 0) { parts.push(selection.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(selection.slice(start).trim());
  return parts.filter(Boolean);
}
function project(table: string, raw: Row, selection: string, depth = 0): Row {
  if (depth > 5) throw new Error('Selection too deeply nested.');
  const row = decode(raw), result: Row = {};
  for (const part of splitSelection(selection)) {
    if (part === '*') { Object.assign(result, row); continue; }
    const nested = part.match(/^([\w:!]+)\s*\(([\s\S]*)\)$/);
    if (!nested) { identifier(table, part); result[part] = row[part]; continue; }
    const [head, fields] = nested.slice(1);
    const [alias, source] = head.includes(':') ? head.split(':') : [head.split('!')[0], head];
    const [target, hint] = source.split('!');
    let relation = relations[table]?.[hint && hint !== 'inner' ? hint : target];
    if (!relation && table === 'orders' && target === 'Users') {
      relation = hint === 'orders_buyer_fkey' ? ['Users', 'buyer'] : ['Users', 'seller'];
    }
    if (!relation) throw new Error(`Unknown relation: ${head}`);
    const [relatedTable, foreignKey] = relation;
    const related = getDatabase().prepare(`SELECT * FROM "${relatedTable}" WHERE id = ?`).get(raw[foreignKey] ?? null) as Row | undefined;
    result[alias] = related ? project(relatedTable, related, fields, depth + 1) : null;
  }
  return result;
}
function canWrite(table: string, row: Row, values: Row, user: User, admin: boolean, action: Query['action']) {
  if (admin) return;
  const db = getDatabase();
  const role = (db.prepare('SELECT type FROM Users WHERE id = ?').get(user.id) as Row)?.type;
  if (values.type === 'super-user') throw new Error('Role change not permitted.');
  if (role === 'visitor' && (['bids', 'orders', 'reviews'].includes(table) || (table === 'post' && action === 'insert'))) throw new Error('An administrator must approve your application.');
  if (action === 'delete' && !((table === 'post' && row.poster_id === user.id) || (table === 'watchlist' && row.user_id === user.id))) throw new Error('You do not have permission to delete this record.');
  if (table === 'Users') {
    if (row.id === user.id) {
      if (values.type && !['user', 'vip'].includes(values.type)) throw new Error('Role change not permitted.');
      if (values.type && row.type === 'visitor') throw new Error('An administrator must approve your application.');
      return;
    }
    // Existing checkout, review and dispute flows update the transaction partner.
    const related = db.prepare('SELECT id FROM orders WHERE buyer = ? AND seller = ?').get(user.id, row.id);
    if (related && Object.keys(values).every(k => ['balance', 'rating', 'bad_review', 'suspended', 'warning', 'type'].includes(k))) return;
  }
  if (table === 'post' && (row.poster_id === user.id || (action === 'update' && Object.keys(values).length > 0 && Object.keys(values).every(k => ['current_bid', 'highest_bidder', 'comments', 'status'].includes(k))))) return;
  if (table === 'bids' && row.bidder_id === user.id) return;
  if (table === 'orders' && row.buyer === user.id) return;
  if ((table === 'watchlist' || table === 'application') && row.user_id === user.id) return;
  if (table === 'issues' && (row.issuer === user.id || row.issuee === user.id)) return;
  if (table === 'reviews' && row.reviewer === user.id) return;
  throw new Error('You do not have permission to change this record.');
}
export function executeQuery(query: Query, user: User | null): Result {
  try {
    const db = getDatabase();
    columns(query.table);
    if (!['select', 'insert', 'update', 'delete'].includes(query.action)) throw new Error('Invalid action.');
    if (query.action !== 'select' && !user) throw new Error('Please log in first.');
    const admin = !!user && (db.prepare('SELECT type FROM Users WHERE id = ?').get(user.id) as Row)?.type === 'super-user';
    const params: (string | number | null)[] = [];
    const condition = (column: string, op: string, value: unknown) => {
      const name = identifier(query.table, column);
      const operators: Record<string, string> = { eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=', is: 'IS', notis: 'IS NOT' };
      if (!operators[op]) throw new Error('Unsupported filter.');
      params.push(encode(value));
      return `${name} ${operators[op]} ?`;
    };
    const conditions = (query.filters || []).map(f => condition(f.column, f.op, f.value));
    if (query.or) {
      conditions.push('(' + query.or.split(',').map(filter => {
        const [column, op, ...rest] = filter.split('.');
        return condition(column, op, rest.join('.'));
      }).join(' OR ') + ')');
    }
    if (!admin && ['orders', 'issues', 'application', 'watchlist'].includes(query.table)) {
      const ownerColumns: Record<string, string[]> = { orders: ['buyer', 'seller'], issues: ['issuer', 'issuee'], application: ['user_id'], watchlist: ['user_id'] };
      conditions.push('(' + ownerColumns[query.table].map(c => { params.push(user?.id || ''); return `"${c}" = ?`; }).join(' OR ') + ')');
    }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const run = () => {
      let rows: Row[];
      if (query.action === 'insert') {
        const input = Array.isArray(query.values) ? query.values : [query.values];
        rows = input.map(value => {
          if (!value) throw new Error('Missing values.');
          const row = { ...value, id: randomUUID(), created_at: new Date().toISOString() };
          canWrite(query.table, row, value, user!, admin, query.action);
          const keys = Object.keys(row);
          db.prepare(`INSERT INTO "${query.table}" (${keys.map(k => identifier(query.table, k)).join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map(k => encode(row[k])));
          return db.prepare(`SELECT * FROM "${query.table}" WHERE id = ?`).get(row.id) as Row;
        });
      } else {
        rows = db.prepare(`SELECT * FROM "${query.table}"${where}`).all(...params) as Row[];
        if (query.action !== 'select') {
          const values = (query.values || {}) as Row;
          if (query.action === 'update' && !Object.keys(values).length) throw new Error('Missing values.');
          if ('id' in values || 'created_at' in values) throw new Error('Cannot change record identity.');
          for (const row of rows) {
            canWrite(query.table, row, values, user!, admin, query.action);
            if (query.action === 'delete') db.prepare(`DELETE FROM "${query.table}" WHERE id = ?`).run(row.id);
            else {
              const keys = Object.keys(values);
              db.prepare(`UPDATE "${query.table}" SET ${keys.map(k => `${identifier(query.table, k)} = ?`).join(',')} WHERE id = ?`).run(...keys.map(k => encode(values[k])), row.id);
              Object.assign(row, values);
            }
          }
        }
      }
      const count = rows.length;
      if (query.order) {
        const { column, ascending } = query.order;
        identifier(query.table, column);
        rows.sort((a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0) * (ascending ? 1 : -1));
      }
      if (query.limit != null) {
        if (!Number.isInteger(query.limit) || query.limit < 0) throw new Error('Invalid limit.');
        rows = rows.slice(0, query.limit);
      }
      const data = query.columns === 'count' ? [{ count }] : rows.map(row => project(query.table, row, query.columns || '*'));
      if (query.single && (data.length > 1 || (!query.optional && data.length === 0))) throw new Error('Expected one record.');
      return { data: query.single ? data[0] || null : data, error: null, ...(query.count ? { count } : {}) };
    };
    return db.transaction(run)();
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : 'Database request failed.' } };
  }
}
