// ═══════════════════════════════════════════════════════════════════
// Video Library — /api/videos/*
// Mock lecture-recording library. Students see only videos for courses
// they're enrolled in.
// ═══════════════════════════════════════════════════════════════════
const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const { courseId } = req.query;
  let rows;

  if (req.user.role === 'student') {
    const params = [req.user.userId];
    let extra = '';
    if (courseId) { extra = 'AND v.course_id = ?'; params.push(courseId); }
    rows = db.prepare(`
      SELECT v.*, c.course_name, c.color AS course_color
      FROM lecture_videos v
      JOIN courses c     ON c.course_id = v.course_id
      JOIN enrollments e ON e.course_id = v.course_id
      WHERE e.student_id = ?
      ${extra}
      ORDER BY v.lecture_date DESC
    `).all(...params);
  } else if (req.user.role === 'instructor') {
    const params = [req.user.userId];
    let extra = '';
    if (courseId) { extra = 'AND v.course_id = ?'; params.push(courseId); }
    rows = db.prepare(`
      SELECT v.*, c.course_name, c.color AS course_color
      FROM lecture_videos v
      JOIN courses c ON c.course_id = v.course_id
      WHERE c.instructor_id = ?
      ${extra}
      ORDER BY v.lecture_date DESC
    `).all(...params);
  } else {
    rows = db.prepare(`
      SELECT v.*, c.course_name, c.color AS course_color
      FROM lecture_videos v
      JOIN courses c ON c.course_id = v.course_id
      ORDER BY v.lecture_date DESC LIMIT 100
    `).all();
  }

  res.json({ videos: rows });
});

router.get('/:id', requireAuth, (req, res) => {
  const v = db.prepare(`
    SELECT v.*, c.course_name, c.color AS course_color
    FROM lecture_videos v
    JOIN courses c ON c.course_id = v.course_id
    WHERE v.video_id = ?
  `).get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Video not found' });
  res.json({ video: v });
});

module.exports = router;
