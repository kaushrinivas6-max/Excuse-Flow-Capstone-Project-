// ═══════════════════════════════════════════════════════════════════
// Notifications — /api/notifications/*
// ═══════════════════════════════════════════════════════════════════
const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET my notifications
router.get('/', requireAuth, (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE recipient_id = ?
    ORDER BY sent_timestamp_utc DESC
    LIMIT 50
  `).all(req.user.userId);

  const unread = notifications.filter(n => !n.read_status).length;
  res.json({ notifications, unread });
});

// Mark as read
router.post('/:id/read', requireAuth, (req, res) => {
  db.prepare(`
    UPDATE notifications SET read_status = 1
    WHERE notification_id = ? AND recipient_id = ?
  `).run(req.params.id, req.user.userId);
  res.json({ ok: true });
});

// Mark all as read
router.post('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read_status = 1 WHERE recipient_id = ?')
    .run(req.user.userId);
  res.json({ ok: true });
});

module.exports = router;
