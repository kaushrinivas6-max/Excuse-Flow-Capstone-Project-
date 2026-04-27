// ═══════════════════════════════════════════════════════════════════
// Auth routes — /api/auth/*
// ═══════════════════════════════════════════════════════════════════
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db/connection');
const { signToken, requireAuth } = require('../middleware/auth');
const audit = require('../utils/audit');

const router = express.Router();

// ─── GET /api/auth/public/courses — list all courses for signup enrollment picker
router.get('/public/courses', (req, res) => {
  const courses = db.prepare(`
    SELECT c.course_id, c.course_name, c.section, c.term, c.instructor_id,
           u.name AS instructor_name
    FROM courses c
    LEFT JOIN users u ON u.user_id = c.instructor_id
    ORDER BY c.course_id
  `).all();
  res.json({ courses });
});

// ─── GET /api/auth/public/instructors — list instructors for TA supervisor picker
router.get('/public/instructors', (req, res) => {
  const instructors = db.prepare(`
    SELECT u.user_id, u.name, u.email, i.department
    FROM instructors i
    JOIN users u ON u.user_id = i.user_id
    ORDER BY u.name
  `).all();
  res.json({ instructors });
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,  // Generous for live demos — switching between 4 roles repeatedly is normal
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,  // only count failed attempts
  message: { error: 'Too many failed login attempts. Please wait a few minutes.' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,  // 20 new accounts per hour per IP — plenty for demo, blocks spam bots
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please wait and try again.' }
});

// ─── POST /api/auth/register — create a brand new account ─────────────
// Password bcrypt-hashed. Role-specific profile + routing setup done atomically:
//   Student: enrolled in courseIds[] (must pick at least one)
//   Instructor: optionally creates a new course in same transaction
//   TA: MUST supply supervisorId (can't TA without an instructor)
//   Admin: standalone
router.post('/register', registerLimiter, (req, res) => {
  const {
    name, email, password, role,
    classYear, major,                // student extras
    courseIds,                       // student: array of course_ids to enroll in
    department,                      // instructor: department name
    newCourse,                       // instructor: { courseId, courseName, section, term } optional
    supervisorId,                    // ta: required instructor user_id
    departmentScope                  // admin: department they administer
  } = req.body || {};

  // ─── Validation ───
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (!['student','instructor','ta','admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }
  if (name.trim().length < 2) {
    return res.status(400).json({ error: 'Please enter your full name.' });
  }

  // Role-specific routing validation
  if (role === 'ta') {
    if (!supervisorId) {
      return res.status(400).json({ error: 'TAs must select a supervising instructor.' });
    }
    const supervisor = db.prepare('SELECT user_id FROM instructors WHERE user_id = ?').get(supervisorId);
    if (!supervisor) {
      return res.status(400).json({ error: 'Selected supervisor does not exist.' });
    }
  }
  if (role === 'student' && Array.isArray(courseIds) && courseIds.length > 0) {
    const valid = db.prepare(`SELECT course_id FROM courses WHERE course_id IN (${courseIds.map(() => '?').join(',')})`).all(...courseIds);
    if (valid.length !== courseIds.length) {
      return res.status(400).json({ error: 'One or more selected courses do not exist.' });
    }
  }

  // Duplicate email check
  const existing = db.prepare('SELECT user_id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists. Try signing in instead.' });
  }

  // Generate next USR-NNN by role band (students 001-009, instructors 010-019, TAs 020-029, admins 030+)
  const prefixStart = { student: 100, instructor: 200, ta: 300, admin: 400 }[role];
  const existingIds = db.prepare(`SELECT user_id FROM users WHERE user_id LIKE 'USR-%'`)
    .all().map(r => parseInt(r.user_id.replace('USR-', ''))).filter(n => !isNaN(n));
  let nextNum = prefixStart;
  while (existingIds.includes(nextNum)) nextNum++;
  const userId = 'USR-' + String(nextNum).padStart(3, '0');

  const passwordHash = bcrypt.hashSync(password, 10);

  // ─── Atomic create: user + profile + routing hookups ───
  const createAccount = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (user_id, name, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, name.trim(), email.toLowerCase(), passwordHash, role);

    if (role === 'student') {
      // Generate a unique GWID — keep trying if collision
      let studentId;
      for (let i = 0; i < 10; i++) {
        studentId = 'GWID-' + Math.floor(Math.random() * 900000 + 100000);
        const collision = db.prepare('SELECT 1 FROM students WHERE student_id = ?').get(studentId);
        if (!collision) break;
      }
      db.prepare(`
        INSERT INTO students (user_id, student_id, class_year, major, dss_status, dss_multiplier)
        VALUES (?, ?, ?, ?, 0, 1.00)
      `).run(userId, studentId, classYear || 'Sophomore', major || 'Undeclared');

      // Enroll in selected existing courses
      if (Array.isArray(courseIds) && courseIds.length > 0) {
        const enrollStmt = db.prepare(`INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)`);
        courseIds.forEach(cid => enrollStmt.run(userId, cid));
      }

      // Create custom courses this student wants to add, then auto-enroll them
      if (Array.isArray(req.body.customCourses)) {
        const insertCourse = db.prepare(`
          INSERT INTO courses (course_id, course_name, section, term, instructor_id, meeting_days, meeting_time)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const enrollStmt = db.prepare(`INSERT OR IGNORE INTO enrollments (student_id, course_id) VALUES (?, ?)`);
        req.body.customCourses.forEach(cc => {
          if (!cc.courseId || !cc.courseName || !cc.instructorId) return;
          const already = db.prepare('SELECT 1 FROM courses WHERE course_id = ?').get(cc.courseId);
          if (!already) {
            const profExists = db.prepare('SELECT 1 FROM instructors WHERE user_id = ?').get(cc.instructorId);
            if (profExists) {
              insertCourse.run(cc.courseId, cc.courseName, cc.section || '001',
                               cc.term || 'Spring 2026', cc.instructorId,
                               (cc.meetingDays || 'MWF').toUpperCase(), cc.meetingTime || '10:00');
            }
          }
          enrollStmt.run(userId, cc.courseId);
        });
      }
    } else if (role === 'instructor') {
      db.prepare(`
        INSERT INTO instructors (user_id, department)
        VALUES (?, ?)
      `).run(userId, department || 'Information Systems');

      const insertCourse = db.prepare(`
        INSERT INTO courses (course_id, course_name, section, term, instructor_id, meeting_days, meeting_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      // Single legacy field newCourse — still support it
      if (newCourse && newCourse.courseId && newCourse.courseName) {
        const courseExists = db.prepare('SELECT 1 FROM courses WHERE course_id = ?').get(newCourse.courseId);
        if (!courseExists) {
          insertCourse.run(newCourse.courseId, newCourse.courseName,
                           newCourse.section || '001', newCourse.term || 'Spring 2026', userId,
                           (newCourse.meetingDays || 'MWF').toUpperCase(), newCourse.meetingTime || '10:00');
        }
      }

      // Preferred: array of courses
      if (Array.isArray(req.body.instructorCourses)) {
        req.body.instructorCourses.forEach(c => {
          if (!c.courseId || !c.courseName) return;
          const exists = db.prepare('SELECT 1 FROM courses WHERE course_id = ?').get(c.courseId);
          if (!exists) {
            insertCourse.run(c.courseId, c.courseName,
                             c.section || '001', c.term || 'Spring 2026', userId,
                             (c.meetingDays || 'MWF').toUpperCase(), c.meetingTime || '10:00');
          }
        });
      }
    } else if (role === 'ta') {
      db.prepare(`
        INSERT INTO teaching_assistants (user_id, assigned_section, supervisor_id)
        VALUES (?, ?, ?)
      `).run(userId, 'Unassigned', supervisorId);
    } else if (role === 'admin') {
      const scope = departmentScope && departmentScope !== 'Institution-wide' ? departmentScope : null;
      const level = scope ? 'Department' : 'Institution';
      db.prepare(`
        INSERT INTO institution_admins (user_id, access_level, department_scope)
        VALUES (?, ?, ?)
      `).run(userId, level, scope);
    }
  });

  try {
    createAccount();
  } catch (err) {
    console.error('Registration failed:', err.message, err.stack);
    return res.status(500).json({ error: 'Could not create account: ' + err.message });
  }

  audit.log({
    actor: userId,
    action: 'Account Created',
    details: `Role: ${role} · Email: ${email}`
  });

  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  db.prepare(`
    UPDATE users SET is_authenticated = 1, last_login_utc = strftime('%Y-%m-%d %H:%M:%S','now')
    WHERE user_id = ?
  `).run(userId);

  const token = signToken(user);

  res.status(201).json({
    token,
    user: {
      userId: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  db.prepare(`
    UPDATE users SET is_authenticated = 1, last_login_utc = strftime('%Y-%m-%d %H:%M:%S','now')
    WHERE user_id = ?
  `).run(user.user_id);

  audit.log({
    actor: user.user_id,
    action: 'User Authenticated',
    details: `Role: ${user.role} · Email: ${user.email}`
  });

  const token = signToken(user);

  res.json({
    token,
    user: {
      userId: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

router.post('/logout', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET is_authenticated = 0 WHERE user_id = ?')
    .run(req.user.userId);
  audit.log({ actor: req.user.userId, action: 'User Logged Out' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT user_id, name, email, role FROM users WHERE user_id = ?'
  ).get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  let profile = {};
  if (user.role === 'student') {
    profile = db.prepare('SELECT * FROM students WHERE user_id = ?').get(user.user_id) || {};
  } else if (user.role === 'instructor') {
    profile = db.prepare('SELECT * FROM instructors WHERE user_id = ?').get(user.user_id) || {};
  } else if (user.role === 'ta') {
    profile = db.prepare('SELECT * FROM teaching_assistants WHERE user_id = ?').get(user.user_id) || {};
  } else if (user.role === 'admin') {
    profile = db.prepare('SELECT * FROM institution_admins WHERE user_id = ?').get(user.user_id) || {};
  }

  res.json({ user, profile });
});

module.exports = router;
