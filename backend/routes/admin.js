// ═══════════════════════════════════════════════════════════════════
// Admin routes — /api/admin/*
// Analytics, audit log access, historical database, exports.
// All analytics enforce anonymization at query layer (BR-13).
// ═══════════════════════════════════════════════════════════════════
const express = require('express');
const db = require('../db/connection');
const { requireAuth, requireRole } = require('../middleware/auth');
const audit = require('../utils/audit');

const router = express.Router();

// ─── GET /api/admin/analytics — anonymized aggregate metrics ─────────
router.get('/analytics', requireAuth, requireRole('admin','instructor'), (req, res) => {
  const { department, semester } = req.query;
  const filters = [];
  const params = [];
  if (department && department !== 'all') {
    filters.push('i.department = ?');
    params.push(department);
  }
  if (semester && semester !== 'all') {
    filters.push('c.term = ?');
    params.push(semester);
  }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  // By-department counts
  const byDepartment = db.prepare(`
    SELECT i.department AS dept,
           SUM(CASE WHEN r.status IN ('Approved','Final Approved','Scheduled','Approved with Conditions','Partial Approval') THEN 1 ELSE 0 END) AS approved,
           SUM(CASE WHEN r.status = 'Denied' THEN 1 ELSE 0 END) AS denied,
           SUM(CASE WHEN r.status = 'Pending' THEN 1 ELSE 0 END) AS pending,
           COUNT(*) AS total
    FROM excuse_requests r
    JOIN courses c     ON c.course_id = r.course_id
    JOIN instructors i ON i.user_id = c.instructor_id
    ${where}
    GROUP BY i.department
  `).all(...params);

  // Category breakdown
  const byCategory = db.prepare(`
    SELECT COALESCE(r.category,'Other') AS category, COUNT(*) AS count
    FROM excuse_requests r
    JOIN courses c     ON c.course_id = r.course_id
    JOIN instructors i ON i.user_id = c.instructor_id
    ${where}
    GROUP BY r.category
  `).all(...params);

  // Status breakdown
  const byStatus = db.prepare(`
    SELECT r.status, COUNT(*) AS count
    FROM excuse_requests r
    JOIN courses c     ON c.course_id = r.course_id
    JOIN instructors i ON i.user_id = c.instructor_id
    ${where}
    GROUP BY r.status
  `).all(...params);

  // Weekly trend
  const weeklyTrend = db.prepare(`
    SELECT strftime('%Y-W%W', r.submission_timestamp_utc) AS week, COUNT(*) AS count
    FROM excuse_requests r
    JOIN courses c     ON c.course_id = r.course_id
    JOIN instructors i ON i.user_id = c.instructor_id
    ${where}
    GROUP BY week
    ORDER BY week DESC
    LIMIT 8
  `).all(...params);

  // Totals
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN r.status = 'Pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN r.status IN ('Approved','Final Approved','Scheduled','Approved with Conditions','Partial Approval') THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN r.status = 'Denied' THEN 1 ELSE 0 END) AS denied,
      AVG(CASE
        WHEN r.decision_timestamp_utc IS NOT NULL
        THEN (julianday(r.decision_timestamp_utc) - julianday(r.submission_timestamp_utc)) * 24
        ELSE NULL
      END) AS avg_response_hours
    FROM excuse_requests r
    JOIN courses c     ON c.course_id = r.course_id
    JOIN instructors i ON i.user_id = c.instructor_id
    ${where}
  `).get(...params);

  // High-risk students (>3 requests) — anonymized (count only, no identities)
  const highRiskCount = db.prepare(`
    SELECT COUNT(*) AS n FROM (
      SELECT r.student_id
      FROM excuse_requests r
      JOIN courses c     ON c.course_id = r.course_id
      JOIN instructors i ON i.user_id = c.instructor_id
      ${where}
      GROUP BY r.student_id
      HAVING COUNT(*) > 3
    )
  `).get(...params).n;

  // Flagged instructors — avg response > 48h OR pending >5d
  const flaggedInstructors = db.prepare(`
    SELECT u.name AS name, i.department AS dept,
           AVG(CASE WHEN r.decision_timestamp_utc IS NOT NULL
               THEN (julianday(r.decision_timestamp_utc) - julianday(r.submission_timestamp_utc)) * 24
               ELSE NULL END) AS avg_hours,
           SUM(CASE WHEN r.status = 'Pending'
               AND julianday('now') - julianday(r.submission_timestamp_utc) > 5
               THEN 1 ELSE 0 END) AS stale_pending
    FROM excuse_requests r
    JOIN courses c     ON c.course_id = r.course_id
    JOIN instructors i ON i.user_id = c.instructor_id
    JOIN users u       ON u.user_id = i.user_id
    GROUP BY i.user_id
    HAVING avg_hours > 48 OR stale_pending > 0
  `).all();

  audit.log({
    actor: req.user.userId,
    action: 'Analytics Queried',
    details: `Dept: ${department || 'all'} · Semester: ${semester || 'all'}`
  });

  res.json({
    totals,
    byDepartment,
    byCategory,
    byStatus,
    weeklyTrend,
    highRiskCount,
    flaggedInstructors
  });
});

// ─── GET /api/admin/audit — tamper-proof audit log ───────────────────
router.get('/audit', requireAuth, requireRole('admin'), (req, res) => {
  const { limit = 100, requestId, from, to } = req.query;
  const filters = [];
  const params = [];
  if (requestId) { filters.push('request_id = ?'); params.push(requestId); }
  if (from) { filters.push('timestamp_utc >= ?'); params.push(from); }
  if (to) { filters.push('timestamp_utc <= ?'); params.push(to); }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  const entries = db.prepare(`
    SELECT a.*, u.name AS actor_name
    FROM audit_log a
    LEFT JOIN users u ON u.user_id = a.actor_user_id
    ${where}
    ORDER BY log_id DESC
    LIMIT ?
  `).all(...params, parseInt(limit));

  res.json({ entries, count: entries.length });
});

// ─── GET /api/admin/audit/verify — verify hash chain integrity ───────
router.get('/audit/verify', requireAuth, requireRole('admin'), (req, res) => {
  const result = audit.verifyChain();
  audit.log({
    actor: req.user.userId,
    action: 'Audit Chain Verified',
    details: `Valid: ${result.valid} · Total: ${result.total}`
  });
  res.json(result);
});

// ─── POST /api/admin/export — logged export (PDF/CSV) ────────────────
router.post('/export', requireAuth, requireRole('admin','instructor'), (req, res) => {
  const { scope, format } = req.body;
  audit.log({
    actor: req.user.userId,
    action: 'Data Exported',
    details: `Scope: ${scope} · Format: ${format}`
  });
  res.json({ ok: true, message: 'Export event recorded in audit trail' });
});

// ─── GET /api/admin/historical — read-only historical DB (SCRUM-7) ───
router.get('/historical', requireAuth, requireRole('admin','instructor'), (req, res) => {
  const { course, status, category, q } = req.query;
  const filters = [];
  const params = [];
  if (course) { filters.push('r.course_id = ?'); params.push(course); }
  if (status) { filters.push('r.status = ?'); params.push(status); }
  if (category) { filters.push('r.category = ?'); params.push(category); }
  if (q) {
    filters.push('(r.request_id LIKE ? OR u.name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  const rows = db.prepare(`
    SELECT r.request_id, r.course_id, c.course_name, c.term AS semester,
           r.absence_date, r.category, r.status, r.decision_timestamp_utc,
           r.submission_timestamp_utc,
           CASE WHEN r.decision_timestamp_utc IS NOT NULL
             THEN ROUND((julianday(r.decision_timestamp_utc) - julianday(r.submission_timestamp_utc)) * 24, 1)
             ELSE NULL END AS response_hours
    FROM excuse_requests r
    JOIN courses c ON c.course_id = r.course_id
    JOIN users u   ON u.user_id = r.student_id
    ${where}
    ORDER BY r.submission_timestamp_utc DESC
  `).all(...params);

  res.json({ records: rows, total: rows.length });
});

module.exports = router;
