// ═══════════════════════════════════════════════════════════════════
// ID generators
// ═══════════════════════════════════════════════════════════════════
const crypto = require('crypto');
const db = require('../db/connection');

function generateRequestId() {
  const year = new Date().getFullYear();
  const row = db.prepare(`
    SELECT request_id FROM excuse_requests
    WHERE request_id LIKE ?
    ORDER BY request_id DESC LIMIT 1
  `).get(`EF-${year}-%`);

  let next = 1;
  if (row) {
    const last = parseInt(row.request_id.split('-').pop(), 10);
    next = last + 1;
  }
  return `EF-${year}-${String(next).padStart(5, '0')}`;
}

function generateDocumentId() {
  return 'DOC-' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

function generateNotificationId() {
  return 'NOTIF-' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

module.exports = { generateRequestId, generateDocumentId, generateNotificationId };
