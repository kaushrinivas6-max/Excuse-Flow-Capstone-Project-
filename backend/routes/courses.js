// ═══════════════════════════════════════════════════════════════════
// Courses & Enrollment — /api/courses/*
// Now supports unlimited user-created courses with self-enrollment.
// ═══════════════════════════════════════════════════════════════════
const express = require('express');
const db = require('../db/connection');
const { requireAuth, requireRole } = require('../middleware/auth');
const audit = require('../utils/audit');
const { publish } = require('../utils/events');

const router = express.Router();

// All courses (browse)
router.get('/', requireAuth, (req, res) => {
  const courses = db.prepare(`
    SELECT c.*, u.name AS instructor_name
    FROM courses c
    JOIN users u ON u.user_id = c.instructor_id
    ORDER BY c.course_name
  `).all();
  res.json({ courses });
});

// My enrolled / taught courses
router.get('/mine', requireAuth, (req, res) => {
  let courses;
  if (req.user.role === 'student') {
    courses = db.prepare(`
      SELECT c.*, u.name AS instructor_name,
             CASE WHEN c.created_by_id = ? THEN 1 ELSE 0 END AS is_owner
      FROM courses c
      JOIN enrollments e ON e.course_id = c.course_id
      JOIN users u ON u.user_id = c.instructor_id
      WHERE e.student_id = ?
      ORDER BY c.course_name
    `).all(req.user.userId, req.user.userId);
  } else if (req.user.role === 'instructor') {
    courses = db.prepare(`
      SELECT c.*, u.name AS instructor_name
      FROM courses c
      JOIN users u ON u.user_id = c.instructor_id
      WHERE c.instructor_id = ?
      ORDER BY c.course_name
    `).all(req.user.userId);
  } else {
    courses = db.prepare(`
      SELECT c.*, u.name AS instructor_name
      FROM courses c JOIN users u ON u.user_id = c.instructor_id
      ORDER BY c.course_name
    `).all();
  }
  res.json({ courses });
});

// Create a course (student self-service, unlimited)
router.post('/', requireAuth, requireRole('student'), (req, res) => {
  const {
    courseId, courseName, section, instructorName, term,
    meetingDays, meetingTime, meetingDuration, color,
  } = req.body;

  if (!courseId || !courseName || !instructorName) {
    return res.status(400).json({ error: 'Course ID, name, and instructor are required.' });
  }

  const cid = String(courseId).trim().toUpperCase();

  if (db.prepare('SELECT 1 FROM courses WHERE course_id = ?').get(cid)) {
    return res.status(409).json({ error: `Course ${cid} already exists. Use Enroll instead.` });
  }

  // Try matching an existing instructor by name; otherwise create a placeholder
  let instructorUserId;
  const match = db.prepare(`
    SELECT u.user_id FROM users u
    JOIN instructors i ON i.user_id = u.user_id
    WHERE LOWER(u.name) = LOWER(?) LIMIT 1
  `).get(instructorName);

  if (match) {
    instructorUserId = match.user_id;
  } else {
    instructorUserId = 'INS-' + Date.now().toString(36).toUpperCase();
    const safe = instructorName.toLowerCase().replace(/[^a-z]/g, '.');
    const email = `${safe}.${Date.now()}@placeholder.edu`;
    db.prepare(`
      INSERT INTO users (user_id, name, email, password_hash, role)
      VALUES (?, ?, ?, 'N/A', 'instructor')
    `).run(instructorUserId, instructorName, email);
    db.prepare(`INSERT INTO instructors (user_id, department) VALUES (?, 'Custom')`)
      .run(instructorUserId);
  }

  db.prepare(`
    INSERT INTO courses
      (course_id, course_name, section, term, instructor_id, instructor_name_override,
       meeting_days, meeting_time, meeting_duration, color, user_created, created_by_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    cid, courseName, section || '001',
    term || 'Spring 2026', instructorUserId, instructorName,
    (meetingDays || 'MWF').toUpperCase(),
    meetingTime || '10:00',
    parseInt(meetingDuration) || 60,
    color || '#C5841F', req.user.userId
  );

  // Auto-enroll the creator
  db.prepare('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?, ?)')
    .run(req.user.userId, cid);

  audit.log({
    actor: req.user.userId,
    action: 'Course Added',
    details: `${cid} — ${courseName} (${instructorName})`
  });

  publish('course_added', { courseId: cid, courseName }, req.user.userId);

  res.status(201).json({
    course: {
      courseId: cid, courseName,
      section: section || '001',
      instructorName,
      meetingDays: (meetingDays || 'MWF').toUpperCase(),
      meetingTime: meetingTime || '10:00',
    }
  });
});

// Create a course as an INSTRUCTOR (they teach it)
router.post('/instructor', requireAuth, requireRole('instructor'), (req, res) => {
  const { courseCode, courseName, section, term, meetingDays, meetingTime } = req.body || {};
  if (!courseCode || !courseName) {
    return res.status(400).json({ error: 'Course code and name are required.' });
  }
  const code = String(courseCode).trim().toUpperCase();
  const sect = String(section || '001').trim();
  const cid = `${code}-${sect}`;

  if (db.prepare('SELECT 1 FROM courses WHERE course_id = ?').get(cid)) {
    return res.status(409).json({ error: `${cid} already exists. Try a different section.` });
  }

  db.prepare(`
    INSERT INTO courses (course_id, course_name, section, term, instructor_id,
                         meeting_days, meeting_time, user_created, created_by_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(cid, courseName, sect, term || 'Spring 2026', req.user.userId,
         (meetingDays || 'MWF').toUpperCase(), meetingTime || '10:00', req.user.userId);

  audit.log({
    actor: req.user.userId,
    action: 'Course Created',
    details: `${cid} — ${courseName}`
  });
  publish('course_added', { courseId: cid, courseName }, req.user.userId);

  res.status(201).json({
    course: { courseId: cid, courseName, section: sect }
  });
});

router.post('/:id/enroll', requireAuth, requireRole('student'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE course_id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  db.prepare('INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?, ?)')
    .run(req.user.userId, req.params.id);
  audit.log({
    actor: req.user.userId,
    action: 'Self-Enrolled',
    details: `${req.params.id} — ${course.course_name}`
  });
  res.json({ ok: true });
});

router.delete('/:id/enroll', requireAuth, requireRole('student'), (req, res) => {
  db.prepare('DELETE FROM enrollments WHERE student_id = ? AND course_id = ?')
    .run(req.user.userId, req.params.id);
  audit.log({ actor: req.user.userId, action: 'Dropped Course', details: req.params.id });
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, requireRole('student'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE course_id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  if (!course.user_created || course.created_by_id !== req.user.userId) {
    return res.status(403).json({ error: 'You can only delete courses you created.' });
  }
  db.prepare('DELETE FROM courses WHERE course_id = ?').run(req.params.id);
  audit.log({ actor: req.user.userId, action: 'Course Deleted', details: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
