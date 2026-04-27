// ═══════════════════════════════════════════════════════════════════
// TA & Retake routes — /api/ta/* and /api/retakes/*
// ═══════════════════════════════════════════════════════════════════
const express = require('express');
const db = require('../db/connection');
const { requireAuth, requireRole } = require('../middleware/auth');
const audit = require('../utils/audit');
const { generateNotificationId } = require('../utils/ids');
const { publish } = require('../utils/events');

const router = express.Router();

// ─── GET /api/ta/my-tas — instructor's TA roster ─────────────────────
// Returns every TA who picked this instructor as their supervisor.
// Used on the instructor dashboard and in the reschedule decision UI
// so instructors know exactly who will be notified when they route work.
router.get('/my-tas', requireAuth, requireRole('instructor','admin'), (req, res) => {
  const tas = db.prepare(`
    SELECT u.user_id, u.name, u.email, t.assigned_section
    FROM teaching_assistants t
    JOIN users u ON u.user_id = t.user_id
    WHERE t.supervisor_id = ?
    ORDER BY u.name
  `).all(req.user.userId);
  res.json({ tas });
});

// ─── GET /api/ta/queue — logistics queue for TAs ─────────────────────
// TAs only see approved requests — BR-12 blocks medical doc access
router.get('/queue', requireAuth, requireRole('ta'), (req, res) => {
  const ta = db.prepare('SELECT * FROM teaching_assistants WHERE user_id = ?')
    .get(req.user.userId);
  if (!ta) return res.status(404).json({ error: 'TA profile not found' });

  const rows = db.prepare(`
    SELECT r.request_id, r.absence_date, r.category, r.status, r.priority, r.absence_type,
           u.name AS student_name, c.course_name, c.course_id,
           b.booking_id, b.scheduled_datetime, b.room, b.duration, b.status AS booking_status
    FROM excuse_requests r
    JOIN users u   ON u.user_id = r.student_id
    JOIN courses c ON c.course_id = r.course_id
    LEFT JOIN booked_retakes b ON b.request_id = r.request_id
    WHERE c.instructor_id = ?
      AND r.status IN ('Approved','Approved with Conditions','Partial Approval','Final Approved','Scheduled','Awaiting TA Confirmation','Awaiting Reschedule','Awaiting Student Approval')
    ORDER BY
      CASE r.status
        WHEN 'Awaiting Reschedule' THEN 0
        WHEN 'Awaiting TA Confirmation' THEN 0
        WHEN 'Awaiting Student Approval' THEN 1
        ELSE 2
      END,
      r.decision_timestamp_utc DESC
  `).all(ta.supervisor_id);

  res.json({ queue: rows });
});

// ─── POST /api/ta/attendance — mark Present/No-Show ──────────────────
router.post('/attendance', requireAuth, requireRole('ta'), (req, res) => {
  const { bookingId, status } = req.body;
  if (!['Completed','No-Show','Scheduled','Cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid attendance status' });
  }

  db.prepare('UPDATE booked_retakes SET status = ? WHERE booking_id = ?')
    .run(status, bookingId);

  audit.log({
    actor: req.user.userId,
    action: 'Attendance Recorded',
    details: `Booking ${bookingId} → ${status}`
  });

  res.json({ ok: true });
});

// ─── GET /api/ta/messages — logistics messages ───────────────────────
router.get('/messages', requireAuth, requireRole('ta','instructor'), (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, u.name AS sender_name
    FROM ta_logistics_messages m
    JOIN users u ON u.user_id = m.sender_id
    ORDER BY sent_timestamp_utc DESC
    LIMIT 50
  `).all();
  res.json({ messages: rows });
});

// ─── POST /api/ta/messages — send logistics message ──────────────────
router.post('/messages', requireAuth, requireRole('ta'), (req, res) => {
  const { recipientName, body, isEscalation } = req.body;
  if (!recipientName || !body) {
    return res.status(400).json({ error: 'Recipient and body required' });
  }
  db.prepare(`
    INSERT INTO ta_logistics_messages
      (sender_id, recipient_name, message_body, is_escalation)
    VALUES (?, ?, ?, ?)
  `).run(req.user.userId, recipientName, body, isEscalation ? 1 : 0);

  audit.log({
    actor: req.user.userId,
    action: isEscalation ? 'Logistics Escalation' : 'Logistics Message',
    details: `To: ${recipientName} · ${body.slice(0, 80)}`
  });

  // If this is an escalation, notify the TA's supervising instructor + all admins as safety net
  if (isEscalation) {
    const ta = db.prepare('SELECT supervisor_id FROM teaching_assistants WHERE user_id = ?').get(req.user.userId);
    const taName = db.prepare('SELECT name FROM users WHERE user_id = ?').get(req.user.userId)?.name || 'TA';
    const notifyIns = db.prepare(`
      INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
      VALUES (?, ?, NULL, 'Both', ?)
    `);
    const recipients = new Set();
    // 1. Supervising instructor (from TA profile)
    if (ta?.supervisor_id) recipients.add(ta.supervisor_id);
    // 2. Match recipient name (if provided)
    if (recipientName) {
      const byName = db.prepare(`
        SELECT user_id FROM users WHERE role IN ('instructor','admin') AND LOWER(name) LIKE LOWER(?) LIMIT 3
      `).all('%' + recipientName + '%');
      byName.forEach(u => recipients.add(u.user_id));
    }
    // 3. All admins as safety net (ensures the escalation is never lost)
    const admins = db.prepare(`SELECT user_id FROM users WHERE role = 'admin'`).all();
    admins.forEach(a => recipients.add(a.user_id));

    const msg = `ESCALATION from ${taName}: ${body.slice(0, 140)}${body.length > 140 ? '…' : ''}`;
    recipients.forEach(uid => {
      notifyIns.run(generateNotificationId(), uid, msg);
      publish('ta_escalation', { from: taName, body, recipientName }, uid);
    });
  }

  res.status(201).json({ ok: true });
});

// ─── GET /api/retakes/configs — list retake windows ──────────────────
router.get('/configs', requireAuth, (req, res) => {
  const configs = db.prepare(`
    SELECT rc.*, c.course_name
    FROM retake_configurations rc
    JOIN courses c ON c.course_id = rc.course_id
    ORDER BY rc.window_start DESC
  `).all();
  res.json({ configs });
});

// ─── POST /api/retakes/configs — create retake window ────────────────
router.post('/configs', requireAuth, requireRole('instructor'), (req, res) => {
  const { courseId, assessmentType, windowStart, windowEnd, availableSlots, maxCapacity } = req.body;
  if (!courseId || !assessmentType || !windowStart || !windowEnd) {
    return res.status(400).json({ error: 'All fields required' });
  }

  const result = db.prepare(`
    INSERT INTO retake_configurations
      (course_id, assessment_type, window_start, window_end, available_slots, max_capacity, created_by_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(courseId, assessmentType, windowStart, windowEnd,
         parseInt(availableSlots) || 3, parseInt(maxCapacity) || 5, req.user.userId);

  audit.log({
    actor: req.user.userId,
    action: 'Retake Config Created',
    details: `${courseId} ${assessmentType} ${windowStart}–${windowEnd}`
  });

  res.status(201).json({ configId: result.lastInsertRowid });
});

// ─── DELETE /api/retakes/configs/:id ─────────────────────────────────
router.delete('/configs/:id', requireAuth, requireRole('instructor'), (req, res) => {
  db.prepare('DELETE FROM retake_configurations WHERE config_id = ?').run(req.params.id);
  audit.log({
    actor: req.user.userId,
    action: 'Retake Config Deleted',
    details: `Config ID: ${req.params.id}`
  });
  res.json({ ok: true });
});

// ─── POST /api/retakes/book — student books retake slot ──────────────
router.post('/book', requireAuth, requireRole('student'), (req, res) => {
  const { requestId, configId, scheduledDatetime, room, duration } = req.body;

  const request = db.prepare('SELECT * FROM excuse_requests WHERE request_id = ?')
    .get(requestId);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.student_id !== req.user.userId) {
    return res.status(403).json({ error: 'Not your request' });
  }

  // BR-11 — scheduling gated by Final Approved status
  const allowedStatuses = ['Approved', 'Approved with Conditions', 'Partial Approval', 'Final Approved'];
  if (!allowedStatuses.includes(request.status)) {
    return res.status(400).json({
      error: `Scheduling requires an approved request. Current status: ${request.status}`
    });
  }

  // Auto-apply DSS multiplier if verified
  const student = db.prepare('SELECT * FROM students WHERE user_id = ?')
    .get(req.user.userId);
  const baseDuration = parseInt(duration) || 60;
  const adjustedDuration = student?.dss_status
    ? Math.round(baseDuration * student.dss_multiplier)
    : baseDuration;

  const result = db.prepare(`
    INSERT INTO booked_retakes
      (request_id, config_id, student_id, scheduled_datetime, room, duration, dss_applied)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(requestId, configId ? parseInt(configId) : null, req.user.userId, scheduledDatetime,
         room, adjustedDuration, student?.dss_status ? 1 : 0);

  // Update request status
  db.prepare('UPDATE excuse_requests SET status = ? WHERE request_id = ?')
    .run('Scheduled', requestId);

  audit.log({
    actor: req.user.userId,
    action: 'Retake Booked',
    requestId,
    details: `${scheduledDatetime} @ ${room} (${adjustedDuration} min${student?.dss_status ? ' · DSS' : ''})`
  });

  res.status(201).json({
    bookingId: result.lastInsertRowid,
    adjustedDuration,
    dssApplied: !!student?.dss_status
  });
});

// ─── POST /api/ta/book-for — TA books a retake on behalf of student ──
router.post('/book-for', requireAuth, requireRole('ta'), (req, res) => {
  const { requestId, configId, scheduledDatetime, room, duration, sessionType, notes } = req.body;

  const request = db.prepare('SELECT * FROM excuse_requests WHERE request_id = ?').get(requestId);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const allowedStatuses = ['Approved', 'Approved with Conditions', 'Partial Approval', 'Final Approved'];
  if (!allowedStatuses.includes(request.status)) {
    return res.status(400).json({ error: `Booking requires an approved request. Current status: ${request.status}` });
  }

  const student = db.prepare('SELECT * FROM students WHERE user_id = ?').get(request.student_id);
  const baseDuration = parseInt(duration) || 60;
  const adjustedDuration = student?.dss_status
    ? Math.round(baseDuration * student.dss_multiplier)
    : baseDuration;

  const result = db.prepare(`
    INSERT INTO booked_retakes
      (request_id, config_id, student_id, scheduled_datetime, room, duration, dss_applied, session_type, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(requestId, configId ? parseInt(configId) : null, request.student_id, scheduledDatetime,
         room, adjustedDuration, student?.dss_status ? 1 : 0,
         sessionType || null, notes || null);

  db.prepare('UPDATE excuse_requests SET status = ? WHERE request_id = ?')
    .run('Scheduled', requestId);

  audit.log({
    actor: req.user.userId,
    action: 'Retake Booked (by TA)',
    requestId,
    details: `${sessionType || 'Session'} · ${scheduledDatetime} @ ${room} (${adjustedDuration} min${student?.dss_status ? ' · DSS' : ''})`
  });

  // Notify the student
  db.prepare(`
    INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
    VALUES (?, ?, ?, 'Both', ?)
  `).run(generateNotificationId(), request.student_id, requestId,
         `Your TA booked your retake: ${scheduledDatetime} @ ${room}`);

  publish('request_updated', { requestId, status: 'Scheduled' }, 'broadcast');

  res.status(201).json({
    bookingId: result.lastInsertRowid,
    adjustedDuration,
    dssApplied: !!student?.dss_status
  });
});

// ─── POST /api/ta/reschedule — TA updates an existing booking ────────
// If the request was already Scheduled, moving it requires student re-approval.
// We flip the request status to Awaiting Student Approval and stash the new offer
// so the student can accept/counter via the normal approval UI.
router.post('/reschedule', requireAuth, requireRole('ta'), (req, res) => {
  const { bookingId, scheduledDatetime, room, duration, notes } = req.body;
  if (!bookingId) return res.status(400).json({ error: 'bookingId required' });

  const booking = db.prepare('SELECT * FROM booked_retakes WHERE booking_id = ?').get(bookingId);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const request = db.prepare('SELECT * FROM excuse_requests WHERE request_id = ?').get(booking.request_id);
  const taName = db.prepare('SELECT name FROM users WHERE user_id = ?').get(req.user.userId)?.name || 'TA';

  const newDur = parseInt(duration) || booking.duration;
  const newDT  = scheduledDatetime || booking.scheduled_datetime;
  const newRoom = room || booking.room;

  // Cancel the existing booking, then bounce to student for approval of the new proposal.
  // We don't create the new booking until the student accepts.
  db.prepare(`
    UPDATE booked_retakes SET status = 'Cancelled' WHERE booking_id = ?
  `).run(bookingId);

  const offer = {
    datetime: newDT,
    room: newRoom,
    duration: newDur,
    sessionType: booking.session_type || request?.absence_type || null,
    notes: notes || booking.notes || null,
    configId: booking.config_id || null,
    proposedBy: 'ta',
    proposedByName: taName,
    isReschedule: true,
    originalBookingId: bookingId
  };

  db.prepare(`
    UPDATE excuse_requests
    SET status = 'Awaiting Student Approval', proposed_times = ?
    WHERE request_id = ?
  `).run(JSON.stringify([offer]), booking.request_id);

  db.prepare(`
    INSERT INTO request_comments (request_id, author_id, author_role, body)
    VALUES (?, ?, 'ta', ?)
  `).run(booking.request_id, req.user.userId,
         `Requested reschedule: ${newDT} @ ${newRoom} (${newDur} min)${notes ? ' — ' + notes : ''}. Awaiting student approval.`);

  audit.log({
    actor: req.user.userId,
    action: 'TA Requested Reschedule',
    requestId: booking.request_id,
    details: `Booking ${bookingId}: ${booking.scheduled_datetime} → ${newDT} @ ${newRoom}`
  });

  // Notify student — real-time + in-app
  db.prepare(`
    INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
    VALUES (?, ?, ?, 'Both', ?)
  `).run(generateNotificationId(), booking.student_id, booking.request_id,
         `${taName} wants to reschedule: ${newDT} @ ${newRoom}. Please approve or counter-propose.`);

  publish('request_decided', {
    requestId: booking.request_id,
    decision: 'ta_rescheduled',
    scheduledDatetime: newDT,
    room: newRoom,
    needsStudentApproval: true,
    isReschedule: true
  }, booking.student_id);

  publish('request_updated', { requestId: booking.request_id, status: 'Awaiting Student Approval' }, 'broadcast');

  res.json({
    ok: true,
    status: 'Awaiting Student Approval',
    offer
  });
});

// ─── GET /api/retakes/mine — my bookings ─────────────────────────────
router.get('/mine', requireAuth, (req, res) => {
  let bookings;
  if (req.user.role === 'student') {
    bookings = db.prepare(`
      SELECT b.*, r.course_id, r.absence_type, c.course_name
      FROM booked_retakes b
      JOIN excuse_requests r ON r.request_id = b.request_id
      JOIN courses c ON c.course_id = r.course_id
      WHERE b.student_id = ?
      ORDER BY b.scheduled_datetime
    `).all(req.user.userId);
  } else {
    bookings = db.prepare(`
      SELECT b.*, u.name AS student_name, r.course_id, r.absence_type, c.course_name
      FROM booked_retakes b
      JOIN excuse_requests r ON r.request_id = b.request_id
      JOIN courses c ON c.course_id = r.course_id
      JOIN users u ON u.user_id = b.student_id
      ORDER BY b.scheduled_datetime
    `).all();
  }
  res.json({ bookings });
});

module.exports = router;
