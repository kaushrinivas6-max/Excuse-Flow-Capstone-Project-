-- ═══════════════════════════════════════════════════════════════════
-- ExcuseFlow Database Schema
-- Matches Deliverable 4 Physical Schema & Data Dictionary
-- ═══════════════════════════════════════════════════════════════════

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  user_id         TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('student','instructor','ta','admin')),
  is_authenticated INTEGER NOT NULL DEFAULT 0,
  last_login_utc  TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
);

CREATE TABLE IF NOT EXISTS students (
  user_id         TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL UNIQUE,
  class_year      TEXT,
  major           TEXT,
  dss_status      INTEGER NOT NULL DEFAULT 0,
  dss_multiplier  REAL NOT NULL DEFAULT 1.00,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS instructors (
  user_id         TEXT PRIMARY KEY,
  department      TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teaching_assistants (
  user_id         TEXT PRIMARY KEY,
  assigned_section TEXT NOT NULL,
  supervisor_id   TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (supervisor_id) REFERENCES instructors(user_id)
);

CREATE TABLE IF NOT EXISTS institution_admins (
  user_id         TEXT PRIMARY KEY,
  access_level    TEXT NOT NULL CHECK (access_level IN ('Department','Institution')),
  department_scope TEXT,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS courses (
  course_id       TEXT PRIMARY KEY,
  course_name     TEXT NOT NULL,
  section         TEXT NOT NULL,
  term            TEXT NOT NULL,
  instructor_id   TEXT NOT NULL,
  instructor_name_override TEXT,
  meeting_days    TEXT DEFAULT 'MWF',
  meeting_time    TEXT DEFAULT '10:00',
  meeting_duration INTEGER DEFAULT 60,
  color           TEXT DEFAULT '#C5841F',
  user_created    INTEGER NOT NULL DEFAULT 0,
  created_by_id   TEXT,
  FOREIGN KEY (instructor_id) REFERENCES instructors(user_id)
);

CREATE TABLE IF NOT EXISTS enrollments (
  student_id      TEXT NOT NULL,
  course_id       TEXT NOT NULL,
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(user_id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS excuse_requests (
  request_id              TEXT PRIMARY KEY,
  student_id              TEXT NOT NULL,
  course_id               TEXT NOT NULL,
  absence_date            TEXT NOT NULL,
  category                TEXT CHECK (category IN ('Medical','Family Emergency','Academic Conflict','Planned','DSS','Other')),
  reason                  TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Draft','Pending','Reviewing','Approved','Approved with Conditions','Partial Approval','Denied','More Info Requested','Escalated','Final Approved','Scheduled','Closed','Awaiting Student Proposal','Awaiting TA Confirmation','Awaiting Student Approval','Awaiting Reschedule')),
  priority                TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low','Normal','High','Urgent')),
  submission_timestamp_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
  decision_timestamp_utc  TEXT,
  instructor_comment      TEXT,
  conditions              TEXT,
  planned_absence_flag    INTEGER NOT NULL DEFAULT 0,
  dss_flag                INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (student_id) REFERENCES students(user_id),
  FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

CREATE TABLE IF NOT EXISTS supporting_documents (
  document_id             TEXT PRIMARY KEY,
  request_id              TEXT NOT NULL,
  file_name               TEXT NOT NULL,
  file_type               TEXT NOT NULL CHECK (file_type IN ('PDF','JPG','PNG')),
  file_size_kb            INTEGER NOT NULL,
  upload_timestamp_utc    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
  encrypted_flag          INTEGER NOT NULL DEFAULT 1,
  malware_scan_status     TEXT NOT NULL DEFAULT 'Pending' CHECK (malware_scan_status IN ('Passed','Failed','Pending')),
  consent_accepted        INTEGER NOT NULL DEFAULT 0,
  storage_path            TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES excuse_requests(request_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id         TEXT PRIMARY KEY,
  recipient_id            TEXT NOT NULL,
  request_id              TEXT,
  channel                 TEXT NOT NULL CHECK (channel IN ('Email','InApp','Both')),
  message_body            TEXT NOT NULL,
  sent_timestamp_utc      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
  read_status             INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipient_id) REFERENCES users(user_id),
  FOREIGN KEY (request_id) REFERENCES excuse_requests(request_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  log_id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp_utc           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
  action_type             TEXT NOT NULL,
  actor_user_id           TEXT NOT NULL,
  request_id              TEXT,
  details                 TEXT,
  hash_value              TEXT NOT NULL,
  previous_hash_value     TEXT NOT NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS request_comments (
  comment_id              INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id              TEXT NOT NULL,
  author_id               TEXT NOT NULL,
  author_role             TEXT NOT NULL,
  body                    TEXT NOT NULL,
  is_internal             INTEGER NOT NULL DEFAULT 0,
  created_at_utc          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
  FOREIGN KEY (request_id) REFERENCES excuse_requests(request_id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS retake_configurations (
  config_id               INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id               TEXT NOT NULL,
  assessment_type         TEXT NOT NULL CHECK (assessment_type IN ('Quiz','Midterm','Final','Lab','Presentation')),
  window_start            TEXT NOT NULL,
  window_end              TEXT NOT NULL,
  available_slots         INTEGER NOT NULL CHECK (available_slots >= 1),
  max_capacity            INTEGER NOT NULL CHECK (max_capacity >= 1),
  created_by_id           TEXT NOT NULL,
  created_timestamp_utc   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
  FOREIGN KEY (course_id) REFERENCES courses(course_id),
  FOREIGN KEY (created_by_id) REFERENCES instructors(user_id)
);

CREATE TABLE IF NOT EXISTS booked_retakes (
  booking_id              INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id              TEXT NOT NULL,
  config_id               INTEGER,
  student_id              TEXT NOT NULL,
  scheduled_datetime      TEXT NOT NULL,
  room                    TEXT NOT NULL,
  duration                INTEGER NOT NULL,
  dss_applied             INTEGER NOT NULL DEFAULT 0,
  status                  TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled','Completed','No-Show','Cancelled')),
  booked_timestamp_utc    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
  FOREIGN KEY (request_id) REFERENCES excuse_requests(request_id),
  FOREIGN KEY (config_id) REFERENCES retake_configurations(config_id),
  FOREIGN KEY (student_id) REFERENCES students(user_id)
);

CREATE TABLE IF NOT EXISTS ta_logistics_messages (
  message_id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id               TEXT NOT NULL,
  recipient_name          TEXT NOT NULL,
  message_body            TEXT NOT NULL,
  sent_timestamp_utc      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
  is_escalation           INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (sender_id) REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_requests_student ON excuse_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_requests_course  ON excuse_requests(course_id);
CREATE INDEX IF NOT EXISTS idx_requests_status  ON excuse_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_request    ON audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp  ON audit_log(timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_comments_request ON request_comments(request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);

-- ─── Lecture video library (added in v2) ────────────────────────────
CREATE TABLE IF NOT EXISTS lecture_videos (
  video_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id       TEXT NOT NULL,
  title           TEXT NOT NULL,
  lecture_date    TEXT NOT NULL,
  duration_min    INTEGER DEFAULT 50,
  topic           TEXT,
  description     TEXT,
  thumbnail_color TEXT DEFAULT '#1A3E5C',
  uploaded_at_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
  FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_videos_course ON lecture_videos(course_id);

-- ─── v2.2 additions: absence type, session type, direct messages ─────
-- Absence type on requests: exam/quiz/lecture/lab/presentation/other
-- Backwards compatible — existing rows keep NULL which is treated as generic.
-- SQLite doesn't support IF NOT EXISTS on ALTER TABLE, so we swallow the error on repeat runs.
-- (The connection layer handles that — see connection.js)

-- Direct messages between users (any-to-any)
CREATE TABLE IF NOT EXISTS direct_messages (
  message_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id         TEXT NOT NULL,
  recipient_id      TEXT NOT NULL,
  subject           TEXT,
  body              TEXT NOT NULL,
  request_id        TEXT,
  read_status       INTEGER NOT NULL DEFAULT 0,
  sent_timestamp_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
  FOREIGN KEY (sender_id) REFERENCES users(user_id),
  FOREIGN KEY (recipient_id) REFERENCES users(user_id)
);
CREATE INDEX IF NOT EXISTS idx_dm_recipient ON direct_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_dm_sender    ON direct_messages(sender_id);
