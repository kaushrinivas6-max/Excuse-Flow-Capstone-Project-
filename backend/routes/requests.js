// ═══════════════════════════════════════════════════════════════════
// Requests routes — /api/requests/*
//
// Enhanced decision model (beyond simple Approve/Deny):
//   • Approved
//   • Approved with Conditions (structured conditions JSON)
//   • Partial Approval
//   • Denied
//   • More Info Requested (opens dialog loop)
//   • Escalated (flag for dept head / second reviewer)
// ═══════════════════════════════════════════════════════════════════
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/connection');
const { requireAuth, requireRole } = require('../middleware/auth');
const audit = require('../utils/audit');
const { generateRequestId, generateDocumentId, generateNotificationId } = require('../utils/ids');
const { publish } = require('../utils/events');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const docId = generateDocumentId();
    const ext = path.extname(file.originalname).toLowerCase();
    req._generatedDocId = docId;
    cb(null, `${docId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, JPG, PNG allowed'));
  }
});

function formatRequest(row) {
  if (!row) return null;
  return {
    id: row.request_id,
    studentId: row.student_id,
    studentName: row.student_name,
    course: row.course_id,
    courseName: row.course_name,
    date: row.absence_date,
    category: row.category,
    absenceType: row.absence_type || null,
    reason: row.reason,
    status: row.status,
    priority: row.priority,
    submitted: row.submission_timestamp_utc,
    decisionAt: row.decision_timestamp_utc,
    instructorComment: row.instructor_comment,
    conditions: row.conditions ? JSON.parse(row.conditions) : [],
    plannedAbsence: !!row.planned_absence_flag,
    dss: !!row.dss_flag,
    proposedTimes: row.proposed_times ? JSON.parse(row.proposed_times) : [],
    document: row.document_id ? {
      id: row.document_id,
      name: row.file_name,
      type: row.file_type,
      sizeKb: row.file_size_kb
    } : null
  };
}

const REQUEST_SELECT = `
  SELECT r.*, u.name AS student_name, c.course_name,
         d.document_id, d.file_name, d.file_type, d.file_size_kb
  FROM excuse_requests r
  JOIN users u       ON u.user_id = r.student_id
  JOIN courses c     ON c.course_id = r.course_id
  LEFT JOIN supporting_documents d ON d.request_id = r.request_id
`;

// ─── GET /api/requests — list (scoped by role) ───────────────────────
router.get('/', requireAuth, (req, res) => {
  const { status, course, category, q } = req.query;
  const filters = [];
  const params = [];

  if (req.user.role === 'student') {
    filters.push('r.student_id = ?');
    params.push(req.user.userId);
  } else if (req.user.role === 'instructor') {
    filters.push('c.instructor_id = ?');
    params.push(req.user.userId);
  } else if (req.user.role === 'ta') {
    const ta = db.prepare('SELECT * FROM teaching_assistants WHERE user_id = ?').get(req.user.userId);
    filters.push(`r.status IN ('Approved','Approved with Conditions','Partial Approval','Final Approved','Scheduled')`);
    if (ta?.supervisor_id) {
      filters.push('c.instructor_id = ?');
      params.push(ta.supervisor_id);
    }
  }

  if (status) { filters.push('r.status = ?'); params.push(status); }
  if (course) { filters.push('r.course_id = ?'); params.push(course); }
  if (category) { filters.push('r.category = ?'); params.push(category); }
  if (q) {
    filters.push('(r.request_id LIKE ? OR u.name LIKE ? OR r.reason LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  const sql = `${REQUEST_SELECT} ${where} ORDER BY r.submission_timestamp_utc DESC`;
  const rows = db.prepare(sql).all(...params);

  const formatted = rows.map(row => {
    const r = formatRequest(row);
    const submitted = new Date(row.submission_timestamp_utc);
    const ageMs = Date.now() - submitted.getTime();
    r.ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    r.ageHours = Math.floor(ageMs / (1000 * 60 * 60));
    if (r.status === 'Pending' && r.ageDays >= 3) r.flagStale = true;
    return r;
  });

  res.json({ requests: formatted, total: formatted.length });
});

// ─── GET /api/requests/:id ───────────────────────────────────────────
router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare(`${REQUEST_SELECT} WHERE r.request_id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Request not found' });

  if (req.user.role === 'student' && row.student_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user.role === 'instructor') {
    const course = db.prepare('SELECT instructor_id FROM courses WHERE course_id = ?').get(row.course_id);
    if (course.instructor_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  const comments = db.prepare(`
    SELECT c.*, u.name AS author_name
    FROM request_comments c
    JOIN users u ON u.user_id = c.author_id
    WHERE c.request_id = ?
    ORDER BY c.created_at_utc ASC
  `).all(req.params.id);

  // Fetch ALL supporting documents (original + any added after submission)
  const documents = db.prepare(`
    SELECT document_id, file_name, file_type, file_size_kb, upload_timestamp_utc
    FROM supporting_documents
    WHERE request_id = ?
    ORDER BY upload_timestamp_utc ASC
  `).all(req.params.id);

  audit.log({
    actor: req.user.userId,
    action: 'Request Viewed',
    requestId: req.params.id,
    details: `Role: ${req.user.role}`
  });

  res.json({ request: formatRequest(row), comments, documents });
});

// ─── POST /api/requests — submit new ─────────────────────────────────
router.post('/', requireAuth, requireRole('student'), upload.single('document'), (req, res) => {
  const { courseId, absenceDate, category, reason, consent, plannedAbsence, absenceType } = req.body;

  if (!courseId || !absenceDate || !reason) {
    return res.status(400).json({ error: 'Course, absence date, and reason are required' });
  }
  if (!consent || consent === 'false') {
    return res.status(400).json({ error: 'FERPA consent acknowledgment required' });
  }

  const enrolled = db.prepare(
    'SELECT 1 FROM enrollments WHERE student_id = ? AND course_id = ?'
  ).get(req.user.userId, courseId);
  if (!enrolled) return res.status(400).json({ error: 'You are not enrolled in this course' });

  const absDate = new Date(absenceDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysAhead = (absDate - today) / (1000 * 60 * 60 * 24);
  const isPlanned = plannedAbsence === 'true' || plannedAbsence === true;
  if (daysAhead > 7 && !isPlanned) {
    return res.status(400).json({
      error: 'Future absences beyond 7 days require the Planned Absence flag.'
    });
  }

  const student = db.prepare('SELECT dss_status FROM students WHERE user_id = ?').get(req.user.userId);
  const dssFlag = student?.dss_status ? 1 : 0;

  let priority = 'Normal';
  if (dssFlag) priority = 'High';
  else if (category === 'Medical' || category === 'Family Emergency') priority = 'High';
  // Exams/quizzes are higher-stakes, auto-bump to High
  if (absenceType === 'Exam' || absenceType === 'Midterm' || absenceType === 'Final') priority = 'High';

  const requestId = generateRequestId();

  db.prepare(`
    INSERT INTO excuse_requests
      (request_id, student_id, course_id, absence_date, category, reason,
       status, priority, planned_absence_flag, dss_flag, absence_type)
    VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?)
  `).run(requestId, req.user.userId, courseId, absenceDate,
         category || 'Other', reason, priority, isPlanned ? 1 : 0, dssFlag, absenceType || null);

  if (req.file) {
    const extMap = { '.pdf': 'PDF', '.jpg': 'JPG', '.jpeg': 'JPG', '.png': 'PNG' };
    const ext = path.extname(req.file.originalname).toLowerCase();
    const docId = req._generatedDocId;

    db.prepare(`
      INSERT INTO supporting_documents
        (document_id, request_id, file_name, file_type, file_size_kb,
         encrypted_flag, malware_scan_status, consent_accepted, storage_path)
      VALUES (?, ?, ?, ?, ?, 1, 'Passed', 1, ?)
    `).run(docId, requestId, req.file.originalname, extMap[ext] || 'PDF',
           Math.ceil(req.file.size / 1024), req.file.path);

    audit.log({
      actor: req.user.userId,
      action: 'Document Uploaded',
      requestId,
      details: `${req.file.originalname} (${Math.ceil(req.file.size / 1024)} KB)`
    });
  }

  audit.log({
    actor: req.user.userId,
    action: 'Request Created',
    requestId,
    details: `Category: ${category || 'Other'} · Priority: ${priority}`
  });

  const course = db.prepare('SELECT instructor_id, course_name FROM courses WHERE course_id = ?').get(courseId);
  if (course) {
    db.prepare(`
      INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
      VALUES (?, ?, ?, 'Both', ?)
    `).run(generateNotificationId(), course.instructor_id, requestId,
           `New request ${requestId} for ${course.course_name}`);

    // Real-time push so instructor sees it appear without refresh
    publish('request_submitted', {
      requestId, courseId, courseName: course.course_name
    }, course.instructor_id);
  }

  // Broadcast generic update so all relevant views can refresh charts/lists
  publish('request_updated', { requestId, status: 'Pending' }, 'broadcast');

  const created = db.prepare(`${REQUEST_SELECT} WHERE r.request_id = ?`).get(requestId);
  res.status(201).json({ request: formatRequest(created) });
});

// ─── POST /api/requests/:id/decision — instructor decides ────────────
router.post('/:id/decision', requireAuth, requireRole('instructor'), (req, res) => {
  const { decision, comment, conditions } = req.body;
  const validDecisions = [
    'Approved', 'Approved with Conditions', 'Partial Approval',
    'Denied', 'More Info Requested', 'Escalated',
    'Approved - Needs Reschedule'  // explicit: send to both student + TA to coordinate
  ];

  if (!validDecisions.includes(decision)) {
    return res.status(400).json({ error: 'Invalid decision type' });
  }

  const requiresComment = ['Denied', 'More Info Requested', 'Partial Approval', 'Approved with Conditions', 'Escalated'];
  if (requiresComment.includes(decision) && (!comment || !comment.trim())) {
    return res.status(400).json({
      error: `A comment is required when the decision is "${decision}".`
    });
  }

  const row = db.prepare(`${REQUEST_SELECT} WHERE r.request_id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Request not found' });

  const course = db.prepare('SELECT instructor_id FROM courses WHERE course_id = ?').get(row.course_id);
  if (course.instructor_id !== req.user.userId) {
    return res.status(403).json({ error: 'You do not teach this course' });
  }

  const conditionsJson = conditions ? JSON.stringify(conditions) : null;

  // Workflow branching: if instructor approves an absence that requires make-up logistics
  // (exam, midterm, final, quiz, lab, presentation), move to Awaiting Reschedule so BOTH
  // student and TAs are notified simultaneously — either can propose times. No sequential dance.
  // Explicit 'Approved - Needs Reschedule' forces the reschedule branch regardless of absence_type.
  const reschedulableTypes = ['Exam','Midterm','Final','Quiz','Lab','Presentation','Assignment Deadline'];
  const approvedDecisions = ['Approved','Approved with Conditions','Partial Approval'];
  let finalStatus = decision;
  let workflowBranch = null;
  if (decision === 'Approved - Needs Reschedule') {
    finalStatus = 'Awaiting Reschedule';
    workflowBranch = 'reschedule';
  } else if (approvedDecisions.includes(decision) && reschedulableTypes.includes(row.absence_type)) {
    finalStatus = 'Awaiting Reschedule';
    workflowBranch = 'reschedule';
  }

  db.prepare(`
    UPDATE excuse_requests
    SET status = ?, instructor_comment = ?, conditions = ?,
        decision_timestamp_utc = strftime('%Y-%m-%d %H:%M:%S','now')
    WHERE request_id = ?
  `).run(finalStatus, comment || '', conditionsJson, req.params.id);

  db.prepare(`
    INSERT INTO request_comments (request_id, author_id, author_role, body)
    VALUES (?, ?, 'instructor', ?)
  `).run(req.params.id, req.user.userId,
         `Decision: ${decision}${comment ? ' — ' + comment : ''}${workflowBranch === 'reschedule' ? ' · Student and TA can now coordinate the makeup time' : ''}`);

  audit.log({
    actor: req.user.userId,
    action: `Request ${decision}`,
    requestId: req.params.id,
    details: `${comment || 'No comment'}${workflowBranch === 'reschedule' ? ' · Routed to student + TA for parallel scheduling' : ''}`
  });

  const studentMsg = workflowBranch === 'reschedule'
    ? `Your ${row.absence_type || 'absence'} request was approved. Propose makeup times — your TA can also suggest one.`
    : `Your request ${req.params.id} was ${decision}.`;

  db.prepare(`
    INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
    VALUES (?, ?, ?, 'Both', ?)
  `).run(generateNotificationId(), row.student_id, req.params.id, studentMsg);

  // Real-time push to student
  publish('request_decided', {
    requestId: req.params.id, decision, comment: comment || null,
    needsProposal: workflowBranch === 'reschedule',
    finalStatus
  }, row.student_id);

  // If approved — notify TAs. For reschedule branch, they also get involved immediately (parallel flow).
  const approvedStatuses = ['Approved','Approved with Conditions','Partial Approval','Final Approved'];
  if (approvedStatuses.includes(decision) || workflowBranch === 'reschedule') {
    const tas = db.prepare(`
      SELECT user_id FROM teaching_assistants WHERE supervisor_id = ?
    `).all(req.user.userId);
    const notifyTA = db.prepare(`
      INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
      VALUES (?, ?, ?, 'InApp', ?)
    `);
    const taMsg = workflowBranch === 'reschedule'
      ? `Request ${req.params.id} needs a reschedule — coordinate a time with the student.`
      : `Request ${req.params.id} approved — logistics queue updated.`;
    tas.forEach(t => {
      notifyTA.run(generateNotificationId(), t.user_id, req.params.id, taMsg);
      publish('request_decided', {
        requestId: req.params.id, decision, forTA: true,
        needsReschedule: workflowBranch === 'reschedule'
      }, t.user_id);
    });
  }

  // If escalated, notify admins scoped to this course's department.
  // Institution-wide admins (access_level='Institution') see everything.
  // Department-scoped admins (access_level='Department') only see escalations from their department.
  if (decision === 'Escalated') {
    // Resolve the course's instructor department
    const instructorDept = db.prepare(`
      SELECT i.department FROM courses c
      JOIN instructors i ON i.user_id = c.instructor_id
      WHERE c.course_id = ?
    `).get(row.course_id)?.department || null;

    const admins = db.prepare(`
      SELECT ia.user_id, ia.access_level, ia.department_scope
      FROM institution_admins ia
      WHERE ia.access_level = 'Institution'
         OR (ia.access_level = 'Department' AND ia.department_scope = ?)
    `).all(instructorDept);

    const notifyAdmin = db.prepare(`
      INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
      VALUES (?, ?, ?, 'Both', ?)
    `);
    const instructorName = db.prepare('SELECT name FROM users WHERE user_id = ?').get(req.user.userId)?.name || 'Instructor';
    admins.forEach(a => {
      notifyAdmin.run(
        generateNotificationId(), a.user_id, req.params.id,
        `Request ${req.params.id} escalated by ${instructorName} — admin review required.`
      );
      publish('request_decided', {
        requestId: req.params.id, decision, forAdmin: true,
        escalatedBy: instructorName, comment: comment || null,
        department: instructorDept
      }, a.user_id);
    });
  }

  // Broadcast so all dashboards/charts refresh
  publish('request_updated', { requestId: req.params.id, status: decision }, 'broadcast');

  const updated = db.prepare(`${REQUEST_SELECT} WHERE r.request_id = ?`).get(req.params.id);
  res.json({ request: formatRequest(updated) });
});

// ─── POST /api/requests/:id/comments — threaded discussion ───────────
router.post('/:id/comments', requireAuth, (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Comment body is required' });
  }

  const row = db.prepare('SELECT * FROM excuse_requests WHERE request_id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Request not found' });

  if (req.user.role === 'student' && row.student_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.prepare(`
    INSERT INTO request_comments (request_id, author_id, author_role, body)
    VALUES (?, ?, ?, ?)
  `).run(req.params.id, req.user.userId, req.user.role, body.trim());

  audit.log({
    actor: req.user.userId,
    action: 'Comment Posted',
    requestId: req.params.id,
    details: body.slice(0, 80)
  });

  // If student responds to "More Info Requested", move back to Reviewing
  if (req.user.role === 'student' && row.status === 'More Info Requested') {
    db.prepare('UPDATE excuse_requests SET status = ? WHERE request_id = ?')
      .run('Reviewing', req.params.id);
    audit.log({
      actor: req.user.userId,
      action: 'Status → Reviewing',
      requestId: req.params.id,
      details: 'Student provided additional info'
    });
  }

  const comments = db.prepare(`
    SELECT c.*, u.name AS author_name
    FROM request_comments c
    JOIN users u ON u.user_id = c.author_id
    WHERE c.request_id = ?
    ORDER BY c.created_at_utc ASC
  `).all(req.params.id);

  publish('comment_posted', {
    requestId: req.params.id,
    authorRole: req.user.role,
    commentCount: comments.length
  }, 'broadcast');

  res.status(201).json({ comments });
});

// ─── POST /api/requests/:id/priority ─────────────────────────────────
router.post('/:id/priority', requireAuth, requireRole('instructor','admin'), (req, res) => {
  const { priority } = req.body;
  if (!['Low','Normal','High','Urgent'].includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority' });
  }
  db.prepare('UPDATE excuse_requests SET priority = ? WHERE request_id = ?')
    .run(priority, req.params.id);
  audit.log({
    actor: req.user.userId,
    action: 'Priority Changed',
    requestId: req.params.id,
    details: `New priority: ${priority}`
  });
  res.json({ ok: true, priority });
});

// ─── GET /api/requests/:id/document/:docId — download specific doc ───
// Or /api/requests/:id/document — gets the first attached doc (legacy)
router.get('/:id/document/:docId?', requireAuth, (req, res) => {
  const docQuery = req.params.docId
    ? `SELECT d.*, r.student_id, r.course_id FROM supporting_documents d
       JOIN excuse_requests r ON r.request_id = d.request_id
       WHERE d.request_id = ? AND d.document_id = ?`
    : `SELECT d.*, r.student_id, r.course_id FROM supporting_documents d
       JOIN excuse_requests r ON r.request_id = d.request_id
       WHERE d.request_id = ? LIMIT 1`;

  const doc = req.params.docId
    ? db.prepare(docQuery).get(req.params.id, req.params.docId)
    : db.prepare(docQuery).get(req.params.id);

  if (!doc) return res.status(404).json({ error: 'No document attached' });

  if (req.user.role === 'ta') {
    return res.status(403).json({
      error: 'TAs are not authorized to view supporting documentation.'
    });
  }
  if (req.user.role === 'student' && doc.student_id !== req.user.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user.role === 'instructor') {
    const course = db.prepare('SELECT instructor_id FROM courses WHERE course_id = ?').get(doc.course_id);
    if (course.instructor_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  audit.log({
    actor: req.user.userId,
    action: 'Document Viewed',
    requestId: req.params.id,
    details: doc.file_name
  });

  if (!fs.existsSync(doc.storage_path)) {
    return res.status(404).json({ error: 'File not found on disk (demo record)' });
  }
  res.download(doc.storage_path, doc.file_name);
});

// ─── PUT /api/requests/:id — edit a Draft or Pending request ─────────
router.put('/:id', requireAuth, requireRole('student'), (req, res) => {
  const { absenceDate, reason, category, courseId, saveAsDraft } = req.body;
  const r = db.prepare('SELECT * FROM excuse_requests WHERE request_id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (r.student_id !== req.user.userId) return res.status(403).json({ error: 'Not yours' });
  if (!['Draft', 'Pending'].includes(r.status)) {
    return res.status(400).json({ error: 'Only Draft or Pending requests can be edited.' });
  }

  const newStatus = saveAsDraft ? 'Draft' : (r.status === 'Draft' ? 'Pending' : r.status);

  db.prepare(`
    UPDATE excuse_requests
    SET absence_date = COALESCE(?, absence_date),
        reason       = COALESCE(?, reason),
        category     = COALESCE(?, category),
        course_id    = COALESCE(?, course_id),
        status       = ?
    WHERE request_id = ?
  `).run(absenceDate, reason, category, courseId, newStatus, req.params.id);

  audit.log({
    actor: req.user.userId,
    action: 'Request Edited',
    requestId: req.params.id,
    details: `New status: ${newStatus}`
  });

  // If a draft just became Pending, notify instructor
  if (r.status === 'Draft' && newStatus === 'Pending') {
    const cid = courseId || r.course_id;
    const course = db.prepare('SELECT instructor_id, course_name FROM courses WHERE course_id = ?').get(cid);
    if (course) {
      db.prepare(`
        INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
        VALUES (?, ?, ?, 'Both', ?)
      `).run(generateNotificationId(), course.instructor_id, req.params.id,
             `New request ${req.params.id} for ${course.course_name}`);
      publish('request_submitted', {
        requestId: req.params.id, courseId: cid, courseName: course.course_name
      }, course.instructor_id);
    }
  }

  publish('request_updated', { requestId: req.params.id, status: newStatus }, 'broadcast');

  const updated = db.prepare(`${REQUEST_SELECT} WHERE r.request_id = ?`).get(req.params.id);
  res.json({ request: formatRequest(updated) });
});

// ─── POST /api/requests/:id/withdraw — undo Pending within 3 days ────
router.post('/:id/withdraw', requireAuth, requireRole('student'), (req, res) => {
  const r = db.prepare('SELECT * FROM excuse_requests WHERE request_id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (r.student_id !== req.user.userId) return res.status(403).json({ error: 'Not yours' });
  if (r.status !== 'Pending') {
    return res.status(400).json({ error: 'Only Pending requests can be withdrawn.' });
  }

  const submitted = new Date(r.submission_timestamp_utc.replace(' ', 'T') + 'Z');
  const ageMs = Date.now() - submitted.getTime();
  const WITHDRAW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;  // 3 days
  if (ageMs > WITHDRAW_WINDOW_MS) {
    return res.status(400).json({ error: 'Withdraw window (3 days) has expired.' });
  }

  db.prepare("UPDATE excuse_requests SET status = 'Draft' WHERE request_id = ?")
    .run(req.params.id);

  audit.log({
    actor: req.user.userId,
    action: 'Request Withdrawn',
    requestId: req.params.id,
    details: 'Withdrawn within 3-day undo window'
  });

  publish('request_withdrawn', { requestId: req.params.id }, 'broadcast');

  res.json({ ok: true });
});

// ─── DELETE /api/requests/:id — delete Draft only ────────────────────
router.delete('/:id', requireAuth, requireRole('student'), (req, res) => {
  const r = db.prepare('SELECT * FROM excuse_requests WHERE request_id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (r.student_id !== req.user.userId) return res.status(403).json({ error: 'Not yours' });
  if (r.status !== 'Draft') {
    return res.status(400).json({ error: 'Only Draft requests can be deleted. Withdraw Pending requests first.' });
  }

  db.prepare('DELETE FROM supporting_documents WHERE request_id = ?').run(req.params.id);
  db.prepare('DELETE FROM request_comments WHERE request_id = ?').run(req.params.id);
  db.prepare('DELETE FROM notifications WHERE request_id = ?').run(req.params.id);
  db.prepare('DELETE FROM booked_retakes WHERE request_id = ?').run(req.params.id);
  db.prepare('DELETE FROM excuse_requests WHERE request_id = ?').run(req.params.id);

  audit.log({
    actor: req.user.userId,
    action: 'Draft Deleted',
    requestId: req.params.id
  });

  publish('request_deleted', { requestId: req.params.id }, req.user.userId);

  res.json({ ok: true });
});

// ─── POST /api/requests/:id/admin-override — admin sends RECOMMENDATION back to instructor
// Per governance policy: admins never override instructors. They review escalations,
// attach a recommendation + comment, and return to instructor for final decision.
router.post('/:id/admin-override', requireAuth, requireRole('admin'), (req, res) => {
  const { recommendation, comment } = req.body || {};
  const validRecs = ['Recommend Approval', 'Recommend Denial', 'Recommend Conditions', 'Return without recommendation'];
  if (!validRecs.includes(recommendation)) {
    return res.status(400).json({ error: 'Invalid recommendation' });
  }
  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: 'A comment is required when returning a request to the instructor.' });
  }

  const row = db.prepare(`${REQUEST_SELECT} WHERE r.request_id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Request not found' });
  if (row.status !== 'Escalated') {
    return res.status(400).json({ error: `Only Escalated requests can be reviewed by admin. Current status: ${row.status}` });
  }

  // Flip status back to Pending so it reappears in instructor inbox.
  // Keep any existing instructor comment; prepend the admin recommendation so it's visible.
  const existingComment = row.instructor_comment || '';
  const stampedComment = `[ADMIN: ${recommendation}] ${comment.trim()}` + (existingComment ? `\n\n[Prior instructor note: ${existingComment}]` : '');

  db.prepare(`
    UPDATE excuse_requests
    SET status = 'Pending',
        instructor_comment = ?,
        decision_timestamp_utc = NULL
    WHERE request_id = ?
  `).run(stampedComment, req.params.id);

  // Save admin comment into the threaded discussion (visible to instructor + student)
  db.prepare(`
    INSERT INTO request_comments (request_id, author_id, author_role, body)
    VALUES (?, ?, 'admin', ?)
  `).run(req.params.id, req.user.userId, `${recommendation}: ${comment.trim()}`);

  audit.log({
    actor: req.user.userId,
    action: 'Admin Recommendation',
    requestId: req.params.id,
    details: `${recommendation} — ${comment.slice(0, 80)}`
  });

  // Resolve instructor + get admin name
  const instructorUserId = db.prepare(`
    SELECT c.instructor_id FROM excuse_requests r
    JOIN courses c ON c.course_id = r.course_id
    WHERE r.request_id = ?
  `).get(req.params.id)?.instructor_id;
  const adminName = db.prepare('SELECT name FROM users WHERE user_id = ?').get(req.user.userId)?.name || 'Admin';

  // Notify instructor (they need to make the final call)
  if (instructorUserId) {
    db.prepare(`
      INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
      VALUES (?, ?, ?, 'Both', ?)
    `).run(generateNotificationId(), instructorUserId, req.params.id,
           `${adminName} returned ${req.params.id} with: ${recommendation}`);
    publish('request_returned', {
      requestId: req.params.id,
      recommendation,
      adminName,
      comment: comment.trim()
    }, instructorUserId);
  }

  // Notify student lightly
  db.prepare(`
    INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
    VALUES (?, ?, ?, 'InApp', ?)
  `).run(generateNotificationId(), row.student_id, req.params.id,
         `Your escalated request ${req.params.id} was reviewed by administration and returned to your instructor for a final decision.`);

  publish('request_updated', { requestId: req.params.id, status: 'Pending' }, 'broadcast');

  const updated = db.prepare(`${REQUEST_SELECT} WHERE r.request_id = ?`).get(req.params.id);
  res.json({ request: formatRequest(updated) });
});

// ─── POST /api/requests/:id/add-document — student appends a doc to an existing request
router.post('/:id/add-document', requireAuth, requireRole('student'), upload.single('document'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const r = db.prepare('SELECT * FROM excuse_requests WHERE request_id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Request not found' });
  if (r.student_id !== req.user.userId) return res.status(403).json({ error: 'Not your request' });
  // Allow adding docs to anything not yet finalized
  if (['Denied','Scheduled','Closed','Final Approved'].includes(r.status)) {
    return res.status(400).json({ error: `Cannot add documentation to a ${r.status} request.` });
  }

  const extMap = { '.pdf': 'PDF', '.jpg': 'JPG', '.jpeg': 'JPG', '.png': 'PNG' };
  const ext = path.extname(req.file.originalname).toLowerCase();
  const docId = req._generatedDocId;

  db.prepare(`
    INSERT INTO supporting_documents
      (document_id, request_id, file_name, file_type, file_size_kb,
       encrypted_flag, malware_scan_status, consent_accepted, storage_path)
    VALUES (?, ?, ?, ?, ?, 1, 'Passed', 1, ?)
  `).run(docId, req.params.id, req.file.originalname, extMap[ext] || 'PDF',
         Math.ceil(req.file.size / 1024), req.file.path);

  audit.log({
    actor: req.user.userId,
    action: 'Additional Document Uploaded',
    requestId: req.params.id,
    details: `${req.file.originalname} (${Math.ceil(req.file.size / 1024)} KB)`
  });

  // Threaded note so instructor sees it in the discussion
  db.prepare(`
    INSERT INTO request_comments (request_id, author_id, author_role, body)
    VALUES (?, ?, 'student', ?)
  `).run(req.params.id, req.user.userId, `Additional documentation uploaded: ${req.file.originalname}`);

  // Notify instructor of new doc
  const course = db.prepare('SELECT instructor_id FROM courses WHERE course_id = ?').get(r.course_id);
  if (course) {
    db.prepare(`
      INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
      VALUES (?, ?, ?, 'Both', ?)
    `).run(generateNotificationId(), course.instructor_id, req.params.id,
           `New documentation added to ${req.params.id}: ${req.file.originalname}`);
    publish('request_updated', { requestId: req.params.id, docAdded: true }, course.instructor_id);
  }

  res.status(201).json({
    document: {
      id: docId,
      name: req.file.originalname,
      type: extMap[ext] || 'PDF',
      sizeKb: Math.ceil(req.file.size / 1024)
    }
  });
});

// ─── POST /api/requests/:id/propose-times — student proposes makeup times
// Called after instructor approves a reschedule-worthy absence (exam/lab/quiz/etc.)
router.post('/:id/propose-times', requireAuth, requireRole('student'), (req, res) => {
  const { times } = req.body || {};
  if (!Array.isArray(times) || times.length === 0) {
    return res.status(400).json({ error: 'Please propose at least one datetime.' });
  }
  if (times.length > 5) {
    return res.status(400).json({ error: 'Maximum 5 proposed times.' });
  }

  const row = db.prepare('SELECT * FROM excuse_requests WHERE request_id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.student_id !== req.user.userId) return res.status(403).json({ error: 'Not yours' });
  // Student can propose during any reschedule state (or when accepting a TA counter-offer)
  const allowedStates = ['Awaiting Reschedule','Awaiting Student Proposal','Awaiting Student Approval'];
  if (!allowedStates.includes(row.status)) {
    return res.status(400).json({ error: `Cannot propose times for a request in status: ${row.status}` });
  }

  // Stay in 'Awaiting Reschedule' — the unified state where either party can act
  db.prepare(`
    UPDATE excuse_requests
    SET status = 'Awaiting Reschedule', proposed_times = ?
    WHERE request_id = ?
  `).run(JSON.stringify(times), req.params.id);

  db.prepare(`
    INSERT INTO request_comments (request_id, author_id, author_role, body)
    VALUES (?, ?, 'student', ?)
  `).run(req.params.id, req.user.userId,
         `Proposed makeup times: ${times.map(t => `\n  • ${t}`).join('')}`);

  audit.log({
    actor: req.user.userId,
    action: 'Makeup Times Proposed',
    requestId: req.params.id,
    details: `${times.length} option(s) proposed`
  });

  // Notify the course's TAs
  const course = db.prepare('SELECT instructor_id FROM courses WHERE course_id = ?').get(row.course_id);
  if (course) {
    const tas = db.prepare(`SELECT user_id FROM teaching_assistants WHERE supervisor_id = ?`).all(course.instructor_id);
    const notifyTA = db.prepare(`
      INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
      VALUES (?, ?, ?, 'InApp', ?)
    `);
    const studentName = db.prepare('SELECT name FROM users WHERE user_id = ?').get(req.user.userId)?.name || 'Student';
    tas.forEach(t => {
      notifyTA.run(generateNotificationId(), t.user_id, req.params.id,
                   `${studentName} proposed ${times.length} makeup time(s) for ${req.params.id} — confirm a slot.`);
      publish('request_decided', { requestId: req.params.id, decision: 'needs_ta_confirm', forTA: true }, t.user_id);
    });
    publish('request_updated', { requestId: req.params.id, status: 'Awaiting Reschedule' }, course.instructor_id);
  }

  publish('request_updated', { requestId: req.params.id, status: 'Awaiting Reschedule' }, 'broadcast');

  const updated = db.prepare(`${REQUEST_SELECT} WHERE r.request_id = ?`).get(req.params.id);
  res.json({ request: formatRequest(updated) });
});

// ─── POST /api/requests/:id/confirm-schedule — TA picks/proposes a time
// Two paths:
//   A) TA's time matches one of the student's proposals → book it, status = Scheduled
//   B) TA proposes a different time → student must approve, status = Awaiting Student Approval
router.post('/:id/confirm-schedule', requireAuth, requireRole('ta'), (req, res) => {
  const { scheduledDatetime, room, duration, sessionType, notes, configId } = req.body || {};
  if (!scheduledDatetime || !room) {
    return res.status(400).json({ error: 'Datetime and room are required.' });
  }

  const row = db.prepare('SELECT * FROM excuse_requests WHERE request_id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const allowed = ['Awaiting Reschedule','Awaiting TA Confirmation','Approved','Approved with Conditions','Partial Approval','Final Approved'];
  if (!allowed.includes(row.status)) {
    return res.status(400).json({ error: `Cannot schedule a ${row.status} request.` });
  }

  const student = db.prepare('SELECT * FROM students WHERE user_id = ?').get(row.student_id);
  const baseDuration = parseInt(duration) || 60;
  const adjustedDuration = student?.dss_status
    ? Math.round(baseDuration * student.dss_multiplier)
    : baseDuration;

  const taName = db.prepare('SELECT name FROM users WHERE user_id = ?').get(req.user.userId)?.name || 'TA';

  // Did TA pick one of the student's proposed times?
  let studentProposals = [];
  try { studentProposals = row.proposed_times ? JSON.parse(row.proposed_times) : []; } catch {}
  const taTime = scheduledDatetime.trim();
  const matchedStudentProposal = studentProposals.some(t => (t || '').trim() === taTime);

  // Store the pending booking details (room/duration/type/notes) as JSON inside proposed_times
  // alongside the datetime, so when the student accepts we can create the booking with all details.
  // We use the first slot in proposed_times as the "pending offer" convention.

  if (matchedStudentProposal) {
    // Path A — TA matched student's proposal, book it immediately
    const result = db.prepare(`
      INSERT INTO booked_retakes
        (request_id, config_id, student_id, scheduled_datetime, room, duration, dss_applied, session_type, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, configId ? parseInt(configId) : null, row.student_id, scheduledDatetime,
           room, adjustedDuration, student?.dss_status ? 1 : 0,
           sessionType || row.absence_type || null, notes || null);

    db.prepare(`UPDATE excuse_requests SET status = 'Scheduled' WHERE request_id = ?`).run(req.params.id);

    db.prepare(`
      INSERT INTO request_comments (request_id, author_id, author_role, body)
      VALUES (?, ?, 'ta', ?)
    `).run(req.params.id, req.user.userId,
           `Confirmed student's proposed time: ${scheduledDatetime} @ ${room} (${adjustedDuration} min)${notes ? ' — ' + notes : ''}`);

    audit.log({
      actor: req.user.userId,
      action: 'Schedule Confirmed by TA (matched student proposal)',
      requestId: req.params.id,
      details: `${sessionType || row.absence_type || 'Session'} · ${scheduledDatetime} @ ${room}`
    });

    db.prepare(`
      INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
      VALUES (?, ?, ?, 'Both', ?)
    `).run(generateNotificationId(), row.student_id, req.params.id,
           `${taName} confirmed your makeup: ${scheduledDatetime} @ ${room}`);

    publish('request_decided', {
      requestId: req.params.id, decision: 'Scheduled',
      scheduledDatetime, room, confirmedByTA: true
    }, row.student_id);

    publish('request_updated', { requestId: req.params.id, status: 'Scheduled' }, 'broadcast');

    return res.status(201).json({
      bookingId: result.lastInsertRowid,
      adjustedDuration,
      dssApplied: !!student?.dss_status,
      status: 'Scheduled',
      matched: true
    });
  }

  // Path B — TA proposed a different time. Store as pending offer, bounce to student.
  // We encode full offer details in proposed_times as JSON so the student-approve endpoint
  // can pick them up without needing more round-trips.
  const taOffer = {
    datetime: scheduledDatetime,
    room,
    duration: adjustedDuration,
    sessionType: sessionType || row.absence_type || null,
    notes: notes || null,
    configId: configId ? parseInt(configId) : null,
    proposedBy: 'ta',
    proposedByName: taName
  };

  db.prepare(`
    UPDATE excuse_requests
    SET status = 'Awaiting Student Approval',
        proposed_times = ?
    WHERE request_id = ?
  `).run(JSON.stringify([taOffer]), req.params.id);

  db.prepare(`
    INSERT INTO request_comments (request_id, author_id, author_role, body)
    VALUES (?, ?, 'ta', ?)
  `).run(req.params.id, req.user.userId,
         `TA proposed a different time: ${scheduledDatetime} @ ${room} (${adjustedDuration} min)${notes ? ' — ' + notes : ''}. Awaiting student approval.`);

  audit.log({
    actor: req.user.userId,
    action: 'TA Counter-proposed Time',
    requestId: req.params.id,
    details: `${scheduledDatetime} @ ${room}`
  });

  db.prepare(`
    INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
    VALUES (?, ?, ?, 'Both', ?)
  `).run(generateNotificationId(), row.student_id, req.params.id,
         `${taName} suggested a different time: ${scheduledDatetime} @ ${room}. Please approve or counter-propose.`);

  publish('request_decided', {
    requestId: req.params.id,
    decision: 'ta_counter_proposed',
    scheduledDatetime, room,
    needsStudentApproval: true
  }, row.student_id);

  publish('request_updated', { requestId: req.params.id, status: 'Awaiting Student Approval' }, 'broadcast');

  res.json({
    status: 'Awaiting Student Approval',
    matched: false,
    taOffer
  });
});

// ─── POST /api/requests/:id/student-approve-schedule — student accepts or rejects TA's counter
router.post('/:id/student-approve-schedule', requireAuth, requireRole('student'), (req, res) => {
  const { accept, counterProposals } = req.body || {};

  const row = db.prepare('SELECT * FROM excuse_requests WHERE request_id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.student_id !== req.user.userId) return res.status(403).json({ error: 'Not yours' });
  if (row.status !== 'Awaiting Student Approval') {
    return res.status(400).json({ error: `Cannot approve schedule in status: ${row.status}` });
  }

  let offers = [];
  try { offers = row.proposed_times ? JSON.parse(row.proposed_times) : []; } catch {}
  const pending = offers[0];
  if (!pending || !pending.datetime) {
    return res.status(400).json({ error: 'No pending schedule to approve.' });
  }

  const student = db.prepare('SELECT * FROM students WHERE user_id = ?').get(row.student_id);
  const studentName = db.prepare('SELECT name FROM users WHERE user_id = ?').get(req.user.userId)?.name || 'Student';
  const course = db.prepare('SELECT instructor_id FROM courses WHERE course_id = ?').get(row.course_id);

  if (accept) {
    // Create the booking using the stored offer details
    const result = db.prepare(`
      INSERT INTO booked_retakes
        (request_id, config_id, student_id, scheduled_datetime, room, duration, dss_applied, session_type, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, pending.configId || null, row.student_id, pending.datetime,
           pending.room, pending.duration, student?.dss_status ? 1 : 0,
           pending.sessionType, pending.notes);

    db.prepare(`UPDATE excuse_requests SET status = 'Scheduled' WHERE request_id = ?`).run(req.params.id);

    db.prepare(`
      INSERT INTO request_comments (request_id, author_id, author_role, body)
      VALUES (?, ?, 'student', ?)
    `).run(req.params.id, req.user.userId,
           `Accepted ${pending.proposedByName || 'TA'}'s proposed time: ${pending.datetime} @ ${pending.room}`);

    audit.log({
      actor: req.user.userId,
      action: 'Student Accepted TA Schedule',
      requestId: req.params.id,
      details: `${pending.datetime} @ ${pending.room}`
    });

    // Notify all TAs of this course + instructor
    if (course) {
      const tas = db.prepare(`SELECT user_id FROM teaching_assistants WHERE supervisor_id = ?`).all(course.instructor_id);
      const notifyTA = db.prepare(`
        INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
        VALUES (?, ?, ?, 'InApp', ?)
      `);
      tas.forEach(t => {
        notifyTA.run(generateNotificationId(), t.user_id, req.params.id,
                     `${studentName} accepted your proposed schedule for ${req.params.id} — now Scheduled.`);
        publish('request_decided', { requestId: req.params.id, decision: 'Scheduled', forTA: true }, t.user_id);
      });
    }

    publish('request_updated', { requestId: req.params.id, status: 'Scheduled' }, 'broadcast');

    return res.json({
      bookingId: result.lastInsertRowid,
      status: 'Scheduled',
      accepted: true
    });
  }

  // Reject → counter-propose (or just push back). Status → Awaiting Reschedule
  const counters = Array.isArray(counterProposals) ? counterProposals.filter(Boolean).slice(0, 5) : [];

  db.prepare(`
    UPDATE excuse_requests
    SET status = 'Awaiting Reschedule',
        proposed_times = ?
    WHERE request_id = ?
  `).run(JSON.stringify(counters), req.params.id);

  const commentBody = counters.length
    ? `Declined ${pending.proposedByName || 'TA'}'s proposed time. Counter-proposing: ${counters.map(t => `\n  • ${t}`).join('')}`
    : `Declined ${pending.proposedByName || 'TA'}'s proposed time. Awaiting a new suggestion.`;

  db.prepare(`
    INSERT INTO request_comments (request_id, author_id, author_role, body)
    VALUES (?, ?, 'student', ?)
  `).run(req.params.id, req.user.userId, commentBody);

  audit.log({
    actor: req.user.userId,
    action: 'Student Declined TA Schedule',
    requestId: req.params.id,
    details: counters.length ? `${counters.length} counter-proposal(s)` : 'Awaiting new TA suggestion'
  });

  if (course) {
    const tas = db.prepare(`SELECT user_id FROM teaching_assistants WHERE supervisor_id = ?`).all(course.instructor_id);
    const notifyTA = db.prepare(`
      INSERT INTO notifications (notification_id, recipient_id, request_id, channel, message_body)
      VALUES (?, ?, ?, 'InApp', ?)
    `);
    const msg = counters.length
      ? `${studentName} counter-proposed ${counters.length} time(s) for ${req.params.id}`
      : `${studentName} declined your proposed time for ${req.params.id}`;
    tas.forEach(t => {
      notifyTA.run(generateNotificationId(), t.user_id, req.params.id, msg);
      publish('request_decided', { requestId: req.params.id, decision: 'needs_ta_confirm', forTA: true }, t.user_id);
    });
  }

  publish('request_updated', { requestId: req.params.id, status: 'Awaiting Reschedule' }, 'broadcast');

  res.json({ status: 'Awaiting Reschedule', accepted: false });
});

module.exports = router;
