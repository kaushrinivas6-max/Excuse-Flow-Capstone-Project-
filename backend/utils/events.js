// ═══════════════════════════════════════════════════════════════════
// Events — in-memory pub/sub for Server-Sent Events (real-time push)
// Routes call publish(); /api/events streams to connected browsers.
// ═══════════════════════════════════════════════════════════════════
const EventEmitter = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(200);

function publish(type, payload, audience = 'broadcast') {
  const envelope = {
    type, payload, audience,
    timestamp: new Date().toISOString()
  };
  bus.emit('event', envelope);
  return envelope;
}

function subscribe(listener) {
  bus.on('event', listener);
  return () => bus.off('event', listener);
}

module.exports = { publish, subscribe };
