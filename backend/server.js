// ═══════════════════════════════════════════════════════════════════
// ExcuseFlow Backend — Main Entry Point
//
// Security layers (D4 §8):
//   • helmet            — sets secure HTTP headers
//   • express-rate-limit — mitigates brute-force / DDoS
//   • CORS              — explicit origin allow-list
//   • JWT + bcrypt      — authentication
//   • RBAC              — per-route role enforcement
//   • Hash-chained audit — tamper-evident logging
// ═══════════════════════════════════════════════════════════════════
require('dotenv').config();

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const path        = require('path');
const rateLimit   = require('express-rate-limit');

// Initialize DB (runs schema + ensures genesis audit entry)
require('./db/connection');

const authRoutes         = require('./routes/auth');
const requestRoutes      = require('./routes/requests');
const courseRoutes       = require('./routes/courses');
const notificationRoutes = require('./routes/notifications');
const adminRoutes        = require('./routes/admin');
const taRoutes           = require('./routes/ta');
const eventRoutes        = require('./routes/events');
const videoRoutes        = require('./routes/videos');
const messageRoutes      = require('./routes/messages');
const audit              = require('./utils/audit');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Security middleware ────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,   // disabled so CDN Chart.js works in demo
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Global rate limit — 2000 requests / 15 min per IP (generous for demos)
// SSE and auth excluded so live demos never trip it.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/events') || req.path.startsWith('/auth')
}));

// ─── Request logger (simple) ────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// ─── API routes ─────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/requests',      requestRoutes);
app.use('/api/courses',       courseRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/ta',            taRoutes);
app.use('/api/retakes',       taRoutes);  // retake endpoints mounted under both
app.use('/api/events',        eventRoutes);  // SSE real-time stream
app.use('/api/videos',        videoRoutes);  // lecture video library
app.use('/api/messages',      messageRoutes);  // direct messages between users

// ─── Health check ───────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const chain = audit.verifyChain();
  res.json({
    status: 'ok',
    service: 'ExcuseFlow API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    auditChain: chain
  });
});

// ─── Static frontend (single-origin hosting) ────────────────────────
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ─── Error handler ──────────────────────────────────────────────────
// Multer and other middleware errors land here
app.use((err, req, res, next) => {
  console.error('Error on', req.method, req.originalUrl, '—', err.message);
  if (err.stack) console.error(err.stack);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File exceeds 5MB limit.' });
  }
  if (err.message && err.message.includes('Only PDF, JPG, PNG')) {
    return res.status(400).json({ error: err.message });
  }
  // Show real error in dev; hide internals in production
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error: isDev ? err.message : 'Internal server error',
    ...(isDev && err.code ? { code: err.code } : {})
  });
});

// ─── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  ExcuseFlow API — FERPA Compliant v1.0           ║');
  console.log('║  Blackboard Administrative Workflow Extension    ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  → Listening on http://localhost:${PORT}`);
  console.log(`  → Health check: http://localhost:${PORT}/api/health`);
  console.log('');
});

module.exports = app;
