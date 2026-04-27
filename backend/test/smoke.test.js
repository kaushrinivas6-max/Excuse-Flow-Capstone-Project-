// ═══════════════════════════════════════════════════════════════════
// Smoke test — minimal dependency-free assertions for CI
// Exercises the audit-chain, auth, and request lifecycle.
// Run: node test/smoke.test.js
// ═══════════════════════════════════════════════════════════════════
const assert = require('assert');
const path   = require('path');
const fs     = require('fs');

// Use an isolated test DB
process.env.DB_PATH = path.join(__dirname, 'test.db');
if (fs.existsSync(process.env.DB_PATH)) fs.unlinkSync(process.env.DB_PATH);

const db    = require('../db/connection');
const audit = require('../utils/audit');
const { seed } = require('../utils/seed');

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('  ✓ ' + name);
    passed++;
  } catch (err) {
    console.log('  ✗ ' + name);
    console.log('    ' + err.message);
    failed++;
  }
}

console.log('\n▸ Running smoke tests\n');

// ─── Database ─────────────────────────────────────────────
console.log('Database:');
test('schema creates all expected tables', () => {
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table'"
  ).all().map(r => r.name);
  const expected = [
    'users', 'students', 'instructors', 'teaching_assistants',
    'institution_admins', 'courses', 'enrollments', 'excuse_requests',
    'supporting_documents', 'notifications', 'audit_log',
    'request_comments', 'retake_configurations', 'booked_retakes',
    'ta_logistics_messages'
  ];
  expected.forEach(t =>
    assert(tables.includes(t), `missing table: ${t}`)
  );
});

test('genesis audit entry exists on fresh DB', () => {
  const n = db.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n;
  assert(n >= 1, 'no genesis entry');
});

// ─── Seeding ──────────────────────────────────────────────
console.log('\nSeeding:');
test('seed script runs without error', () => {
  seed();
});

test('seed creates 12 users', () => {
  const n = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  assert.strictEqual(n, 12, 'expected 12 users, got ' + n);
});

test('seed creates 8 excuse requests', () => {
  const n = db.prepare('SELECT COUNT(*) AS n FROM excuse_requests').get().n;
  assert.strictEqual(n, 8, 'expected 8 requests, got ' + n);
});

test('seed creates 4 courses', () => {
  const n = db.prepare('SELECT COUNT(*) AS n FROM courses').get().n;
  assert.strictEqual(n, 4, 'expected 4 courses, got ' + n);
});

// ─── Audit chain ──────────────────────────────────────────
console.log('\nAudit chain:');
test('hash chain is valid after seed', () => {
  const result = audit.verifyChain();
  assert.strictEqual(result.valid, true, 'chain broken at ' + result.brokenAt);
});

test('appending an entry preserves chain validity', () => {
  audit.log({
    actor: 'USR-010',
    action: 'Test Event',
    requestId: 'EF-2026-00142',
    details: 'smoke-test entry'
  });
  const result = audit.verifyChain();
  assert.strictEqual(result.valid, true);
});

test('tampering with a prior entry is detected', () => {
  // Mutate a mid-chain entry
  db.prepare('UPDATE audit_log SET details = ? WHERE log_id = 3').run('TAMPERED');
  const result = audit.verifyChain();
  assert.strictEqual(result.valid, false, 'tampering went undetected');
});

// ─── Business rules ───────────────────────────────────────
console.log('\nBusiness rules:');
test('password hashes are stored (not plaintext)', () => {
  const u = db.prepare('SELECT password_hash FROM users LIMIT 1').get();
  assert(u.password_hash.startsWith('$2'), 'passwords not bcrypted');
});

test('DSS student has 1.5x multiplier (Aisha Patel)', () => {
  const s = db.prepare('SELECT * FROM students WHERE student_id = ?')
    .get('STU-61045');
  assert.strictEqual(s.dss_status, 1);
  assert.strictEqual(s.dss_multiplier, 1.5);
});

test('Approved with Conditions request has JSON conditions', () => {
  const r = db.prepare('SELECT conditions FROM excuse_requests WHERE request_id = ?')
    .get('EF-2026-00151');
  const conditions = JSON.parse(r.conditions);
  assert(Array.isArray(conditions));
  assert(conditions.length >= 1);
});

// ─── Summary ──────────────────────────────────────────────
console.log('');
console.log(`▸ Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

// Clean up test DB
try { fs.unlinkSync(process.env.DB_PATH); } catch {}
process.exit(0);
