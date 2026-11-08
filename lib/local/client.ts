import type { Query, Result, Row } from './types';

async function request(path: string, body?: unknown): Promise<any> {
  try {
    const response = await fetch(`/api/local/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    return await response.json();
  } catch (error) {
    return { data: null, error: { message: error instanceof Error ? error.message : 'Request failed.' } };
  }
}
class LocalQuery implements PromiseLike<Result> {
  private query: Query;
  constructor(table: string) { this.query = { table, action: 'select', columns: '*', filters: [] }; }
  select(columns = '*', options?: { count?: string }) { this.query.columns = columns; this.query.count = !!options?.count; return this; }
  insert(values: Row | Row[]) { this.query.action = 'insert'; this.query.values = values; return this; }
  update(values: Row) { this.query.action = 'update'; this.query.values = values; return this; }
  delete() { this.query.action = 'delete'; return this; }
  private filter(column: string, op: string, value: unknown) { this.query.filters.push({ column, op, value }); return this; }
  eq(column: string, value: unknown) { return this.filter(column, 'eq', value); }
  neq(column: string, value: unknown) { return this.filter(column, 'neq', value); }
  gte(column: string, value: unknown) { return this.filter(column, 'gte', value); }
  not(column: string, op: string, value: unknown) { return this.filter(column, op === 'is' ? 'notis' : op === 'eq' ? 'neq' : 'unsupported', value); }
  or(value: string) { this.query.or = value; return this; }
  order(column: string, options?: { ascending?: boolean }) { this.query.order = { column, ascending: options?.ascending ?? true }; return this; }
  limit(value: number) { this.query.limit = value; return this; }
  single() { this.query.single = true; return this; }
  maybeSingle() { this.query.single = true; this.query.optional = true; return this; }
  then<TResult1 = Result, TResult2 = never>(onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return request('query', this.query).then(onfulfilled, onrejected);
  }
}
const client = {
  from: (table: string) => new LocalQuery(table),
  auth: {
    async getUser() {
      const result = await request('auth');
      return { data: { user: result.data?.user ?? null }, error: result.error };
    },
    async getSession() {
      const result = await request('auth');
      return { data: { session: result.data?.user ? { user: result.data.user } : null }, error: result.error };
    },
    signOut: () => request('auth', { action: 'logout' }),
    deleteAccount: () => request('auth', { action: 'delete-account' }),
  },
  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: File) {
          try {
            const body = new FormData();
            body.set('file', file);
            const response = await fetch(`/api/local/files/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`, { method: 'POST', body });
            return await response.json();
          } catch { return { data: null, error: { message: 'Upload failed.' } }; }
        },
        getPublicUrl(path: string) { return { data: { publicUrl: `/api/local/files/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}` } }; },
      };
    },
  },
};
export function createClient() { return client; }
