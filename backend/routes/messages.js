// ═══════════════════════════════════════════════════════════════════
// Direct Messages — /api/messages/*
// Any-to-any messaging between users. Real-time via SSE.
// ═══════════════════════════════════════════════════════════════════
const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');
const audit = require('../utils/audit');
const { publish } = require('../utils/events');
const { generateNotificationId } = require('../utils/ids');

const router = express.Router();

// GET /api/messages — inbox (sent + received)
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT m.*,
           s.name AS sender_name, s.role AS sender_role,
           r.name AS recipient_name, r.role AS recipient_role
    FROM direct_messages m
    JOIN users s ON s.user_id = m.sender_id
    JOIN users r ON r.user_id = m.recipient_id
    WHERE m.sender_id = ? OR m.recipient_id = ?
    ORDER BY m.sent_timestamp_utc DESC
    LIMIT 200
  `).all(req.user.userId, req.user.userId);
  res.json({ messages: rows });
});

// GET /api/messages/contacts — everyone you can message
router.get('/contacts', requireAuth, (req, res) => {
  const users = db.prepare(`
    SELECT user_id, name, email, role FROM users
    WHERE user_id != ? AND user_id != 'SYSTEM'
      AND role IN ('student','instructor','ta','admin')
    ORDER BY role, name
  `).all(req.user.userId);
  res.json({ contacts: users });
});

// POST /api/messages — send
router.post('/', requireAuth, (req, res) => {
  const { recipientId, subject, body, requestId } = req.body || {};
  if (!recipientId || !body || !body.trim()) {
    return res.status(400).json({ error: 'Recipient and message body are required' });
  }
  const recipient = db.prepare('SELECT user_id, name, role FROM users WHERE user_id = ?').get(recipientId);
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

  const result = db.prepare(`
    INSERT INTO direct_messages (sender_id, recipient_id, subject, body, request_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.userId, recipientId, subject || null, body.trim(), requestId || null);

  const senderName = db.prepare('SELECT name FROM users WHERE user_id = ?').get(req.user.userId)?.name || 'Someone';

  // Also drop a notification so the bell lights up
  db.prepare(`
    INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
    VALUES (?, ?, ?, 'InApp', ?)
  `).run(generateNotificationId(), recipientId, requestId || null,
         `Message from ${senderName}: ${body.slice(0, 80)}${body.length > 80 ? '…' : ''}`);

  audit.log({
    actor: req.user.userId,
    action: 'Message Sent',
    requestId: requestId || null,
    details: `To: ${recipient.name} (${recipient.role}) · ${body.slice(0, 60)}`
  });

  // Real-time push
  publish('message_received', {
    messageId: result.lastInsertRowid,
    from: senderName,
    fromRole: req.user.role,
    subject: subject || null,
    preview: body.slice(0, 120),
    requestId: requestId || null,
  }, recipientId);

  res.status(201).json({ messageId: result.lastInsertRowid });
});

// POST /api/messages/:id/read — mark read
router.post('/:id/read', requireAuth, (req, res) => {
  db.prepare(`
    UPDATE direct_messages SET read_status = 1
    WHERE message_id = ? AND recipient_id = ?
  `).run(req.params.id, req.user.userId);
  res.json({ ok: true });
});

module.exports = router;
