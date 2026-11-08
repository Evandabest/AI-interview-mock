import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSameOrigin } from '../lib/local/origin';

test('origin validation accepts the browser host and rejects cross-origin writes', () => {
  const request = (origin?: string, host = '127.0.0.1:3012') => ({
    headers: new Headers({ host, ...(origin ? { origin } : {}) }), nextUrl: { protocol: 'http:' },
  });
  assert.equal(isSameOrigin(request('http://127.0.0.1:3012')), true);
  assert.equal(isSameOrigin(request('http://localhost:3000', 'localhost:3000')), true);
  assert.equal(isSameOrigin(request('http://example.com')), false);
  assert.equal(isSameOrigin(request('http://127.0.0.1:3000')), false);
  assert.equal(isSameOrigin(request('https://127.0.0.1:3012')), false);
  assert.equal(isSameOrigin(request('null')), false);
  assert.equal(isSameOrigin(request()), true);
});
