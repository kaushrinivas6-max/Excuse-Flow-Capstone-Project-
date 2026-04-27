// ═══════════════════════════════════════════════════════════════════
// Seed script — matches Deliverable 4 Section 7.3 Test Data
// Run: node utils/seed.js  (or npm run seed)
// ═══════════════════════════════════════════════════════════════════
const bcrypt = require('bcryptjs');
const db = require('../db/connection');
const audit = require('./audit');

const DEFAULT_PW = 'password123';

function seed() {
  console.log('▸ Clearing existing data...');
  db.pragma('foreign_keys = OFF');
  db.exec(`
    DELETE FROM booked_retakes;
    DELETE FROM retake_configurations;
    DELETE FROM ta_logistics_messages;
    DELETE FROM notifications;
    DELETE FROM supporting_documents;
    DELETE FROM request_comments;
    DELETE FROM lecture_videos;
    DELETE FROM excuse_requests;
    DELETE FROM enrollments;
    DELETE FROM courses;
    DELETE FROM teaching_assistants;
    DELETE FROM institution_admins;
    DELETE FROM instructors;
    DELETE FROM students;
    DELETE FROM audit_log;
    DELETE FROM users;
  `);
  db.pragma('foreign_keys = ON');

  const hash = bcrypt.hashSync(DEFAULT_PW, 10);

  // ─── Users ──────────────────────────────────────────────────────────
  console.log('▸ Creating users...');
  const users = [
    // Students
    { id: 'USR-001', name: 'Maria Garcia',        email: 'student@gwu.edu',     role: 'student' },
    { id: 'USR-002', name: 'James Chen',          email: 'jchen@gwu.edu',       role: 'student' },
    { id: 'USR-003', name: 'Aisha Patel',         email: 'apatel@gwu.edu',      role: 'student' },
    { id: 'USR-004', name: 'David Kim',           email: 'dkim@gwu.edu',        role: 'student' },
    { id: 'USR-005', name: 'Emily Watson',        email: 'ewatson@gwu.edu',     role: 'student' },
    { id: 'USR-006', name: 'Andres Villarreal',   email: 'avillarreal@gwu.edu', role: 'student' },
    // Instructors
    { id: 'USR-010', name: 'Prof. Dasgupta',      email: 'instructor@gwu.edu',  role: 'instructor' },
    { id: 'USR-011', name: 'Dr. Smith',           email: 'dsmith@gwu.edu',      role: 'instructor' },
    { id: 'USR-012', name: 'Dr. Johnson',         email: 'djohnson@gwu.edu',    role: 'instructor' },
    { id: 'USR-013', name: 'Dr. Frank Martinez',  email: 'fmartinez@gwu.edu',   role: 'instructor' },
    { id: 'USR-014', name: 'Dr. Shubha Ramesh',   email: 'sramesh@gwu.edu',     role: 'instructor' },
    { id: 'USR-015', name: 'Prof. Emily Brooks',  email: 'ebrooks@gwu.edu',     role: 'instructor' },
    { id: 'USR-016', name: 'Dr. Michael Torres',  email: 'mtorres@gwu.edu',     role: 'instructor' },
    // TAs
    { id: 'USR-020', name: 'Jade Blanchet',       email: 'ta@gwu.edu',          role: 'ta' },
    { id: 'USR-021', name: 'Ayla Karimova',       email: 'akarimova@gwu.edu',   role: 'ta' },
    { id: 'USR-022', name: 'Diego Mendoza',       email: 'dmendoza@gwu.edu',    role: 'ta' },
    { id: 'USR-023', name: 'Priya Kumar',         email: 'pkumar@gwu.edu',      role: 'ta' },
    { id: 'USR-024', name: 'Sarah Chen',          email: 'schen@gwu.edu',       role: 'ta' },
    // Admin
    { id: 'USR-030', name: 'Admin User',          email: 'admin@gwu.edu',       role: 'admin' },
    { id: 'USR-031', name: 'Dean Williams',       email: 'dwilliams@gwu.edu',   role: 'admin' },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (user_id, name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `);
  users.forEach(u => insertUser.run(u.id, u.name, u.email, hash, u.role));

  // ─── Student profiles ──────────────────────────────────────────────
  console.log('▸ Creating student profiles...');
  const insertStudent = db.prepare(`
    INSERT INTO students (user_id, student_id, class_year, major, dss_status, dss_multiplier)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertStudent.run('USR-001', 'STU-90234', 'Senior',    'Computer Science', 0, 1.00);
  insertStudent.run('USR-002', 'STU-78123', 'Junior',    'Info Systems',     0, 1.00);
  insertStudent.run('USR-003', 'STU-61045', 'Senior',    'Computer Science', 1, 1.50); // DSS
  insertStudent.run('USR-004', 'STU-55678', 'Sophomore', 'Info Systems',     0, 1.00);
  insertStudent.run('USR-005', 'STU-42890', 'Freshman',  'Computer Science', 0, 1.00);
  insertStudent.run('USR-006', 'STU-11001', 'Junior',    'Computer Science', 0, 1.00);

  // ─── Instructor profiles ───────────────────────────────────────────
  const insertInstructor = db.prepare(
    'INSERT INTO instructors (user_id, department) VALUES (?, ?)'
  );
  insertInstructor.run('USR-010', 'Information Systems');
  insertInstructor.run('USR-011', 'Computer Science');
  insertInstructor.run('USR-012', 'Mathematics');
  insertInstructor.run('USR-013', 'Psychology');
  insertInstructor.run('USR-014', 'Computer Science');
  insertInstructor.run('USR-015', 'Business');
  insertInstructor.run('USR-016', 'Economics');

  // ─── TA profiles ───────────────────────────────────────────────────
  const insertTA = db.prepare(
    'INSERT INTO teaching_assistants (user_id, assigned_section, supervisor_id) VALUES (?, ?, ?)'
  );
  insertTA.run('USR-020', 'Found. AI - 001',       'USR-010');  // Jade → Dasgupta
  insertTA.run('USR-021', 'InfoCap - A',           'USR-010');  // Ayla → Dasgupta
  insertTA.run('USR-022', 'Data Structures - 001', 'USR-011');  // Diego → Smith
  insertTA.run('USR-023', 'Intro Psych - 001',     'USR-013');  // Priya → Martinez
  insertTA.run('USR-024', 'Algorithms - 001',      'USR-014');  // Sarah → Ramesh

  // ─── Admin profiles ────────────────────────────────────────────────
  const insertAdmin = db.prepare(
    'INSERT INTO institution_admins (user_id, access_level, department_scope) VALUES (?, ?, ?)'
  );
  insertAdmin.run('USR-030', 'Institution', null);          // Full institution-wide
  insertAdmin.run('USR-031', 'Department',  'Computer Science');  // CS-only scope

  // ─── Courses ───────────────────────────────────────────────────────
  console.log('▸ Creating courses...');
  const insertCourse = db.prepare(`
    INSERT INTO courses
      (course_id, course_name, section, term, instructor_id,
       meeting_days, meeting_time, meeting_duration, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // Dasgupta (USR-010) — Information Systems
  insertCourse.run('CSCI-6364', 'Foundations of AI',        '001', 'Spring 2026', 'USR-010', 'MW',  '10:00', 75, '#C5841F');
  insertCourse.run('CSCI-6465', 'Information Capstone',     'A',   'Spring 2026', 'USR-010', 'TR',  '14:00', 75, '#2980B9');
  // Smith (USR-011) — Computer Science
  insertCourse.run('CS-301',    'Data Structures',          '001', 'Spring 2026', 'USR-011', 'MWF', '09:00', 50, '#27AE60');
  insertCourse.run('CS-320',    'Operating Systems',        '001', 'Spring 2026', 'USR-011', 'TR',  '13:00', 75, '#16A085');
  // Johnson (USR-012) — Mathematics
  insertCourse.run('MATH-210',  'Linear Algebra',           '001', 'Spring 2026', 'USR-012', 'TR',  '11:00', 75, '#8E44AD');
  insertCourse.run('MATH-240',  'Discrete Mathematics',     '001', 'Spring 2026', 'USR-012', 'MWF', '11:00', 50, '#9B59B6');
  // Martinez (USR-013) — Psychology
  insertCourse.run('PSYC-101',  'Introduction to Psychology','001', 'Spring 2026', 'USR-013', 'MWF', '13:00', 50, '#E74C3C');
  insertCourse.run('PSYC-310',  'Cognitive Psychology',     '001', 'Spring 2026', 'USR-013', 'TR',  '10:00', 75, '#C0392B');
  // Ramesh (USR-014) — Computer Science
  insertCourse.run('CS-410',    'Algorithms',               '001', 'Spring 2026', 'USR-014', 'MWF', '10:00', 50, '#2C3E50');
  insertCourse.run('CS-455',    'Machine Learning',         '001', 'Spring 2026', 'USR-014', 'TR',  '15:00', 75, '#34495E');
  // Brooks (USR-015) — Business
  insertCourse.run('BADM-201',  'Principles of Management', '001', 'Spring 2026', 'USR-015', 'MW',  '14:00', 75, '#F39C12');
  insertCourse.run('BADM-310',  'Marketing Strategy',       '001', 'Spring 2026', 'USR-015', 'TR',  '09:00', 75, '#D35400');
  // Torres (USR-016) — Economics
  insertCourse.run('ECON-201',  'Microeconomics',           '001', 'Spring 2026', 'USR-016', 'MWF', '14:00', 50, '#3498DB');
  insertCourse.run('ECON-310',  'Econometrics',             '001', 'Spring 2026', 'USR-016', 'TR',  '16:00', 75, '#2980B9');

  // ─── Enrollments ───────────────────────────────────────────────────
  console.log('▸ Enrolling students...');
  const enroll = db.prepare('INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)');
  // Every student takes the 2 Dasgupta courses (baseline for existing demo scripts)
  ['USR-001','USR-002','USR-003','USR-004','USR-005','USR-006'].forEach(s => {
    enroll.run(s, 'CSCI-6364');
    enroll.run(s, 'CSCI-6465');
  });
  // Diverse schedules — each student takes 2-4 extra courses spanning different departments
  // so the "routing" story is visible (requests go to different instructors based on course)
  enroll.run('USR-001', 'CS-301');    enroll.run('USR-001', 'MATH-210');  enroll.run('USR-001', 'PSYC-101');
  enroll.run('USR-002', 'CS-301');    enroll.run('USR-002', 'BADM-201');  enroll.run('USR-002', 'ECON-201');
  enroll.run('USR-003', 'MATH-210');  enroll.run('USR-003', 'MATH-240');  enroll.run('USR-003', 'CS-410');
  enroll.run('USR-004', 'PSYC-101');  enroll.run('USR-004', 'PSYC-310');  enroll.run('USR-004', 'BADM-310');
  enroll.run('USR-005', 'CS-320');    enroll.run('USR-005', 'CS-455');    enroll.run('USR-005', 'ECON-310');
  enroll.run('USR-006', 'BADM-201');  enroll.run('USR-006', 'BADM-310');  enroll.run('USR-006', 'ECON-201'); enroll.run('USR-006', 'PSYC-101');

  // ─── Excuse requests (matching D4 §7.3) ────────────────────────────
  console.log('▸ Creating sample excuse requests...');
  const insertReq = db.prepare(`
    INSERT INTO excuse_requests
      (request_id, student_id, course_id, absence_date, category, reason,
       status, priority, submission_timestamp_utc, decision_timestamp_utc,
       instructor_comment, planned_absence_flag, dss_flag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const reqs = [
    ['EF-2026-00142','USR-001','CSCI-6364','2026-02-09','Medical',
     'Medical appointment that could not be rescheduled.',
     'Pending','High','2026-02-10 04:15:00',null,null,0,0],
    ['EF-2026-00143','USR-002','CSCI-6465','2026-02-11','Family Emergency',
     'Family emergency — immediate family member hospitalized.',
     'Approved','High','2026-02-12 02:45:00','2026-02-13 14:20:45',
     'Submit missed work by Friday.',0,0],
    ['EF-2026-00144','USR-003','CSCI-6364','2026-02-13','DSS',
     'DSS-related accommodation need.',
     'Reviewing','High','2026-02-13 11:30:00',null,null,0,1],
    ['EF-2026-00145','USR-004','CSCI-6465','2026-02-19','Planned',
     'Planned absence — academic conference.',
     'Pending','Normal','2026-02-08 06:00:00',null,null,1,0],
    ['EF-2026-00146','USR-005','CSCI-6364','2026-02-08','Medical',
     'Illness — flu symptoms.',
     'Denied','Normal','2026-02-09 08:00:00','2026-02-11 10:30:18',
     'No supporting documentation provided.',0,0],
    ['EF-2026-00147','USR-004','CSCI-6465','2026-02-10','Academic Conflict',
     'Academic conflict — midterm at same time.',
     'More Info Requested','Normal','2026-02-10 09:20:00','2026-02-12 09:00:33',
     'Provide confirmation from department.',0,0],
    ['EF-2026-00150','USR-006','CSCI-6364','2026-01-19','Medical',
     'Doctor visit for ongoing treatment.',
     'Approved','High','2026-01-20 03:00:00','2026-01-21 11:00:00',
     'Approved. Submit makeup work within 1 week.',0,0],
    ['EF-2026-00151','USR-006','CSCI-6364','2026-01-26','Medical',
     'Medical procedure requiring recovery time.',
     'Approved with Conditions','High','2026-01-27 03:00:00','2026-01-28 09:30:00',
     'Approved with conditions: extension granted for midterm, in-class quiz must still be made up.',0,0],
  ];
  reqs.forEach(r => insertReq.run(...r));

  // Structured conditions on the "Approved with Conditions" request
  db.prepare('UPDATE excuse_requests SET conditions = ? WHERE request_id = ?').run(
    JSON.stringify([
      { type: 'deadline_extension', days: 7, scope: 'midterm', detail: '7 days for midterm' },
      { type: 'makeup_required', item: 'in-class quiz', by: '2026-02-05', detail: 'in-class quiz by 2026-02-05' }
    ]),
    'EF-2026-00151'
  );

  // ─── Sample supporting documents ───────────────────────────────────
  console.log('▸ Creating sample document records...');
  const insertDoc = db.prepare(`
    INSERT INTO supporting_documents
      (document_id, request_id, file_name, file_type, file_size_kb,
       malware_scan_status, consent_accepted, storage_path)
    VALUES (?, ?, ?, ?, ?, 'Passed', 1, ?)
  `);
  insertDoc.run('DOC-DEMO001', 'EF-2026-00142', 'doctor_note.pdf',  'PDF', 245, 'demo/doctor_note.pdf');
  insertDoc.run('DOC-DEMO002', 'EF-2026-00144', 'dss_letter.pdf',   'PDF', 132, 'demo/dss_letter.pdf');
  insertDoc.run('DOC-DEMO003', 'EF-2026-00150', 'doctor_note.pdf',  'PDF', 180, 'demo/doctor_note_2.pdf');
  insertDoc.run('DOC-DEMO004', 'EF-2026-00151', 'medical_cert.pdf', 'PDF', 290, 'demo/medical_cert.pdf');

  // ─── Retake configurations ─────────────────────────────────────────
  console.log('▸ Creating retake configurations...');
  const insertCfg = db.prepare(`
    INSERT INTO retake_configurations
      (course_id, assessment_type, window_start, window_end,
       available_slots, max_capacity, created_by_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertCfg.run('CSCI-6364', 'Quiz',    '2026-02-15', '2026-02-28', 3, 5, 'USR-010');
  insertCfg.run('CSCI-6364', 'Midterm', '2026-03-01', '2026-03-10', 2, 3, 'USR-010');
  insertCfg.run('CSCI-6465', 'Lab',     '2026-02-20', '2026-03-05', 4, 6, 'USR-010');

  // ─── Sample bookings (today / tomorrow / day after so proctoring always has something) ─
  const now = new Date();
  function sqlDate(daysOffset, hour, minute) {
    const d = new Date(now);
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hour, minute, 0, 0);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}:00`;
  }
  const insertBooking = db.prepare(`
    INSERT INTO booked_retakes
      (request_id, config_id, student_id, scheduled_datetime, room, duration, dss_applied, status, session_type, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // Pick any already-Approved request IDs from the seeded set. These were inserted above.
  // EF-2026-00143 was approved (see sample requests array). Others we'll add fresh scheduled ones.
  insertBooking.run('EF-2026-00143', 1, 'USR-002', sqlDate(0, 14, 0),  'Room 214',   60, 0, 'Scheduled', 'Midterm Retake',    'Bring calculator and two pencils.');
  insertBooking.run('EF-2026-00143', 2, 'USR-002', sqlDate(1, 10, 0),  'Lab B-110',  90, 0, 'Scheduled', 'Lab',               'Makeup for Lab 3.');
  insertBooking.run('EF-2026-00143', 1, 'USR-002', sqlDate(2, 15, 30), 'Zoom',       45, 0, 'Scheduled', 'Office Hours',      'Review session.');

  // ─── Lecture video library (~25 recordings) ───────────────────────
  console.log('▸ Creating lecture video library...');
  const insertVideo = db.prepare(`
    INSERT INTO lecture_videos (course_id, title, lecture_date, duration_min, topic, description, thumbnail_color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const videos = [
    // CSCI-6364 Foundations of AI (gold)
    ['CSCI-6364', 'Lecture 1: What is Artificial Intelligence?', '2026-01-12', 75, 'Intro',         'History of AI, the Turing test, rational agents.',                '#C5841F'],
    ['CSCI-6364', 'Lecture 2: Search Algorithms',                '2026-01-14', 75, 'Search',        'BFS, DFS, uniform-cost, A* with heuristics.',                     '#C5841F'],
    ['CSCI-6364', 'Lecture 3: Adversarial Search & Games',       '2026-01-21', 75, 'Game Theory',   'Minimax, alpha-beta pruning, game trees.',                        '#C5841F'],
    ['CSCI-6364', 'Lecture 4: Constraint Satisfaction',          '2026-01-26', 75, 'CSP',           'Backtracking, forward checking, arc consistency.',                '#C5841F'],
    ['CSCI-6364', 'Lecture 5: Propositional Logic',              '2026-01-28', 75, 'Logic',         'Syntax, semantics, resolution, SAT solvers.',                     '#C5841F'],
    ['CSCI-6364', 'Lecture 6: First-Order Logic',                '2026-02-02', 75, 'Logic',         'Quantifiers, unification, forward and backward chaining.',        '#C5841F'],
    ['CSCI-6364', 'Lecture 7: Machine Learning Foundations',     '2026-02-04', 75, 'ML',            'Supervised vs. unsupervised, train/test split, bias-variance.',   '#C5841F'],
    ['CSCI-6364', 'Lecture 8: Neural Networks',                  '2026-02-09', 75, 'Deep Learning', 'Perceptrons, backpropagation, activation functions.',             '#C5841F'],
    ['CSCI-6364', 'Lecture 9: Ethics in AI',                     '2026-02-11', 75, 'Ethics',        'Bias in datasets, fairness metrics, real-world case studies.',    '#C5841F'],

    // CSCI-6465 InfoCapstone (blue)
    ['CSCI-6465', 'Lecture 1: Capstone Kickoff',                 '2026-01-13', 75, 'Intro',         'Team formation, project expectations, grading rubric.',           '#2980B9'],
    ['CSCI-6465', 'Lecture 2: Scrum and Agile Methodology',      '2026-01-15', 75, 'Methodology',   'Sprints, user stories, velocity, burndown charts.',               '#2980B9'],
    ['CSCI-6465', 'Lecture 3: Business Case Writing',            '2026-01-22', 75, 'Writing',       'Problem statement, value proposition, ROI analysis.',             '#2980B9'],
    ['CSCI-6465', 'Lecture 4: ERD and Data Modeling',            '2026-01-27', 75, 'Data',          'Entity relationships, normalization, data dictionary.',           '#2980B9'],
    ['CSCI-6465', 'Lecture 5: Security and FERPA Compliance',    '2026-01-29', 75, 'Security',      'Authentication, RBAC, audit logs, regulatory compliance.',        '#2980B9'],
    ['CSCI-6465', 'Lecture 6: Presenting to Stakeholders',       '2026-02-03', 75, 'Communication', 'Deck structure, demo flow, handling tough questions.',            '#2980B9'],

    // CS-301 Data Structures (green)
    ['CS-301',    'Lecture 1: Arrays and Dynamic Arrays',        '2026-01-12', 50, 'Arrays',        'Amortized analysis, resizing strategies.',                        '#27AE60'],
    ['CS-301',    'Lecture 2: Linked Lists',                     '2026-01-14', 50, 'Lists',         'Singly, doubly, and circular linked lists.',                      '#27AE60'],
    ['CS-301',    'Lecture 3: Stacks and Queues',                '2026-01-16', 50, 'Stacks/Queues', 'Array-backed vs. list-backed, common use cases.',                 '#27AE60'],
    ['CS-301',    'Lecture 4: Hash Tables',                      '2026-01-21', 50, 'Hashing',       'Open addressing, chaining, load factor, rehashing.',              '#27AE60'],
    ['CS-301',    'Lecture 5: Binary Trees and BSTs',            '2026-01-26', 50, 'Trees',         'Traversals, insertion, deletion, balanced vs. unbalanced.',       '#27AE60'],
    ['CS-301',    'Lecture 6: Heaps and Priority Queues',        '2026-01-28', 50, 'Heaps',         'Min/max heaps, heapify, heap sort.',                              '#27AE60'],

    // MATH-210 Linear Algebra (purple)
    ['MATH-210',  'Lecture 1: Systems of Linear Equations',      '2026-01-13', 75, 'Linear Systems', 'Gaussian elimination, row echelon form.',                        '#8E44AD'],
    ['MATH-210',  'Lecture 2: Matrix Operations',                '2026-01-15', 75, 'Matrices',       'Addition, multiplication, transpose, identity.',                 '#8E44AD'],
    ['MATH-210',  'Lecture 3: Determinants',                     '2026-01-20', 75, 'Determinants',   'Cofactor expansion, properties, Cramer rule.',                   '#8E44AD'],
    ['MATH-210',  'Lecture 4: Vector Spaces',                    '2026-01-22', 75, 'Vector Spaces',  'Basis, dimension, subspaces, linear independence.',              '#8E44AD'],
    ['MATH-210',  'Lecture 5: Eigenvalues and Eigenvectors',     '2026-01-27', 75, 'Eigenvalues',    'Characteristic polynomial, diagonalization.',                    '#8E44AD'],
  ];
  videos.forEach(v => insertVideo.run(...v));

  // ─── Sample TA messages ────────────────────────────────────────────
  const insertMsg = db.prepare(`
    INSERT INTO ta_logistics_messages (sender_id, recipient_name, message_body, is_escalation)
    VALUES (?, ?, ?, ?)
  `);
  insertMsg.run('USR-020', 'Maria Garcia', 'Your Quiz 2 makeup has not been scheduled yet.', 0);
  insertMsg.run('USR-021', 'James Chen',   'Makeup confirmed Feb 21 2PM Lab 4B. Arrive 10 min early.', 0);
  insertMsg.run('USR-020', 'Instructor',   'David Kim has a room conflict. Instructor review requested.', 1);

  // ─── Re-seed audit log with realistic history ──────────────────────
  console.log('▸ Seeding audit log...');
  const entries = [
    { actor: 'SYSTEM',  action: 'Request Created',      requestId: 'EF-2026-00145', details: 'Planned absence — conference' },
    { actor: 'SYSTEM',  action: 'Request Created',      requestId: 'EF-2026-00142', details: 'Student submission' },
    { actor: 'USR-011', action: 'Request Denied',       requestId: 'EF-2026-00146', details: 'No supporting documentation provided.' },
    { actor: 'USR-010', action: 'More Info Requested',  requestId: 'EF-2026-00147', details: 'Provide confirmation from department.' },
    { actor: 'USR-011', action: 'Request Approved',     requestId: 'EF-2026-00143', details: 'Submit missed work by Friday.' },
    { actor: 'USR-010', action: 'Status → Reviewing',   requestId: 'EF-2026-00144', details: 'DSS request prioritized' },
  ];
  entries.forEach(e => {
    try { audit.log(e); }
    catch (err) { console.log('  (skipped audit entry: ' + err.message + ')'); }
  });

  console.log('✓ Database seeded successfully.');
  console.log('');
  console.log('Login credentials (all users — password: ' + DEFAULT_PW + '):');
  console.log('  Student:    student@gwu.edu');
  console.log('  Instructor: instructor@gwu.edu');
  console.log('  TA:         ta@gwu.edu');
  console.log('  Admin:      admin@gwu.edu');
}

if (require.main === module) {
  try {
    seed();
    process.exit(0);
  } catch (err) {
    console.error('✗ Seed failed:', err);
    process.exit(1);
  }
}

module.exports = { seed };
