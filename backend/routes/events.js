// ═══════════════════════════════════════════════════════════════════
// Real-time Events — /api/events
// Server-Sent Events stream. Browser connects once, server pushes events.
// ═══════════════════════════════════════════════════════════════════
const express = require('express');
const jwt = require('jsonwebtoken');
const { subscribe } = require('../utils/events');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  // EventSource can't send headers — accept token via query
  const token = req.query.token;
  if (!token) return res.status(401).end();

  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).end();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ userId: user.userId, role: user.role })}\n\n`);

  // Heartbeat every 20s to keep proxies happy
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000);

  // Subscribe to bus
  const unsubscribe = subscribe((envelope) => {
    const aud = envelope.audience;
    const send = aud === 'broadcast'
      || aud === user.userId
      || aud === user.role
      || (Array.isArray(aud) && aud.includes(user.userId))
      || (Array.isArray(aud) && aud.includes(user.role));
    if (send) {
      res.write(`event: ${envelope.type}\ndata: ${JSON.stringify(envelope.payload)}\n\n`);
    }
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

module.exports = router;
