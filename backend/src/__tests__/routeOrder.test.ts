/**
 * Regression test: /emergencies/history must be matched BEFORE /emergencies/:id,
 * otherwise Express treats "history" as an emergency id (this was a live bug —
 * the history endpoint 500'd on the uuid cast).
 *
 * We assert on the router's layer order without booting a server or DB.
 */
import { test } from 'node:test';
import * as assert from 'node:assert';

// Importing the router pulls in db.ts which creates (but does not connect) a pg pool.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
import emergencyRouter from '../routes/emergencies';

function routeIndex(router: any, method: string, path: string): number {
  const stack = router.stack || [];
  for (let i = 0; i < stack.length; i++) {
    const layer = stack[i];
    if (layer.route && layer.route.path === path && layer.route.methods[method]) {
      return i;
    }
  }
  return -1;
}

test('GET /history is registered before GET /:id', () => {
  const historyIdx = routeIndex(emergencyRouter, 'get', '/history');
  const idIdx = routeIndex(emergencyRouter, 'get', '/:id');
  assert.ok(historyIdx >= 0, 'GET /history route exists');
  assert.ok(idIdx >= 0, 'GET /:id route exists');
  assert.ok(historyIdx < idIdx, `/history (${historyIdx}) must come before /:id (${idIdx})`);
});

test('GET /pending and /active are registered before GET /:id', () => {
  const idIdx = routeIndex(emergencyRouter, 'get', '/:id');
  for (const p of ['/pending', '/active']) {
    const idx = routeIndex(emergencyRouter, 'get', p);
    assert.ok(idx >= 0 && idx < idIdx, `${p} must come before /:id`);
  }
});
