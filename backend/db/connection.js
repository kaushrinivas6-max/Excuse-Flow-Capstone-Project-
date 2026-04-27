// ═══════════════════════════════════════════════════════════════════
// Database connection (SQLite via better-sqlite3 — synchronous, fast)
// ═══════════════════════════════════════════════════════════════════
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'excuseflow.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
}

function runMigrations() {
  // Idempotent ALTER TABLE — SQLite lacks "IF NOT EXISTS" for ADD COLUMN, so we check first
  const cols = db.prepare(`PRAGMA table_info(excuse_requests)`).all().map(c => c.name);
  if (!cols.includes('absence_type')) {
    db.prepare(`ALTER TABLE excuse_requests ADD COLUMN absence_type TEXT`).run();
  }
  if (!cols.includes('proposed_times')) {
    db.prepare(`ALTER TABLE excuse_requests ADD COLUMN proposed_times TEXT`).run();  // JSON array
  }
  const bookingCols = db.prepare(`PRAGMA table_info(booked_retakes)`).all().map(c => c.name);
  if (!bookingCols.includes('session_type')) {
    db.prepare(`ALTER TABLE booked_retakes ADD COLUMN session_type TEXT`).run();
  }
  if (!bookingCols.includes('notes')) {
    db.prepare(`ALTER TABLE booked_retakes ADD COLUMN notes TEXT`).run();
  }

  // ─── Critical fix: the original CHECK constraint on excuse_requests.status
  // didn't include the new workflow statuses. Detect any missing status and rebuild.
  const tableSql = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='excuse_requests'`).get()?.sql || '';
  if (tableSql.includes("CHECK (status IN") && !tableSql.includes('Awaiting Student Approval')) {
    console.log('▸ Migrating excuse_requests CHECK constraint…');
    db.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN TRANSACTION;

      CREATE TABLE excuse_requests_new (
        request_id              TEXT PRIMARY KEY,
        student_id              TEXT NOT NULL,
        course_id               TEXT NOT NULL,
        absence_date            TEXT NOT NULL,
        category                TEXT,
        reason                  TEXT NOT NULL,
        status                  TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Draft','Pending','Reviewing','Approved','Approved with Conditions','Partial Approval','Denied','More Info Requested','Escalated','Final Approved','Scheduled','Closed','Awaiting Student Proposal','Awaiting TA Confirmation','Awaiting Student Approval','Awaiting Reschedule')),
        priority                TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low','Normal','High','Urgent')),
        submission_timestamp_utc TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
        decision_timestamp_utc  TEXT,
        instructor_comment      TEXT,
        conditions              TEXT,
        planned_absence_flag    INTEGER NOT NULL DEFAULT 0,
        dss_flag                INTEGER NOT NULL DEFAULT 0,
        absence_type            TEXT,
        proposed_times          TEXT,
        FOREIGN KEY (student_id) REFERENCES students(user_id),
        FOREIGN KEY (course_id) REFERENCES courses(course_id)
      );

      INSERT INTO excuse_requests_new
        (request_id, student_id, course_id, absence_date, category, reason, status, priority,
         submission_timestamp_utc, decision_timestamp_utc, instructor_comment, conditions,
         planned_absence_flag, dss_flag, absence_type, proposed_times)
      SELECT
        request_id, student_id, course_id, absence_date, category, reason, status, priority,
        submission_timestamp_utc, decision_timestamp_utc, instructor_comment, conditions,
        planned_absence_flag, dss_flag, absence_type, proposed_times
      FROM excuse_requests;

      DROP TABLE excuse_requests;
      ALTER TABLE excuse_requests_new RENAME TO excuse_requests;

      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
    console.log('  ✓ Constraint updated.');
  }

  // ─── Fix booked_retakes: original schema had config_id NOT NULL, which broke
  // ad-hoc bookings that aren't tied to a pre-configured retake window.
  const brSql = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='booked_retakes'`).get()?.sql || '';
  if (brSql.includes('config_id               INTEGER NOT NULL')) {
    console.log('▸ Migrating booked_retakes to allow nullable config_id…');
    db.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN TRANSACTION;

      CREATE TABLE booked_retakes_new (
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
        session_type            TEXT,
        notes                   TEXT,
        FOREIGN KEY (request_id) REFERENCES excuse_requests(request_id),
        FOREIGN KEY (config_id) REFERENCES retake_configurations(config_id),
        FOREIGN KEY (student_id) REFERENCES students(user_id)
      );

      INSERT INTO booked_retakes_new
        (booking_id, request_id, config_id, student_id, scheduled_datetime, room, duration,
         dss_applied, status, booked_timestamp_utc, session_type, notes)
      SELECT
        booking_id, request_id,
        CASE WHEN config_id = 0 THEN NULL ELSE config_id END,
        student_id, scheduled_datetime, room, duration,
        dss_applied, status, booked_timestamp_utc, session_type, notes
      FROM booked_retakes;

      DROP TABLE booked_retakes;
      ALTER TABLE booked_retakes_new RENAME TO booked_retakes;

      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
    console.log('  ✓ booked_retakes migrated.');
  }
}

function ensureGenesisAudit() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n;
  if (count === 0) {
    // Make sure the SYSTEM user exists for the audit foreign-key
    db.prepare(`
      INSERT OR IGNORE INTO users (user_id, name, email, password_hash, role)
      VALUES ('SYSTEM', 'System', 'system@excuseflow.internal', 'N/A', 'admin')
    `).run();

    const crypto = require('crypto');
    const genesisHash = crypto.createHash('sha256')
      .update('EXCUSEFLOW_GENESIS_BLOCK_v1.0')
      .digest('hex');
    db.prepare(`
      INSERT INTO audit_log (action_type, actor_user_id, details, hash_value, previous_hash_value)
      VALUES ('System Initialized', 'SYSTEM', 'Genesis block — audit chain started', ?, '0000000000000000000000000000000000000000000000000000000000000000')
    `).run(genesisHash);
  }
}

initSchema();
runMigrations();
ensureGenesisAudit();

module.exports = db;
