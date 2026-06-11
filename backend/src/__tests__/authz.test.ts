/**
 * Authorization unit tests for the P0 fix (emergency access control).
 * Uses Node's built-in test runner — no extra dependencies.
 *
 * Run: npm run build && npm test
 */
import { test } from 'node:test';
import * as assert from 'node:assert';
import { evaluateEmergencyAccess } from '../utils/authz';

const OWNER = 'user-owner';
const HELPER = 'user-helper';
const PENDING = 'user-pending';
const STRANGER = 'user-stranger';

const emergency = { user_id: OWNER };
const participants = [
  { user_id: HELPER, status: 'accepted' },
  { user_id: PENDING, status: 'pending' },
];

test('owner can view and participate', () => {
  const a = evaluateEmergencyAccess(emergency, participants, OWNER);
  assert.strictEqual(a.canView, true);
  assert.strictEqual(a.canParticipate, true);
  assert.strictEqual(a.isOwner, true);
});

test('accepted participant can view and participate', () => {
  const a = evaluateEmergencyAccess(emergency, participants, HELPER);
  assert.strictEqual(a.canView, true);
  assert.strictEqual(a.canParticipate, true);
  assert.strictEqual(a.isOwner, false);
});

test('pending participant can view but not participate', () => {
  const a = evaluateEmergencyAccess(emergency, participants, PENDING);
  assert.strictEqual(a.canView, true);
  assert.strictEqual(a.canParticipate, false);
});

test('SECURITY: a stranger can neither view nor participate', () => {
  const a = evaluateEmergencyAccess(emergency, participants, STRANGER);
  assert.strictEqual(a.canView, false);
  assert.strictEqual(a.canParticipate, false);
});

test('missing emergency denies everything', () => {
  const a = evaluateEmergencyAccess(null, [], OWNER);
  assert.strictEqual(a.canView, false);
  assert.strictEqual(a.canParticipate, false);
});

test('uuid-vs-string id coercion does not bypass the check', () => {
  // user_ids may arrive as different types from pg / JWT — must still match
  const a = evaluateEmergencyAccess({ user_id: '42' } as any, [], 42 as any);
  assert.strictEqual(a.canView, true);
});
