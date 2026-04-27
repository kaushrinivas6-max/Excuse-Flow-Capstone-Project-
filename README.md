# ExcuseFlow 🎓

**Blackboard Administrative Workflow Extension**
*A FERPA-compliant, audit-ready academic excuse management system*

ISTM 4210 Capstone · George Washington University · Spring 2026
*Andres · Karime · Kaushik · Romain · Jade · Ayla*

---

## 📖 Overview

ExcuseFlow is a full-stack web application that replaces the scattered email-based absence-request process at universities with a secure, role-based, auditable workflow. Students submit absence requests with optional documentation; instructors review with six nuanced decision options; TAs coordinate retake logistics without accessing medical records; administrators monitor anonymized analytics and a tamper-proof audit log.

Designed as an extension to existing LMS platforms (Blackboard, Canvas) rather than a replacement, ExcuseFlow fills the administrative gap the LMS leaves behind.

---

## ✨ Key Features

### For Students
- **Submit requests** with optional file upload (PDF/JPG/PNG ≤5MB, malware-scanned, encrypted at rest)
- **Threaded discussion** with the instructor on each request
- **Automatic DSS accommodations** (1.5x/2x time multipliers applied to retake slots)
- **Retake scheduling portal** unlocks when status reaches an approved state
- **Missed materials** with 7-day auto-expiring lecture recording links (SCRUM-40)

### For Instructors
- **Unified inbox** with role-scoped requests (only courses you teach)
- **6 nuanced decision types** — beyond binary Approve/Deny:
  - ✓ **Approve** — full approval
  - ⚙ **Approve with Conditions** — with structured conditions (deadline extensions, makeup requirements, late-penalty waivers)
  - ½ **Partial Approval** — excuse some assessments, not others
  - ? **Request More Info** — opens a dialog loop with the student
  - ⬆ **Escalate** — flag for department head review
  - ✕ **Deny** — final rejection with required justification
- **Priority control** — Low / Normal / High / Urgent (with pulse animation for Urgent)
- **Auto-stale flagging** — pending requests aging >3 days highlighted
- **Per-class analytics** and retake window configuration

### For Teaching Assistants
- **Logistics queue** restricted to instructor-approved requests only
- **Scheduling center** with DSS auto-extension
- **Proctoring attendance** (Present / No-Show) with timestamped logging
- **Escalation channel** to primary instructor
- **Hard RBAC block** on medical documentation viewing (BR-12)

### For Institution Administrators
- **Anonymized analytics** — department trends, categories, weekly volume, status mix
- **Flagged instructor detection** — response time >48h or pending >5d
- **High-risk student count** (>3 requests/semester) — counts only, never identities
- **Hash-chained audit log** (SCRUM-19) with real SHA-256 verification
- **Historical read-only database** (SCRUM-7) — no edit/delete paths
- **Compliance exports** (PDF/CSV) — each export itself generates an audit entry

### Security & Compliance
- **JWT authentication** (8h expiry) with bcrypt-hashed passwords
- **Role-Based Access Control** enforced at every endpoint (not just UI)
- **Hash-chained audit log** — every action SHA-256-linked to the prior entry; tampering with any mid-chain entry is detectable via `/api/admin/audit/verify`
- **FERPA consent** required before document upload
- **Rate limiting** on login (20/15min) and API (300/15min)
- **Helmet** for secure HTTP headers
- **CORS** allow-list
- **File validation** — MIME type + extension + size + malware scan status

---

## 🏗 Architecture

```
excuseflow/
├── backend/                    Node.js + Express + SQLite API
│   ├── server.js               Entry point + middleware stack
│   ├── db/
│   │   ├── schema.sql          13-table schema matching Deliverable 4 ERD
│   │   └── connection.js       better-sqlite3 wrapper + genesis audit block
│   ├── middleware/
│   │   └── auth.js             JWT sign/verify + requireRole() RBAC helper
│   ├── routes/
│   │   ├── auth.js             /api/auth — login/logout/me
│   │   ├── requests.js         /api/requests — CRUD, decisions, comments, files
│   │   ├── courses.js          /api/courses — roster
│   │   ├── notifications.js    /api/notifications — bell/polling
│   │   ├── admin.js            /api/admin — analytics, audit, historical
│   │   └── ta.js               /api/ta + /api/retakes — logistics
│   ├── utils/
│   │   ├── audit.js            Hash-chained audit log with verify()
│   │   ├── ids.js              Request/document ID generators
│   │   └── seed.js             Populates D4 §7.3 test data
│   ├── uploads/                User-uploaded documents (gitignored)
│   └── test/
│       └── smoke.test.js       CI smoke tests
│
├── frontend/                   Static SPA (no build step)
│   ├── index.html              Login + app shell
│   ├── api.js                  fetch() wrapper with Bearer token
│   ├── app.js                  Views, state, decision modal, comments
│   └── styles.css              Original design + new enhancements
│
└── .github/workflows/
    └── ci.yml                  Lint + test + security audit on push/PR
```

### Data Flow
```
Student submits request
      ↓
[RBAC check → enrollment check → validation → file scan]
      ↓
INSERT excuse_requests + supporting_documents
      ↓
audit.log() → SHA-256 hash chained to previous entry
      ↓
Notification row inserted for instructor
      ↓
──────────────────────────────────────────
Instructor clicks Review → openReviewModal()
      ↓
Selects one of 6 decision types [+ optional conditions]
      ↓
POST /api/requests/:id/decision
      ↓
[RBAC — must teach this course]
      ↓
UPDATE status, decision_timestamp, conditions (JSON)
      ↓
INSERT request_comments (decision recorded in thread)
      ↓
audit.log() + notification to student
```

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- **Node.js 18+** (20 LTS recommended) — https://nodejs.org
- **Git**
- That's it. No Docker, no PostgreSQL, no external services.

### 1. Clone & install
```bash
git clone <your-repo-url> excuseflow
cd excuseflow/backend
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# The defaults work out of the box for local dev.
# In production: change JWT_SECRET to a random 32+ character string.
```

### 3. Seed the database
```bash
npm run seed
```

This creates:
- 12 users (6 students, 3 instructors, 2 TAs, 1 admin)
- 4 courses, with enrollments
- 8 sample excuse requests (matching Deliverable 4 §7.3)
- 3 retake window configurations
- Sample documents, bookings, TA messages
- A seeded audit log with cryptographic hash chain

### 4. Start the server
```bash
npm start
```

You'll see:
```
╔══════════════════════════════════════════════════╗
║  ExcuseFlow API — FERPA Compliant v1.0           ║
║  Blackboard Administrative Workflow Extension    ║
╚══════════════════════════════════════════════════╝
  → Listening on http://localhost:3000
  → Health check: http://localhost:3000/api/health
```

### 5. Open in browser
Visit **http://localhost:3000** — the backend also serves the frontend, so it's all one URL.

---

## 🔑 Demo Login Credentials

All accounts use password: **`password123`**

| Role       | Email                     | What you can do                                    |
|------------|---------------------------|----------------------------------------------------|
| Student    | `student@gwu.edu`         | Submit requests, upload docs, book retakes         |
| Instructor | `instructor@gwu.edu`      | Review with 6 decision types, configure retakes    |
| TA         | `ta@gwu.edu`              | Manage logistics queue, mark attendance (no docs!) |
| Admin      | `admin@gwu.edu`           | Anonymized analytics, audit log, verify chain      |

The login screen has one-click demo buttons for each role.

---

## 🧪 Testing

### Run smoke tests
```bash
cd backend
npm test
```

Output:
```
▸ Running smoke tests

Database:
  ✓ schema creates all expected tables
  ✓ genesis audit entry exists on fresh DB

Seeding:
  ✓ seed script runs without error
  ✓ seed creates 12 users
  ✓ seed creates 8 excuse requests
  ✓ seed creates 4 courses

Audit chain:
  ✓ hash chain is valid after seed
  ✓ appending an entry preserves chain validity
  ✓ tampering with a prior entry is detected ← 🔐 SCRUM-19 proven

Business rules:
  ✓ password hashes are stored (not plaintext)
  ✓ DSS student has 1.5x multiplier (Aisha Patel)
  ✓ Approved with Conditions request has JSON conditions

▸ Results: 12 passed, 0 failed
```

### Manual end-to-end walkthrough
1. Sign in as `student@gwu.edu`
2. Click **"+ New Request"** — select a course, pick a date, upload a PDF, submit
3. Sign out, sign in as `instructor@gwu.edu`
4. Open **Request Inbox** — find the new request, click **Review**
5. Try each decision type:
   - **Approve with Conditions** — add structured conditions (deadline extension, makeup, etc.)
   - **Partial Approval** — excuse some items not others
   - **Request More Info** — triggers dialog loop
6. Post a comment in the discussion thread
7. Sign out, sign in as `admin@gwu.edu`
8. Open **Audit Log** — see the hash-chain integrity check pass (green banner)
9. Open **Analytics** — see anonymized charts built from real DB data

---

## 🔧 API Reference

### Authentication
- `POST /api/auth/login` — `{email, password}` → `{token, user}`
- `POST /api/auth/logout` — requires auth
- `GET /api/auth/me` — current user + profile

### Requests
- `GET /api/requests` — scoped list (students see own; instructors see their courses; TAs see approved only in their sections; admins see all)
  - Query params: `status`, `course`, `category`, `q` (search)
- `GET /api/requests/:id` — single request with threaded comments
- `POST /api/requests` — `multipart/form-data` with `courseId`, `absenceDate`, `reason`, `category`, `plannedAbsence`, `consent`, optional `document` file
- `POST /api/requests/:id/decision` — `{decision, comment, conditions[]}` — instructor only
- `POST /api/requests/:id/comments` — `{body}` — threaded discussion
- `POST /api/requests/:id/priority` — `{priority: 'Low'|'Normal'|'High'|'Urgent'}`
- `GET /api/requests/:id/document` — download attached file (blocked for TAs)

### Admin
- `GET /api/admin/analytics` — anonymized aggregates (filter by department/semester)
- `GET /api/admin/audit` — audit log entries (filter by requestId/from/to)
- `GET /api/admin/audit/verify` — cryptographic chain verification
- `POST /api/admin/export` — records export event
- `GET /api/admin/historical` — read-only historical records

### TA & Retakes
- `GET /api/ta/queue` — logistics queue (approved requests only)
- `POST /api/ta/attendance` — `{bookingId, status}`
- `GET|POST /api/ta/messages` — logistics communication log
- `GET|POST|DELETE /api/retakes/configs` — retake window management
- `POST /api/retakes/book` — student books slot (with auto-DSS multiplier)
- `GET /api/retakes/mine` — my bookings

---

## 🔐 Security Highlights

| Control | Implementation |
|---------|---------------|
| **Authentication** | JWT with 8h expiry, bcrypt password hashes (10 rounds) |
| **Authorization (RBAC)** | Enforced server-side on every endpoint — not just UI |
| **Audit integrity** | SHA-256 hash chain; `verifyChain()` walks every entry; demo test proves tampering is detectable |
| **FERPA consent** | Server-side enforced; document uploads rejected without `consent=true` |
| **TA document block** | `GET /api/requests/:id/document` returns 403 for role `ta` |
| **Student scoping** | Students query own requests only; attempting another student's ID → 403 |
| **Instructor scoping** | Instructors restricted to courses they teach via `courses.instructor_id` join |
| **Admin anonymization** | Analytics queries strip PII at the SQL layer before returning data |
| **Rate limiting** | 20 login attempts / 15 min per IP; 300 API calls / 15 min |
| **File validation** | Extension + size + filter + status enum (`Passed`/`Failed`/`Pending`) |
| **Helmet + CORS** | Secure headers + explicit origin allow-list |
| **No secrets in code** | CI job greps for hardcoded credentials |

---

## 🚢 Deployment

### GitHub repository setup
```bash
cd excuseflow
git init
git add .
git commit -m "Initial commit — ExcuseFlow capstone"
git branch -M main
git remote add origin https://github.com/<your-username>/excuseflow.git
git push -u origin main
```

The CI pipeline (`.github/workflows/ci.yml`) will automatically:
- Run backend tests on Node 18.x and 20.x
- Verify the server boots and `/api/health` responds
- Validate frontend syntax
- Run `npm audit` for high+ severity issues
- Grep for hardcoded secrets

### Production deployment (any Node host)
Any host that runs Node.js works — Render, Railway, Fly.io, Heroku, AWS EC2, DigitalOcean, Azure App Service. Steps:

1. Set `JWT_SECRET` to a 32+ character random string in the host's env vars
2. Set `CORS_ORIGIN` to your production domain
3. Set `NODE_ENV=production`
4. Run `npm install && npm run seed && npm start`
5. For production you'll want to swap SQLite for PostgreSQL — the connection abstraction in `db/connection.js` makes this a one-file change

---

## 📚 Alignment with Capstone Deliverables

| Deliverable | Component | Implementation |
|-------------|-----------|----------------|
| **D1** Business Case | Problem framing | README §Overview |
| **D2 SCRUM-1** Submit request | Student request form | `routes/requests.js POST /`, `app.js renderStudentSubmit()` |
| **D2 SCRUM-2** Secure doc upload | File upload with scan | `multer` + BR-06/07/08 enforcement |
| **D2 SCRUM-4** Notifications | Bell + email | `routes/notifications.js`, polling every 30s |
| **D2 SCRUM-5** Instructor decisions | 6 decision types | `openReviewModal()` + conditions builder |
| **D2 SCRUM-8** Centralized platform | Unified inbox | `renderInstructorInbox()` with filters |
| **D3 SCRUM-19** Tamper-proof log | Hash chain | `utils/audit.js` with `verifyChain()` |
| **D3 SCRUM-7** Historical DB | Read-only archive | `GET /api/admin/historical` |
| **D3 SCRUM-10** Anonymized reports | PII stripped | Analytics queries exclude identity fields |
| **D3 SCRUM-9** Trend analytics | Department/week breakdown | `getAnalytics()` returns aggregates |
| **D4 ERD** | 13-table schema | `db/schema.sql` matches Data Dictionary exactly |
| **D4 §7.3** Test data | 12 users, 8 requests | `utils/seed.js` mirrors §7.3 |
| **D4 §8** Security | All controls | JWT + RBAC + audit + helmet + rate limit |
| **D5 SCRUM-36** Retake portal | Student booking | `renderStudentRetake()` + DSS auto-multiplier |
| **D5 SCRUM-37** Retake config | Instructor rules | `renderRetakeConfig()` |
| **D5 SCRUM-38** TA logistics | Queue + messages | `routes/ta.js` with RBAC |
| **D5 SCRUM-39** DSS automation | 1.5x multiplier | `POST /api/retakes/book` applies multiplier |
| **D5 SCRUM-40** Recording access | 7-day expiry | UI-placeholder; policy shown |
| **D5 SCRUM-11** CI/CD | GitHub Actions | `.github/workflows/ci.yml` |

---

## 🧩 Tech Stack

**Backend:** Node.js 18+, Express 4.19, better-sqlite3 11.3, JWT 9, bcryptjs 2.4, multer 1.4, helmet 7, cors 2.8, express-rate-limit 7.4

**Frontend:** Vanilla JavaScript (no framework), Chart.js 4.4, no build step

**Database:** SQLite (production-ready via WAL mode; trivially swappable for PostgreSQL)

**CI:** GitHub Actions with matrix testing on Node 18 + 20

---

## 📝 License

MIT — Educational capstone project.
Free for other students to learn from, fork, and adapt with attribution.

---

## 👥 Team

**Team members:** Andres, Karime, Kaushik, Romain, Jade, Ayla
**Course:** ISTM 4210 · Information Systems Capstone
**Institution:** George Washington University
**Semester:** Spring 2026
**Instructor:** Prof. Subhasish Dasgupta
