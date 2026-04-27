// ═══════════════════════════════════════════════════════════════════
// Hash-chained audit log (SCRUM-19 — Tamper-Proof Communication Log)
// ═══════════════════════════════════════════════════════════════════
const crypto = require('crypto');
const db = require('../db/connection');

function computeHash(entry, previousHash) {
  const payload = [
    entry.timestamp_utc,
    entry.actor_user_id,
    entry.action_type,
    entry.request_id || '',
    entry.details || '',
    previousHash
  ].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function log({ actor, action, requestId = null, details = '' }) {
  const prev = db.prepare(
    'SELECT hash_value FROM audit_log ORDER BY log_id DESC LIMIT 1'
  ).get();
  const previousHash = prev ? prev.hash_value : '0'.repeat(64);

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const entry = {
    timestamp_utc: timestamp,
    actor_user_id: actor,
    action_type: action,
    request_id: requestId,
    details
  };

  const hash = computeHash(entry, previousHash);

  db.prepare(`
    INSERT INTO audit_log
      (timestamp_utc, action_type, actor_user_id, request_id, details, hash_value, previous_hash_value)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(timestamp, action, actor, requestId, details, hash, previousHash);

  return { ...entry, hash_value: hash, previous_hash_value: previousHash };
}

function verifyChain() {
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY log_id ASC').all();
  for (let i = 1; i < rows.length; i++) {
    const current = rows[i];
    const expectedPrev = rows[i - 1].hash_value;
    if (current.previous_hash_value !== expectedPrev) {
      return { valid: false, brokenAt: current.log_id, total: rows.length };
    }
    const recomputed = computeHash(current, expectedPrev);
    if (recomputed !== current.hash_value) {
      return { valid: false, brokenAt: current.log_id, total: rows.length };
    }
  }
  return { valid: true, total: rows.length };
}

module.exports = { log, verifyChain, computeHash };
