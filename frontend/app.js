// ═══════════════════════════════════════════════════════════════════
// ExcuseFlow Frontend Application v2
// Refined enterprise SaaS with real-time updates, calendar, video library,
// command palette, draft/edit/withdraw/undo, keyboard shortcuts.
// ═══════════════════════════════════════════════════════════════════

// ─── Application state ──────────────────────────────────────────────
const state = {
  user: null,
  role: null,
  page: null,                 // current page id
  charts: {},                 // active Chart.js instances
  notifications: [],
  unreadCount: 0,
  notifOpen: false,
  selectedDecision: null,
  pendingConditions: [],
  calendar: { mode: 'month', cursor: new Date() },
  pendingUndo: null,          // active undo timer for last submission
};

// ─── Navigation map (sidebar items per role) ────────────────────────
const NAV = {
  student: [
    { id: 's-dash',  label: 'Dashboard',     icon: 'home' },
    { id: 's-cal',   label: 'Calendar',      icon: 'calendar' },
    { id: 's-reqs',  label: 'My Requests',   icon: 'inbox' },
    { id: 's-new',   label: 'New Request',   icon: 'plus' },
    { id: 's-courses', label: 'My Courses',  icon: 'book' },
    { id: 's-videos', label: 'Lecture Videos', icon: 'video' },
    { id: 's-retake', label: 'My Retakes', icon: 'clock' },
    { id: 's-msgs',   label: 'Messages',     icon: 'chat' },
  ],
  instructor: [
    { id: 'i-dash',    label: 'Dashboard',      icon: 'home' },
    { id: 'i-inbox',   label: 'Request Inbox',  icon: 'inbox' },
    { id: 'i-courses', label: 'My Courses',     icon: 'book' },
    { id: 'i-cal',     label: 'Calendar',       icon: 'calendar' },
    { id: 'i-ana',     label: 'Analytics',      icon: 'chart' },
    { id: 'i-retcfg',  label: 'Retake Config',  icon: 'settings' },
    { id: 'i-videos',  label: 'Lecture Videos', icon: 'video' },
    { id: 'i-msgs',    label: 'Messages',       icon: 'chat' },
  ],
  ta: [
    { id: 't-queue', label: 'Logistics Queue', icon: 'inbox' },
    { id: 't-sched', label: 'Scheduling',     icon: 'calendar' },
    { id: 't-proc',  label: 'Proctoring',     icon: 'check' },
    { id: 't-msgs',  label: 'Messages',       icon: 'chat' },
  ],
  admin: [
    { id: 'a-dash',  label: 'Dashboard',  icon: 'home' },
    { id: 'a-ana',   label: 'Analytics',  icon: 'chart' },
    { id: 'a-audit', label: 'Audit Log',  icon: 'shield' },
    { id: 'a-hist',  label: 'Historical',  icon: 'archive' },
    { id: 'a-msgs',  label: 'Messages',   icon: 'chat' },
  ],
};

// ─── SVG icon set ───────────────────────────────────────────────────
const ICONS = {
  home:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  inbox:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  plus:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  book:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  video:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
  clock:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  chart:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  check:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  chat:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  shield:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  archive:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
  play:     '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  edit:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  bell:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  alert:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  close:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
};

const icon = (name, w = 16) => `<span class="i" style="display:inline-grid;place-items:center;width:${w}px;height:${w}px">${(ICONS[name]||'').replace('<svg', `<svg width="${w}" height="${w}"`)}</span>`;

// ─── Status / priority helpers ─────────────────────────────────────
const STATUS_BADGE = {
  'Pending': 'pending',
  'Reviewing': 'reviewing',
  'Approved': 'approved',
  'Final Approved': 'approved',
  'Approved with Conditions': 'conditional',
  'Partial Approval': 'partial',
  'Denied': 'denied',
  'More Info Requested': 'info',
  'Escalated': 'escalated',
  'Draft': 'draft',
  'Scheduled': 'scheduled',
  'Closed': 'approved',
  'Awaiting Student Proposal': 'info',
  'Awaiting TA Confirmation': 'reviewing',
  'Awaiting Reschedule': 'info',
  'Awaiting Student Approval': 'conditional',
};
const statusBadge = (s) => `<span class="badge badge-${STATUS_BADGE[s] || 'pending'}">${s}</span>`;
const priBadge = (p) => p && p !== 'Normal' ? `<span class="pri pri-${p.toLowerCase()}">${p}</span>` : '';

// ─── Date / format utilities ───────────────────────────────────────
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateTime(s) {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z'));
  if (isNaN(d)) return s;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function timeAgo(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z'));
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
  if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
  if (sec < 604800) return Math.floor(sec / 86400) + 'd ago';
  return fmtDate(s);
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Toast system ──────────────────────────────────────────────────
function toast(message, type = 'info', actionLabel = null, actionFn = null, duration = 4500) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const iconMap = { success: '✓', error: '!', info: 'i' };
  el.innerHTML = `
    <div class="toast-icon">${iconMap[type] || iconMap.info}</div>
    <div class="toast-msg">${escapeHtml(message)}</div>
    ${actionLabel ? `<button class="toast-action">${escapeHtml(actionLabel)}</button>` : ''}
  `;
  container.appendChild(el);
  if (actionLabel && actionFn) {
    el.querySelector('.toast-action').onclick = () => { actionFn(); removeToast(el); };
  }
  const timer = setTimeout(() => removeToast(el), duration);
  el.dataset.timer = timer;
  return el;
}
function removeToast(el) {
  if (!el || !el.parentNode) return;
  clearTimeout(el.dataset.timer);
  el.classList.add('removing');
  setTimeout(() => el.remove(), 200);
}

// ─── Modal ─────────────────────────────────────────────────────────
function openModal(html, size = '') {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modal');
  modal.className = 'modal' + (size ? ' modal-' + size : '');
  modal.innerHTML = html;
  overlay.classList.remove('hidden');
}
function closeModal(e) {
  if (e && e.target && e.target.id !== 'modalOverlay') return;
  document.getElementById('modalOverlay').classList.add('hidden');
}
window.closeModal = closeModal;

function confirmDialog(title, message, confirmLabel = 'Confirm', danger = false) {
  return new Promise((resolve) => {
    openModal(`
      <div class="modal-header">
        <div class="modal-title">${escapeHtml(title)}</div>
        <button class="icon-btn" onclick="closeModal({target:{id:'modalOverlay'}});window._confirmRes(false)">${ICONS.close.replace('<svg','<svg width="16" height="16"')}</button>
      </div>
      <div class="modal-body">
        <p style="font-size:14px;line-height:1.55;color:var(--ink-700)">${escapeHtml(message)}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal({target:{id:'modalOverlay'}});window._confirmRes(false)">Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" onclick="closeModal({target:{id:'modalOverlay'}});window._confirmRes(true)">${escapeHtml(confirmLabel)}</button>
      </div>
    `, 'sm');
    window._confirmRes = resolve;
  });
}

// ─── Auth ──────────────────────────────────────────────────────────
function quickSignIn(email) {
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = 'password123';
  document.getElementById('loginForm').requestSubmit();
}
window.quickSignIn = quickSignIn;

async function doLogin(event) {
  event && event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const pw = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    const data = await API.login(email, pw);
    EFAuth.setToken(data.token);
    EFAuth.setCurrentUser(data.user);
    state.user = data.user;
    state.role = data.user.role;
    afterLogin();
  } catch (err) {
    errEl.textContent = err.message || 'Sign-in failed';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}
window.doLogin = doLogin;

// ─── Toggle between sign-in and register views ──────────────────────
function goToAuthForm() {
  document.getElementById('authLanding')?.classList.add('hidden');
  document.getElementById('authFormScreen')?.classList.remove('hidden');
  document.getElementById('signInView')?.classList.remove('hidden');
  document.getElementById('registerView')?.classList.add('hidden');
}
window.goToAuthForm = goToAuthForm;

function goToAuthLanding() {
  document.getElementById('authFormScreen')?.classList.add('hidden');
  document.getElementById('authLanding')?.classList.remove('hidden');
}
window.goToAuthLanding = goToAuthLanding;

function toggleAuthView(event) {
  if (event) event.preventDefault();
  const signIn = document.getElementById('signInView');
  const register = document.getElementById('registerView');
  signIn.classList.toggle('hidden');
  register.classList.toggle('hidden');

  // Preserve the familiar 2-column layout. Just make sure the right panel starts at the top
  // and refresh everything from scratch whenever register opens.
  if (!register.classList.contains('hidden')) {
    resetRegisterForm();
    loadRegistrationData();
    document.querySelector('.auth-right')?.scrollTo(0, 0);
  }
}
window.toggleAuthView = toggleAuthView;

function resetRegisterForm() {
  // Clear any stale values + re-enable the submit button
  ['regName','regEmail','regPassword','regMajor'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Fresh registration course list
  window._regCourses = [];
  const btn = document.getElementById('registerBtn');
  if (btn) { btn.disabled = false; btn.textContent = 'Create account & sign in →'; }
  const err = document.getElementById('registerError');
  if (err) { err.textContent = ''; err.classList.add('hidden'); }
  const role = document.getElementById('regRole');
  if (role) role.value = 'student';
  onRoleChange();
  renderRegistrationCourseCards();
}
window.resetRegisterForm = resetRegisterForm;

async function loadRegistrationData() {
  try {
    const [{ courses }, { instructors }] = await Promise.all([
      API.publicCourses(),
      API.publicInstructors()
    ]);
    // Cache for client-side filtering
    window._allCourses = courses;
    window._allInstructors = instructors;
    renderRegistrationCourseCards();
    // Populate supervisor dropdown for TA signup
    const supSel = document.getElementById('regSupervisor');
    if (supSel) {
      supSel.innerHTML = instructors.length === 0
        ? `<option value="">No instructors yet — register one first</option>`
        : `<option value="">Select an instructor…</option>` +
          instructors.map(i => `<option value="${i.user_id}">${escapeHtml(i.name)} (${escapeHtml(i.email)}${i.department ? ' · ' + escapeHtml(i.department) : ''})</option>`).join('');
    }
  } catch (err) {
    console.error('Failed to load registration data:', err);
  }
}
window.loadRegistrationData = loadRegistrationData;

// ─── Registration course picker — card-based, dialog-driven ─────────
// State:
//   window._regCourses = array of { courseId, courseName, section, instructorId, instructorName, isNew }
//   isNew=true means this course doesn't exist yet and needs to be created on submit

function renderRegistrationCourseCards() {
  const role = document.getElementById('regRole')?.value;
  const containerId = role === 'instructor' ? 'regInstructorCourseCards' : 'regStudentCourseCards';
  const container = document.getElementById(containerId);
  if (!container) return;

  const list = window._regCourses || [];
  if (list.length === 0) {
    container.innerHTML = `
      <div style="padding:14px;text-align:center;background:var(--paper-50);border:1px dashed var(--paper-300);border-radius:var(--radius-sm);font-size:12.5px;color:var(--ink-500)">
        No courses added yet. Click the button below to add one.
      </div>`;
    return;
  }
  container.innerHTML = list.map((c, idx) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:white;border:1px solid var(--gold-300);border-radius:var(--radius-sm)">
      <div style="width:32px;height:32px;background:var(--gold-100);color:var(--gold-700);border-radius:6px;display:grid;place-items:center;font-weight:700;font-size:11px;flex-shrink:0">${escapeHtml(c.section)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escapeHtml(c.courseId)} — ${escapeHtml(c.courseName)}
          ${c.isNew ? '<span style="display:inline-block;margin-left:6px;padding:1px 6px;background:var(--gold-500);color:white;border-radius:8px;font-size:9.5px;font-weight:700;vertical-align:middle;letter-spacing:0.03em">NEW</span>' : ''}
        </div>
        <div style="font-size:11px;color:var(--ink-500);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          Section ${escapeHtml(c.section)} · ${escapeHtml(c.instructorName || 'Instructor TBA')}
        </div>
        ${c.meetingDays || c.meetingTime ? `
          <div style="font-size:10.5px;color:var(--gold-700);font-weight:600;margin-top:1px">
            ${icon('clock', 9)} ${escapeHtml(c.meetingDays || 'MWF')} ${escapeHtml(c.meetingTime || '10:00')}
          </div>
        ` : ''}
      </div>
      <button type="button" onclick="removeRegCourse(${idx})" class="icon-btn" style="width:28px;height:28px;color:var(--ink-500)" title="Remove">
        ${ICONS.close ? ICONS.close.replace('<svg','<svg width="14" height="14"') : '×'}
      </button>
    </div>
  `).join('');
}
window.renderRegistrationCourseCards = renderRegistrationCourseCards;

function removeRegCourse(idx) {
  window._regCourses.splice(idx, 1);
  renderRegistrationCourseCards();
}
window.removeRegCourse = removeRegCourse;

// ─── Open the course picker dialog ───────────────────────────────────
function openCoursePicker(role) {
  const all = window._allCourses || [];
  const instructors = window._allInstructors || [];
  window._picker_role = role;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${icon('book')} Add a course</div>
      <button class="icon-btn" onclick="closeModal({target:{id:'modalOverlay'}})">${ICONS.close.replace('<svg','<svg width="16" height="16"')}</button>
    </div>
    <div class="modal-body" style="max-height:65vh;overflow-y:auto">

      ${role === 'student' ? `
        <!-- Tabs (students only — instructors always create new) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px;background:var(--paper-100);padding:4px;border-radius:var(--radius-sm)">
          <button type="button" id="pickTabBrowse" onclick="switchPickerTab('browse')" class="btn btn-sm" style="background:white;box-shadow:var(--shadow-sm);font-weight:600">Browse existing</button>
          <button type="button" id="pickTabCreate" onclick="switchPickerTab('create')" class="btn btn-sm btn-ghost" style="font-weight:600">Create new</button>
        </div>
      ` : `
        <div style="padding:10px 14px;margin-bottom:14px;background:var(--gold-50);border:1px solid var(--gold-200);border-radius:var(--radius-sm);font-size:12.5px;color:var(--ink-700);line-height:1.5">
          Enter the course code, section, and name. You'll automatically be set as the instructor — your students will see your name on this course.
        </div>
      `}

      <!-- BROWSE TAB (students only) -->
      <div id="pickBrowseTab" ${role === 'instructor' ? 'class="hidden"' : ''}>
        <input type="text" id="pickSearch" placeholder="Search by course code, name, or instructor…" oninput="renderPickerResults()" autocomplete="off" style="margin-bottom:10px">
        <div id="pickResults" style="border:1px solid var(--paper-300);border-radius:var(--radius-sm);background:white;max-height:340px;overflow-y:auto">
          ${all.length === 0
            ? `<div style="padding:30px;text-align:center;color:var(--ink-500);font-size:12.5px">No courses in the catalog yet. Use the Create tab to add the first one.</div>`
            : ''}
        </div>
      </div>

      <!-- CREATE TAB -->
      <div id="pickCreateTab" ${role === 'student' ? 'class="hidden"' : ''}>
        ${role === 'student' ? '<p style="font-size:12.5px;color:var(--ink-700);margin-bottom:12px;line-height:1.45">Fill in the course details. It will be created in the database when you finish signing up.</p>' : ''}
        <div class="form-grid">
          <div class="field">
            <label>Course code *</label>
            <input type="text" id="pickNewCode" placeholder="HIST-210" autocomplete="off" style="text-transform:uppercase">
          </div>
          <div class="field">
            <label>Section *</label>
            <input type="text" id="pickNewSection" placeholder="001" autocomplete="off" value="001">
          </div>
        </div>
        <div class="field">
          <label>Course name *</label>
          <input type="text" id="pickNewName" placeholder="Modern World History" autocomplete="off">
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Meeting days</label>
            <input type="text" id="pickNewDays" value="MWF" placeholder="MWF" autocomplete="off">
          </div>
          <div class="field">
            <label>Meeting time</label>
            <input type="time" id="pickNewTime" value="10:00">
          </div>
        </div>
        ${role === 'student' ? `
          <div class="field">
            <label>Instructor *</label>
            <select id="pickNewInstructor">
              ${instructors.length === 0
                ? '<option value="">No instructors registered yet</option>'
                : '<option value="">Select the instructor…</option>' +
                  instructors.map(i => `<option value="${i.user_id}" data-name="${escapeHtml(i.name)}">${escapeHtml(i.name)}${i.department ? ' · ' + escapeHtml(i.department) : ''}</option>`).join('')
              }
            </select>
          </div>
        ` : ''}
        <div id="pickCreateError" class="alert alert-error hidden" style="margin-bottom:10px"></div>
        <button type="button" onclick="confirmPickerCreate()" class="btn btn-gold btn-full" style="padding:12px;font-weight:700">${role === 'instructor' ? 'Add this course to my roster' : 'Add this course'}</button>
      </div>

    </div>
  `, 'md');
  renderPickerResults();
}
window.openCoursePicker = openCoursePicker;

function switchPickerTab(tab) {
  const browseTab = document.getElementById('pickBrowseTab');
  const createTab = document.getElementById('pickCreateTab');
  const browseBtn = document.getElementById('pickTabBrowse');
  const createBtn = document.getElementById('pickTabCreate');
  if (tab === 'browse') {
    browseTab.classList.remove('hidden');
    createTab.classList.add('hidden');
    browseBtn.style.background = 'white';
    browseBtn.style.boxShadow = 'var(--shadow-sm)';
    browseBtn.classList.remove('btn-ghost');
    createBtn.style.background = '';
    createBtn.style.boxShadow = '';
    createBtn.classList.add('btn-ghost');
  } else {
    browseTab.classList.add('hidden');
    createTab.classList.remove('hidden');
    createBtn.style.background = 'white';
    createBtn.style.boxShadow = 'var(--shadow-sm)';
    createBtn.classList.remove('btn-ghost');
    browseBtn.style.background = '';
    browseBtn.style.boxShadow = '';
    browseBtn.classList.add('btn-ghost');
  }
}
window.switchPickerTab = switchPickerTab;

function renderPickerResults() {
  const resultsEl = document.getElementById('pickResults');
  if (!resultsEl) return;
  const all = window._allCourses || [];
  const searchEl = document.getElementById('pickSearch');
  const q = (searchEl?.value || '').toLowerCase().trim();
  const already = new Set((window._regCourses || []).map(c => c.courseId));

  const filtered = !q ? all : all.filter(c =>
    String(c.course_id || '').toLowerCase().includes(q) ||
    String(c.course_name || '').toLowerCase().includes(q) ||
    String(c.instructor_name || '').toLowerCase().includes(q) ||
    String(c.section || '').toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    resultsEl.innerHTML = `<div style="padding:30px;text-align:center;color:var(--ink-500);font-size:12.5px">No matching courses. Try the "Create new" tab to add one.</div>`;
    return;
  }
  resultsEl.innerHTML = filtered.map(c => {
    const isAdded = already.has(c.course_id);
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--paper-200)">
        <div style="width:32px;height:32px;background:var(--paper-100);color:var(--ink-700);border-radius:6px;display:grid;place-items:center;font-weight:700;font-size:11px;flex-shrink:0">${escapeHtml(c.section || '001')}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600">${escapeHtml(c.course_id)} — ${escapeHtml(c.course_name)}</div>
          <div style="font-size:11.5px;color:var(--ink-500)">Section ${escapeHtml(c.section || '001')} · ${escapeHtml(c.instructor_name || 'TBA')}</div>
          <div style="font-size:11px;color:var(--gold-700);font-weight:600;margin-top:2px">${icon('clock', 10)} ${escapeHtml(c.meeting_days || 'MWF')} ${escapeHtml(c.meeting_time || '10:00')}</div>
        </div>
        ${isAdded
          ? '<span class="badge badge-approved" style="font-size:10px">Added</span>'
          : `<button type="button" onclick="addPickerCourse('${escapeHtml(c.course_id)}','${escapeHtml(c.course_name).replace(/'/g,"\\'")}','${escapeHtml(c.section || '001')}','${escapeHtml(c.instructor_id || '')}','${escapeHtml(c.instructor_name || '').replace(/'/g,"\\'")}','${escapeHtml(c.meeting_days || 'MWF')}','${escapeHtml(c.meeting_time || '10:00')}')" class="btn btn-sm btn-gold">+ Add</button>`
        }
      </div>
    `;
  }).join('');
}
window.renderPickerResults = renderPickerResults;

function addPickerCourse(courseId, courseName, section, instructorId, instructorName, meetingDays, meetingTime) {
  if (!window._regCourses) window._regCourses = [];
  const already = window._regCourses.find(c => c.courseId === courseId);
  if (already) { toast('Already added', 'info'); return; }
  window._regCourses.push({
    courseId, courseName, section, instructorId, instructorName,
    meetingDays: meetingDays || 'MWF',
    meetingTime: meetingTime || '10:00',
    isNew: false
  });
  renderPickerResults();
  renderRegistrationCourseCards();
  toast(`Added ${courseId}`, 'success');
}
window.addPickerCourse = addPickerCourse;

function confirmPickerCreate() {
  const code = (document.getElementById('pickNewCode')?.value || '').trim().toUpperCase();
  const name = (document.getElementById('pickNewName')?.value || '').trim();
  const section = (document.getElementById('pickNewSection')?.value || '').trim() || '001';
  const role = window._picker_role;
  const errEl = document.getElementById('pickCreateError');
  errEl.classList.add('hidden');

  if (!code || !name) {
    errEl.textContent = 'Please fill in course code and name.';
    errEl.classList.remove('hidden');
    return;
  }
  // Real college convention: full course key includes section — allows "CSCI-6364 section 001"
  // and "CSCI-6364 section 002" to coexist as different rows
  const compositeId = `${code}-${section}`;

  let instructorId, instructorName;
  if (role === 'instructor') {
    instructorId = '__self__';  // placeholder, server resolves to the new user's ID
    instructorName = (document.getElementById('regName')?.value.trim() || 'You');
  } else {
    const sel = document.getElementById('pickNewInstructor');
    instructorId = sel?.value;
    const opt = sel?.options[sel.selectedIndex];
    instructorName = opt?.getAttribute('data-name') || '';
    if (!instructorId) {
      errEl.textContent = 'Please select the instructor for this course.';
      errEl.classList.remove('hidden');
      return;
    }
  }

  const already = (window._regCourses || []).find(c => c.courseId === compositeId);
  if (already) {
    errEl.textContent = `${compositeId} is already added.`;
    errEl.classList.remove('hidden');
    return;
  }
  const existsInCatalog = (window._allCourses || []).find(c => c.course_id === compositeId);
  if (existsInCatalog) {
    errEl.textContent = `${compositeId} already exists in the catalog. Use the Browse tab to add it.`;
    errEl.classList.remove('hidden');
    return;
  }

  if (!window._regCourses) window._regCourses = [];
  const meetingDays = (document.getElementById('pickNewDays')?.value || 'MWF').trim().toUpperCase();
  const meetingTime = document.getElementById('pickNewTime')?.value || '10:00';
  window._regCourses.push({
    courseId: compositeId,
    courseName: name,
    section,
    instructorId,
    instructorName,
    meetingDays,
    meetingTime,
    isNew: true
  });
  closeModal({ target: { id: 'modalOverlay' } });
  renderRegistrationCourseCards();
  toast(`Will create ${compositeId} on signup`, 'success');
}
window.confirmPickerCreate = confirmPickerCreate;

function onRoleChange() {
  const role = document.getElementById('regRole').value;
  const showHide = (id, show) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('hidden', !show);
  };
  showHide('regStudentFields',    role === 'student');
  showHide('regInstructorFields', role === 'instructor');
  showHide('regTAFields',         role === 'ta');
  showHide('regAdminFields',      role === 'admin');
  // Re-render the course cards into the currently-visible container
  renderRegistrationCourseCards();
}
window.onRoleChange = onRoleChange;

async function doRegister(event) {
  event && event.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value;
  const btn = document.getElementById('registerBtn');
  const errEl = document.getElementById('registerError');
  errEl.classList.add('hidden');

  if (password.length < 8) {
    errEl.textContent = 'Password must be at least 8 characters.';
    errEl.classList.remove('hidden');
    return;
  }

  const payload = { name, email, password, role };
  const allRegCourses = window._regCourses || [];

  if (role === 'student') {
    payload.classYear = document.getElementById('regClassYear').value;
    payload.major = document.getElementById('regMajor').value.trim();
    if (allRegCourses.length === 0) {
      errEl.textContent = 'Please add at least one course.';
      errEl.classList.remove('hidden');
      return;
    }
    // Existing courses vs brand-new ones
    payload.courseIds = allRegCourses.filter(c => !c.isNew).map(c => c.courseId);
    payload.customCourses = allRegCourses.filter(c => c.isNew).map(c => ({
      courseId: c.courseId,
      courseName: c.courseName,
      section: c.section,
      instructorId: c.instructorId,
      meetingDays: c.meetingDays || 'MWF',
      meetingTime: c.meetingTime || '10:00',
      term: 'Spring 2026'
    }));
  } else if (role === 'instructor') {
    payload.department = document.getElementById('regInstructorDept').value;
    payload.instructorCourses = allRegCourses.map(c => ({
      courseId: c.courseId,
      courseName: c.courseName,
      section: c.section,
      meetingDays: c.meetingDays || 'MWF',
      meetingTime: c.meetingTime || '10:00',
      term: 'Spring 2026'
    }));
  } else if (role === 'ta') {
    const sup = document.getElementById('regSupervisor').value;
    if (!sup) {
      errEl.textContent = 'Please select a supervising instructor.';
      errEl.classList.remove('hidden');
      return;
    }
    payload.supervisorId = sup;
  } else if (role === 'admin') {
    payload.departmentScope = document.getElementById('regAdminDept').value;
  }

  btn.disabled = true;
  btn.textContent = 'Creating account…';

  try {
    const data = await API.register(payload);
    EFAuth.setToken(data.token);
    EFAuth.setCurrentUser(data.user);
    state.user = data.user;
    state.role = data.user.role;
    toast(`Welcome, ${data.user.name}! Account created.`, 'success');
    afterLogin();
  } catch (err) {
    errEl.textContent = err.message || 'Could not create account';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Create account & sign in →';
  }
}
window.doRegister = doRegister;

function afterLogin() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  // Populate user menu
  const initial = (state.user.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  document.getElementById('userAvatar').textContent = initial;
  document.getElementById('userName').textContent = state.user.name;
  document.getElementById('userRole').textContent = state.role;
  document.getElementById('userNameFull').textContent = state.user.name;
  document.getElementById('userEmailFull').textContent = state.user.email;

  buildSidebar();
  // Register all real-time listeners FIRST so we don't miss the initial 'connected' event
  EventBus.on('connected', () => updateLiveIndicator(true));
  EventBus.on('disconnected', () => updateLiveIndicator(false));
  wireRealtimeHandlers();
  // Now open the SSE stream
  EventBus.connect();
  loadNotifications();
  // Polling fallback every 15s (SSE pushes are instant, but poll catches anything missed while the tab was backgrounded)
  state.notifPollId = setInterval(loadNotifications, 15000);
  // Default page
  navigate(NAV[state.role][0].id);
  toast('Welcome, ' + state.user.name.split(' ')[0], 'success');
}

function updateLiveIndicator(connected) {
  document.getElementById('liveIndicator').classList.toggle('connected', !!connected);
}

async function logout() {
  try { await API.logout(); } catch {}
  EventBus.disconnect();
  EventBus.listeners = {};  // clear all listeners so they don't stack up across sessions
  if (state.notifPollId) { clearInterval(state.notifPollId); state.notifPollId = null; }
  EFAuth.clearToken();
  state.user = null; state.role = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  // After logout, return to the landing screen (not directly into auth form)
  document.getElementById('authLanding')?.classList.remove('hidden');
  document.getElementById('authFormScreen')?.classList.add('hidden');
  document.getElementById('signInView')?.classList.remove('hidden');
  document.getElementById('registerView')?.classList.add('hidden');
  destroyCharts();
  document.getElementById('loginBtn').disabled = false;
  document.getElementById('loginBtn').textContent = 'Sign In';
}
window.logout = logout;
window.onAuthFailed = () => {
  EventBus.disconnect();
  EventBus.listeners = {};
  if (state.notifPollId) { clearInterval(state.notifPollId); state.notifPollId = null; }
  EFAuth.clearToken();
  state.user = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('authLanding')?.classList.add('hidden');
  document.getElementById('authFormScreen')?.classList.remove('hidden');
  document.getElementById('signInView')?.classList.remove('hidden');
  document.getElementById('registerView')?.classList.add('hidden');
  toast('Session expired. Please sign in again.', 'error');
};

// ─── Restore session on page load ───────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // First-time visitors see the landing screen; auth form is one click away
  document.getElementById('authLanding')?.classList.remove('hidden');
  document.getElementById('authFormScreen')?.classList.add('hidden');
  document.getElementById('signInView')?.classList.remove('hidden');
  document.getElementById('registerView')?.classList.add('hidden');

  const token = EFAuth.getToken();
  const saved = EFAuth.getCurrentUser();
  if (token && saved) {
    try {
      const me = await API.me();
      const u = me.user || me;
      state.user = { userId: u.user_id || u.userId, name: u.name, email: u.email, role: u.role };
      state.role = state.user.role;
      afterLogin();
    } catch (e) {
      EFAuth.clearToken();
    }
  }
  setupKeyboardShortcuts();
});

// ─── Sidebar & navigation ──────────────────────────────────────────
function buildSidebar() {
  const html = NAV[state.role].map(item => `
    <div class="sidebar-link" data-id="${item.id}" onclick="navigate('${item.id}')">
      ${ICONS[item.icon] ? ICONS[item.icon].replace('<svg', '<svg width="16" height="16"') : ''}
      <span>${item.label}</span>
    </div>
  `).join('');
  document.getElementById('sidebarNav').innerHTML = html;
}

function navigate(pageId) {
  state.page = pageId;
  destroyCharts();
  // Highlight sidebar
  document.querySelectorAll('.sidebar-link').forEach(el =>
    el.classList.toggle('active', el.dataset.id === pageId)
  );
  // Set page title
  const navItem = NAV[state.role].find(n => n.id === pageId);
  if (navItem) {
    document.getElementById('pageTitle').textContent = navItem.label;
    document.getElementById('pageCrumb').textContent = state.role.charAt(0).toUpperCase() + state.role.slice(1);
  }
  // Render
  const main = document.getElementById('main');
  main.style.opacity = '0';
  setTimeout(() => {
    main.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    main.style.opacity = '1';
    const fn = ROUTES[pageId];
    if (fn) {
      Promise.resolve(fn()).catch(err => {
        main.innerHTML = `<div class="alert alert-error">Could not load page: ${escapeHtml(err.message)}</div>`;
      });
    }
  }, 80);
}
window.navigate = navigate;

function destroyCharts() {
  Object.values(state.charts).forEach(c => { try { c.destroy(); } catch {} });
  state.charts = {};
}

// ─── Notifications ─────────────────────────────────────────────────
async function loadNotifications() {
  try {
    const data = await API.listNotifications();
    state.notifications = data.notifications || [];
    state.unreadCount = data.unread || 0;
    renderNotifBadge();
    if (state.notifOpen) renderNotifPanel();
  } catch {}
}
function renderNotifBadge() {
  const b = document.getElementById('notifBadge');
  if (state.unreadCount > 0) {
    b.textContent = state.unreadCount;
    b.classList.remove('hidden');
  } else b.classList.add('hidden');
}
function toggleNotif() {
  state.notifOpen = !state.notifOpen;
  document.getElementById('notifPanel').classList.toggle('hidden', !state.notifOpen);
  if (state.notifOpen) renderNotifPanel();
}
window.toggleNotif = toggleNotif;
function renderNotifPanel() {
  const list = document.getElementById('notifList');
  if (!state.notifications.length) {
    list.innerHTML = `<div style="padding:32px 16px;text-align:center;color:var(--ink-500);font-size:13px">No notifications yet.</div>`;
    return;
  }
  list.innerHTML = state.notifications.map(n => `
    <div class="notif-item ${n.read_status ? '' : 'unread'}" onclick="markNotif('${n.notification_id}')">
      <div class="notif-item-body">${escapeHtml(n.message_body)}</div>
      <div class="notif-item-time">${timeAgo(n.sent_timestamp_utc)}</div>
    </div>
  `).join('');
}
async function markNotif(id) {
  try { await API.markNotificationRead(id); await loadNotifications(); } catch {}
}
window.markNotif = markNotif;
async function markAllRead() {
  try { await API.markAllRead(); await loadNotifications(); toast('All notifications marked read', 'success'); } catch {}
}
window.markAllRead = markAllRead;

// User dropdown
function toggleUserMenu() {
  document.getElementById('userDropdown').classList.toggle('hidden');
}
window.toggleUserMenu = toggleUserMenu;
document.addEventListener('click', (e) => {
  if (!e.target.closest('.user-menu') && !e.target.closest('.user-dropdown')) {
    document.getElementById('userDropdown')?.classList.add('hidden');
  }
});

// ─── Real-time event handlers ──────────────────────────────────────
function wireRealtimeHandlers() {
  EventBus.on('request_submitted', (data) => {
    // Instructor sees a new request appear
    if (state.role === 'instructor') {
      toast(`New request: ${data.courseName || data.courseId}`, 'info');
      if (state.page === 'i-inbox' || state.page === 'i-dash') navigate(state.page);
      loadNotifications();
    }
  });
  EventBus.on('request_decided', (data) => {
    // Student sees decision
    if (state.role === 'student') {
      toast(`Request ${data.requestId}: ${data.decision}`, data.decision === 'Denied' ? 'error' : 'success');
      if (['s-dash','s-reqs','s-cal'].includes(state.page)) navigate(state.page);
      loadNotifications();
    }
    // TA gets logistics update when approval happens
    else if (state.role === 'ta' && data.forTA) {
      toast(`New approved request: ${data.requestId}`, 'info');
      if (['t-queue','t-sched','t-proc'].includes(state.page)) navigate(state.page);
      loadNotifications();
    }
    // Admin gets escalation alert with action
    else if (state.role === 'admin' && data.forAdmin) {
      toast(
        `Request ${data.requestId} escalated by ${data.escalatedBy || 'instructor'}`,
        'error',
        'Review',
        () => navigate('a-dash'),
        8000
      );
      if (['a-dash','a-ana','a-audit','a-hist'].includes(state.page)) navigate(state.page);
      loadNotifications();
    }
  });
  EventBus.on('request_updated', () => {
    if (['s-dash','i-dash','i-ana','a-dash','a-ana'].includes(state.page)) {
      // Refresh dashboard / charts silently
      navigate(state.page);
    }
  });
  EventBus.on('comment_posted', (data) => {
    // If we're viewing this request, refresh
    if (state.viewingRequestId === data.requestId) {
      // Lightweight: just notify
      toast('New message in discussion', 'info');
    }
  });
  // Instructor sees TA escalation alerts
  EventBus.on('ta_escalation', (data) => {
    if (state.role === 'instructor' || state.role === 'admin') {
      toast(`ESCALATION from ${data.from}: ${(data.body || '').slice(0, 80)}`, 'error', null, null, 8000);
      loadNotifications();
    }
  });
  // Direct message received — any role
  EventBus.on('message_received', (data) => {
    const preview = (data.preview || '').slice(0, 70);
    const label = data.subject ? `${data.subject} — ${preview}` : preview;
    toast(
      `Message from ${data.from}: ${label}`,
      'info',
      'Open',
      () => navigate(roleMsgsRoute()),
      8000
    );
    loadNotifications();
    // If viewing messages page, refresh it
    if (state.page && state.page.endsWith('-msgs')) navigate(state.page);
  });
  // Admin returned an escalated request back to instructor
  EventBus.on('request_returned', (data) => {
    if (state.role === 'instructor') {
      toast(
        `${data.adminName} returned ${data.requestId}: ${data.recommendation}`,
        'info',
        'Review',
        () => { reviewRequest(data.requestId); },
        8000
      );
      loadNotifications();
      if (['i-dash','i-inbox'].includes(state.page)) navigate(state.page);
    }
  });
}

function roleMsgsRoute() {
  return { student: 's-msgs', instructor: 'i-msgs', ta: 't-msgs', admin: 'a-msgs' }[state.role];
}

// ─── Keyboard shortcuts ────────────────────────────────────────────
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + K → command palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
    // Cmd/Ctrl + N → new request (student)
    else if ((e.metaKey || e.ctrlKey) && e.key === 'n' && state.role === 'student') {
      e.preventDefault();
      navigate('s-new');
    }
    // Esc → close modals/palette
    else if (e.key === 'Escape') {
      document.getElementById('modalOverlay').classList.add('hidden');
      document.getElementById('cmdkOverlay').classList.add('hidden');
      const np = document.getElementById('notifPanel');
      if (np && !np.classList.contains('hidden')) {
        state.notifOpen = false; np.classList.add('hidden');
      }
    }
  });
}

// ─── Command palette (Cmd+K) ───────────────────────────────────────
let cmdkItems = [];
let cmdkSelected = 0;
function openCommandPalette() {
  if (!state.user) return;
  document.getElementById('cmdkOverlay').classList.remove('hidden');
  document.getElementById('cmdkInput').value = '';
  cmdkSelected = 0;
  setTimeout(() => document.getElementById('cmdkInput').focus(), 50);
  renderCmdkResults();
}
window.openCommandPalette = openCommandPalette;
function closeCommandPalette(e) {
  if (e && e.target && e.target.id !== 'cmdkOverlay') return;
  document.getElementById('cmdkOverlay').classList.add('hidden');
}
window.closeCommandPalette = closeCommandPalette;
function renderCmdkResults() {
  const q = document.getElementById('cmdkInput').value.toLowerCase();
  const pages = NAV[state.role].map(n => ({ type: 'page', label: n.label, icon: n.icon, action: () => navigate(n.id) }));
  cmdkItems = pages.filter(i => i.label.toLowerCase().includes(q));
  cmdkSelected = 0;
  const html = cmdkItems.length
    ? `<div class="cmdk-section">Pages</div>` + cmdkItems.map((it, i) =>
        `<div class="cmdk-item ${i === 0 ? 'selected' : ''}" data-i="${i}" onclick="cmdkRun(${i})">
          ${ICONS[it.icon] ? ICONS[it.icon].replace('<svg', '<svg width="14" height="14"') : ''}
          ${escapeHtml(it.label)}
          <span class="cmdk-meta">↵</span>
        </div>`
      ).join('')
    : `<div style="padding:24px;text-align:center;color:var(--ink-500);font-size:13px">No matches</div>`;
  document.getElementById('cmdkResults').innerHTML = html;
}
window.renderCmdkResults = renderCmdkResults;
function cmdkRun(i) {
  if (cmdkItems[i]) {
    closeCommandPalette({ target: { id: 'cmdkOverlay' } });
    cmdkItems[i].action();
  }
}
window.cmdkRun = cmdkRun;
function cmdkKeyDown(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); cmdkSelected = Math.min(cmdkSelected + 1, cmdkItems.length - 1); updateCmdkSelected(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); cmdkSelected = Math.max(cmdkSelected - 1, 0); updateCmdkSelected(); }
  else if (e.key === 'Enter') { e.preventDefault(); cmdkRun(cmdkSelected); }
  else if (e.key === 'Escape') { closeCommandPalette({ target: { id: 'cmdkOverlay' } }); }
}
window.cmdkKeyDown = cmdkKeyDown;
function updateCmdkSelected() {
  document.querySelectorAll('.cmdk-item').forEach((el, i) =>
    el.classList.toggle('selected', i === cmdkSelected)
  );
}

// ═══════════════════════════════════════════════════════════════════
// ROUTE HANDLERS — defined after all helpers; assigned to ROUTES later
// ═══════════════════════════════════════════════════════════════════
const ROUTES = {};
window.ROUTES = ROUTES;

// ═══════════════════════════════════════════════════════════════════
// STUDENT — Dashboard
// ═══════════════════════════════════════════════════════════════════
ROUTES['s-dash'] = async function() {
  const [{ requests }, { courses }] = await Promise.all([API.listRequests(), API.myCourses()]);
  const counts = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'Pending').length,
    approved: requests.filter(r => ['Approved','Final Approved','Approved with Conditions','Partial Approval','Scheduled'].includes(r.status)).length,
    drafts: requests.filter(r => r.status === 'Draft').length,
  };
  const recent = requests.slice(0, 5);

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>Welcome back, ${escapeHtml(state.user.name.split(' ')[0])}</h2>
        <p>Here's an overview of your absence requests this semester.</p>
      </div>
      <div class="ph-actions">
        <button class="btn btn-ghost" onclick="navigate('s-cal')">View calendar</button>
        <button class="btn btn-gold" onclick="navigate('s-new')">${icon('plus',14)} New request</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat" style="--accent-color:var(--gold-500)">
        <div class="stat-label">Total requests</div>
        <div class="stat-value">${counts.total}</div>
        <div class="stat-meta">across ${courses.length} courses</div>
      </div>
      <div class="stat" style="--accent-color:var(--orange-500)">
        <div class="stat-label">Pending review</div>
        <div class="stat-value">${counts.pending}</div>
        <div class="stat-meta">awaiting instructor</div>
      </div>
      <div class="stat" style="--accent-color:var(--green-500)">
        <div class="stat-label">Approved</div>
        <div class="stat-value">${counts.approved}</div>
        <div class="stat-meta">make-ups available</div>
      </div>
      <div class="stat" style="--accent-color:var(--ink-500)">
        <div class="stat-label">Drafts</div>
        <div class="stat-value">${counts.drafts}</div>
        <div class="stat-meta">unsubmitted</div>
      </div>
    </div>

    <div class="chart-grid">
      <div class="card chart-card">
        <div class="card-header">
          <div class="card-title">Recent activity</div>
          <button class="link-btn" onclick="navigate('s-reqs')">View all</button>
        </div>
        ${recent.length === 0
          ? `<div style="padding:24px;text-align:center;color:var(--ink-500);font-size:13px">No requests yet. Click "New request" to get started.</div>`
          : `<div class="activity-feed">${recent.map(r => `
              <div class="activity-item" onclick="viewRequest('${r.id}')">
                <div class="activity-icon" style="background:${r.status==='Approved'||r.status==='Approved with Conditions'?'var(--green-50)':r.status==='Denied'?'var(--red-50)':'var(--paper-200)'};color:${r.status==='Approved'||r.status==='Approved with Conditions'?'var(--green-600)':r.status==='Denied'?'var(--red-600)':'var(--ink-700)'}">
                  ${icon(r.status==='Approved'||r.status==='Approved with Conditions'?'check':r.status==='Denied'?'close':'inbox',16)}
                </div>
                <div class="activity-content">
                  <div class="activity-title">${escapeHtml(r.courseName || r.course)} · ${fmtDate(r.date)}</div>
                  <div class="activity-meta">${statusBadge(r.status)} · submitted ${timeAgo(r.submitted)}</div>
                </div>
              </div>
            `).join('')}</div>`
        }
      </div>
      <div class="card chart-card">
        <div class="card-header"><div class="card-title">Status breakdown</div></div>
        <div class="chart-canvas-wrap"><canvas id="dashChart"></canvas></div>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-header">
        <div class="card-title">My courses</div>
        <button class="link-btn" onclick="navigate('s-courses')">Manage</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${courses.length === 0
          ? `<span style="color:var(--ink-500);font-size:13px">No courses yet — go to "My Courses" to add one.</span>`
          : courses.map(c => `
            <span class="course-chip">
              <span class="course-chip-dot" style="--course-color:${c.color || '#C5841F'}"></span>
              <strong>${escapeHtml(c.course_id)}</strong> · ${escapeHtml(c.course_name)}
            </span>
          `).join('')
        }
      </div>
    </div>
  `;

  // Status breakdown chart
  const counts2 = {};
  requests.forEach(r => { counts2[r.status] = (counts2[r.status] || 0) + 1; });
  const labels = Object.keys(counts2);
  const values = Object.values(counts2);
  if (labels.length) {
    const ctx = document.getElementById('dashChart');
    state.charts.dash = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['#E67E22','#27AE60','#E74C3C','#F39C12','#2980B9','#8E44AD','#95A5A6','#D35400'],
          borderWidth: 0,
        }]
      },
      options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 11.5 } } } }, cutout: '65%' }
    });
  } else {
    document.getElementById('dashChart').parentElement.innerHTML = `<div style="display:grid;place-items:center;height:100%;color:var(--ink-500);font-size:13px">No data yet</div>`;
  }
};

// ═══════════════════════════════════════════════════════════════════
// STUDENT — My Requests (with edit/withdraw/delete)
// ═══════════════════════════════════════════════════════════════════
ROUTES['s-reqs'] = async function() {
  const { requests } = await API.listRequests();
  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>My requests</h2>
        <p>${requests.length} request${requests.length !== 1 ? 's' : ''} total</p>
      </div>
      <div class="ph-actions">
        <button class="btn btn-gold" onclick="navigate('s-new')">${icon('plus',14)} New request</button>
      </div>
    </div>

    <div class="filter-bar">
      <select id="reqFilter" onchange="filterReqs()">
        <option value="">All statuses</option>
        <option>Draft</option><option>Pending</option><option>Approved</option>
        <option>Denied</option><option>More Info Requested</option>
      </select>
      <input type="text" id="reqSearch" placeholder="Search by course or reason…" oninput="filterReqs()">
    </div>

    ${requests.length === 0
      ? `<div class="empty">
          <div class="empty-icon">${icon('inbox',24)}</div>
          <h3>No requests yet</h3>
          <p>Submit your first absence request to get started.</p>
          <button class="btn btn-gold" onclick="navigate('s-new')">${icon('plus',14)} New request</button>
        </div>`
      : `<div class="table-wrap">
          <table class="tbl">
            <thead><tr>
              <th>Request</th><th>Course</th><th>Date</th>
              <th>Category</th><th>Status</th><th>Submitted</th><th></th>
            </tr></thead>
            <tbody id="reqBody">${renderReqRows(requests)}</tbody>
          </table>
        </div>`
    }
  `;
  window._reqs = requests;
};

function renderReqRows(requests) {
  if (!requests.length) return `<tr class="empty-row"><td colspan="7">No requests match your filters.</td></tr>`;
  return requests.map(r => `
    <tr class="clickable" onclick="viewRequest('${r.id}')">
      <td><strong>${r.id}</strong></td>
      <td>${escapeHtml(r.courseName || r.course)}</td>
      <td>${fmtDate(r.date)}</td>
      <td>${escapeHtml(r.category || '—')}</td>
      <td>${statusBadge(r.status)} ${priBadge(r.priority)}</td>
      <td>${r.submitted ? timeAgo(r.submitted) : '—'}</td>
      <td onclick="event.stopPropagation()">
        ${r.status === 'Draft'
          ? `<button class="btn btn-sm btn-ghost" onclick="editRequest('${r.id}')">Edit</button>
             <button class="btn btn-sm btn-danger" onclick="deleteRequest('${r.id}')">${icon('trash',12)}</button>`
          : `<button class="btn btn-sm btn-ghost" onclick="viewRequest('${r.id}')">View</button>`
        }
      </td>
    </tr>
  `).join('');
}

function filterReqs() {
  const status = document.getElementById('reqFilter').value;
  const q = document.getElementById('reqSearch').value.toLowerCase();
  const filtered = (window._reqs || []).filter(r => {
    if (status && r.status !== status) return false;
    if (q && !((r.courseName||'').toLowerCase().includes(q) || (r.reason||'').toLowerCase().includes(q) || r.id.toLowerCase().includes(q))) return false;
    return true;
  });
  document.getElementById('reqBody').innerHTML = renderReqRows(filtered);
}
window.filterReqs = filterReqs;

// View / details modal
async function viewRequest(id) {
  state.viewingRequestId = id;
  try {
    const data = await API.getRequest(id);
    const r = data.request;
    const comments = data.comments || [];
    const isOwner = state.role === 'student' && r.studentName;
    const canWithdraw = state.role === 'student' && r.status === 'Pending';
    const canEdit = state.role === 'student' && ['Draft','Pending'].includes(r.status);
    const canAddDoc = state.role === 'student' && ['Draft','Pending','Reviewing','More Info Requested','Awaiting Student Proposal','Awaiting Reschedule'].includes(r.status);
    const isAdminReview = state.role === 'admin' && r.status === 'Escalated';
    const canProposeTimes = state.role === 'student' && ['Awaiting Reschedule','Awaiting Student Proposal'].includes(r.status);
    const canConfirmSchedule = state.role === 'ta' && ['Awaiting Reschedule','Awaiting TA Confirmation'].includes(r.status);
    const canApproveSchedule = state.role === 'student' && r.status === 'Awaiting Student Approval';

    openModal(`
      <div class="modal-header">
        <div class="modal-title">${r.id} ${priBadge(r.priority)}</div>
        <button class="icon-btn" onclick="closeModal({target:{id:'modalOverlay'}})">${ICONS.close.replace('<svg','<svg width="16" height="16"')}</button>
      </div>
      <div class="modal-body">
        <div class="two-col">
          <div class="info-section">
            <h4>Request details</h4>
            <div class="info-row"><span class="label">Course</span><span class="val">${escapeHtml(r.course)} — ${escapeHtml(r.courseName || '')}</span></div>
            <div class="info-row"><span class="label">Absence date</span><span class="val">${fmtDate(r.date)}</span></div>
            <div class="info-row"><span class="label">Category</span><span class="val">${escapeHtml(r.category || '—')}</span></div>
            <div class="info-row"><span class="label">Status</span><span class="val">${statusBadge(r.status)}</span></div>
            <div class="info-row"><span class="label">Submitted</span><span class="val">${fmtDateTime(r.submitted)}</span></div>
            ${r.decisionAt ? `<div class="info-row"><span class="label">Decided</span><span class="val">${fmtDateTime(r.decisionAt)}</span></div>` : ''}
          </div>
          <div class="info-section">
            <h4>Reason &amp; documentation</h4>
            <div class="info-block">${escapeHtml(r.reason)}</div>
            ${r.instructorComment ? `
              <h4 style="margin-top:14px">Instructor note</h4>
              <div class="info-block">${escapeHtml(r.instructorComment)}</div>
            ` : ''}
            ${r.conditions && r.conditions.length ? `
              <h4 style="margin-top:14px">Conditions</h4>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
                ${r.conditions.map(c => `<span class="course-chip" style="background:var(--gold-50);color:var(--gold-700)">${escapeHtml(formatCondition(c))}</span>`).join('')}
              </div>
            ` : ''}
            ${r.document ? `
              <h4 style="margin-top:14px">Attached document</h4>
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--paper-100);border-radius:var(--radius-sm);margin-top:4px">
                <div>
                  <div style="font-weight:600;font-size:13px">${escapeHtml(r.document.name)}</div>
                  <div style="font-size:11.5px;color:var(--ink-500)">${escapeHtml(r.document.type)} · ${r.document.sizeKb} KB</div>
                </div>
                ${state.role !== 'ta' ? `<button class="btn btn-sm btn-ghost" onclick="downloadDoc('${r.id}','${escapeHtml(r.document.name)}')">${icon('download',12)} Download</button>` : ''}
              </div>
            ` : ''}
          </div>
        </div>

        <div style="margin-top:18px">
          <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-500);font-weight:600;margin-bottom:10px">Discussion</h4>
          <div class="thread" id="threadContainer">${renderThread(comments)}</div>
          <div class="thread-compose">
            <textarea id="newComment" placeholder="Add a message to the thread…"></textarea>
            <button class="btn btn-primary btn-sm" onclick="postComment('${r.id}')">Post</button>
          </div>
        </div>

        ${canProposeTimes ? `
          <div style="margin-top:18px;padding:16px;background:var(--blue-100);border:1px solid var(--blue-100);border-radius:var(--radius)">
            <h4 style="font-family:var(--font-display);font-size:15px;font-weight:600;margin-bottom:4px;color:var(--blue-500)">${icon('calendar',14)} Propose makeup times</h4>
            <p style="font-size:12.5px;color:var(--ink-700);margin-bottom:14px;line-height:1.45">
              Your <strong>${escapeHtml(r.absenceType || 'absence')}</strong> was approved and needs a makeup. Propose up to 5 times that work for you — the TA will confirm one based on their availability.
            </p>
            <div id="proposedTimesList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
              <div class="proposed-time-row" style="display:grid;grid-template-columns:1fr auto;gap:6px">
                <input type="datetime-local" class="proposed-time-input" style="padding:7px 10px;border:1px solid var(--paper-300);border-radius:var(--radius-sm);font-size:13px;background:white">
                <button class="btn btn-sm btn-ghost" onclick="removeProposedRow(this)">${icon('trash',12)}</button>
              </div>
            </div>
            <button class="btn btn-sm btn-ghost" onclick="addProposedRow()" style="margin-bottom:12px">${icon('plus',12)} Add another time</button>
            <button class="btn btn-gold btn-full" onclick="submitProposedTimes('${r.id}')">Submit proposed times</button>
          </div>
        ` : ''}

        ${canApproveSchedule && r.proposedTimes && r.proposedTimes.length ? (() => {
          const offer = typeof r.proposedTimes[0] === 'object' ? r.proposedTimes[0] : { datetime: r.proposedTimes[0] };
          const dtStr = offer.datetime
            ? new Date(offer.datetime.replace(' ','T')).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})
            : 'time TBD';
          return `
          <div style="margin-top:18px;padding:16px;background:var(--gold-50);border:1.5px solid var(--gold-500);border-radius:var(--radius)">
            <h4 style="font-family:var(--font-display);font-size:15px;font-weight:600;margin-bottom:4px;color:var(--gold-700)">${icon('calendar',14)} ${offer.isReschedule ? 'Reschedule requested' : 'TA proposed a time'}</h4>
            <p style="font-size:12.5px;color:var(--ink-700);margin-bottom:14px;line-height:1.45">
              <strong>${escapeHtml(offer.proposedByName || 'Your TA')}</strong> ${offer.isReschedule ? 'wants to move your session to' : 'suggested'}:
            </p>
            <div style="background:white;padding:12px 14px;border-radius:var(--radius-sm);margin-bottom:14px;border:1px solid var(--paper-300)">
              <div style="font-size:14.5px;font-weight:600;margin-bottom:4px">${dtStr}</div>
              <div style="font-size:12.5px;color:var(--ink-500)">
                ${offer.room ? `${icon('calendar',11)} ${escapeHtml(offer.room)}` : ''}
                ${offer.duration ? ` · ${offer.duration} min` : ''}
                ${offer.sessionType ? ` · ${escapeHtml(offer.sessionType)}` : ''}
              </div>
              ${offer.notes ? `<div style="margin-top:6px;font-size:12px;color:var(--ink-700);font-style:italic">"${escapeHtml(offer.notes)}"</div>` : ''}
            </div>

            <div style="display:flex;gap:8px;margin-bottom:14px">
              <button class="btn btn-gold" style="flex:1" onclick="acceptTASchedule('${r.id}')">${icon('check',12)} Accept this time</button>
              <button class="btn btn-ghost" style="flex:1" onclick="toggleCounterProposeUI()">Counter-propose</button>
            </div>

            <div id="counterProposeBlock" style="display:none;padding-top:12px;border-top:1px solid var(--gold-200)">
              <div style="font-size:12px;font-weight:600;color:var(--ink-700);margin-bottom:8px">Propose alternative times</div>
              <div id="counterList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
                <div class="counter-row" style="display:grid;grid-template-columns:1fr auto;gap:6px">
                  <input type="datetime-local" class="counter-input" style="padding:7px 10px;border:1px solid var(--paper-300);border-radius:var(--radius-sm);font-size:13px;background:white">
                  <button class="btn btn-sm btn-ghost" onclick="removeCounterRow(this)">${icon('trash',12)}</button>
                </div>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn-sm btn-ghost" onclick="addCounterRow()">${icon('plus',12)} Add time</button>
                <button class="btn btn-sm btn-danger" style="margin-left:auto" onclick="declineTASchedule('${r.id}')">Decline &amp; counter-propose</button>
              </div>
            </div>
          </div>
          `;
        })() : ''}

        ${r.proposedTimes && r.proposedTimes.length && !canConfirmSchedule && !canApproveSchedule ? (() => {
          // Handle both formats: array of strings (student proposals) or objects (TA offers)
          const items = r.proposedTimes.map(t => {
            if (typeof t === 'string') return { datetime: t };
            return t;
          }).filter(i => i.datetime);
          if (!items.length) return '';
          const isTAOffer = typeof r.proposedTimes[0] === 'object';
          return `
          <div style="margin-top:14px;padding:12px 14px;background:var(--paper-100);border-radius:var(--radius-sm)">
            <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-500);font-weight:600;margin-bottom:8px">${isTAOffer ? 'Pending schedule offer' : "Student's proposed times"}</h4>
            <ul style="list-style:none;padding:0;margin:0;font-size:13px;display:flex;flex-direction:column;gap:4px">
              ${items.map(i => `<li style="padding:4px 0">${icon('clock',12)} ${new Date(i.datetime.replace(' ','T')).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}${i.room ? ` @ ${escapeHtml(i.room)}` : ''}</li>`).join('')}
            </ul>
          </div>
          `;
        })() : ''}

        ${canConfirmSchedule ? (() => {
          const studentStrings = (r.proposedTimes || []).filter(t => typeof t === 'string');
          const hasStudentProposals = studentStrings.length > 0;
          return `
          <div style="margin-top:18px;padding:16px;background:var(--green-50);border:1px solid var(--green-100);border-radius:var(--radius)">
            <h4 style="font-family:var(--font-display);font-size:15px;font-weight:600;margin-bottom:4px;color:var(--green-600)">${icon('check',14)} Confirm the makeup schedule</h4>
            <p style="font-size:12.5px;color:var(--ink-700);margin-bottom:14px;line-height:1.45">
              ${hasStudentProposals
                ? `The instructor approved this <strong>${escapeHtml(r.absenceType || 'absence')}</strong> and ${escapeHtml(r.studentName)} has proposed ${studentStrings.length} time${studentStrings.length !== 1 ? 's' : ''}. Pick one or propose your own.`
                : `The instructor approved this <strong>${escapeHtml(r.absenceType || 'absence')}</strong> and no student times have been proposed yet. Suggest a time — the student will confirm it.`
              }
            </p>
            ${hasStudentProposals ? `
              <div style="margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-500);font-weight:600">Student proposed — click one, or click again to unselect</div>
                  <button type="button" class="link-btn" style="font-size:12px" onclick="clearProposedSlot()">Propose my own time →</button>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px">
                  ${r.proposedTimes.filter(t => typeof t === 'string').map((t, i) => `
                    <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:white;border:1.5px solid var(--paper-300);border-radius:var(--radius-sm);cursor:pointer" class="ta-slot-opt">
                      <input type="radio" name="taSlot" value="${t}" onclick="toggleProposedSlot(this, '${t.replace(/'/g, "\\'")}')">
                      <span style="font-size:13px">${new Date(t.replace(' ','T')).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            <div class="form-grid">
              <div class="field"><label>Confirmed date &amp; time *</label><input type="datetime-local" id="tcDT"></div>
              <div class="field"><label>Room *</label><input type="text" id="tcRoom" placeholder="e.g. Room 214"></div>
            </div>
            <div class="form-grid">
              <div class="field"><label>Session type</label>
                <select id="tcType">
                  ${['Exam','Quiz','Midterm Retake','Final Retake','Lab','Presentation','Other'].map(t =>
                    `<option ${t === r.absenceType ? 'selected':''}>${t}</option>`).join('')}
                </select>
              </div>
              <div class="field"><label>Duration (min)</label><input type="number" id="tcDur" value="60" min="15"></div>
            </div>
            <div class="field">
              <label>Notes for student (optional)</label>
              <textarea id="tcNotes" placeholder="What to bring, where to meet, etc." style="min-height:50px"></textarea>
            </div>
            <button class="btn btn-gold btn-full" onclick="submitTAConfirm('${r.id}')">Confirm &amp; notify student</button>
          </div>
          `;
        })() : ''}

        ${isAdminReview ? `
          <div style="margin-top:18px;padding:16px;background:var(--gold-50);border:1px solid var(--gold-200);border-radius:var(--radius)">
            <h4 style="font-family:var(--font-display);font-size:15px;font-weight:600;margin-bottom:4px;color:var(--gold-700)">${icon('shield',14)} Admin review</h4>
            <p style="font-size:12.5px;color:var(--ink-700);margin-bottom:14px;line-height:1.45">
              Add your recommendation and context below. The request will return to the instructor for the final decision.
            </p>
            <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
              ${[
                ['Recommend Approval','Green-light the excuse; instructor still signs off.'],
                ['Recommend Denial','Advise denial; instructor still signs off.'],
                ['Recommend Conditions','Suggest conditions (extensions, makeups) for the instructor to apply.'],
                ['Return without recommendation','Send context back without steering the outcome.']
              ].map(([label, desc], i) => `
                <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:white;border:1.5px solid var(--paper-300);border-radius:var(--radius-sm);cursor:pointer;transition:border-color var(--dur) var(--ease)" class="admin-rec-opt">
                  <input type="radio" name="adminRec" value="${label}" style="margin-top:3px;flex-shrink:0" onchange="updateAdminBtn()">
                  <div>
                    <div style="font-weight:600;font-size:13.5px">${label}</div>
                    <div style="font-size:11.5px;color:var(--ink-500);margin-top:1px">${desc}</div>
                  </div>
                </label>
              `).join('')}
            </div>
            <div class="field" style="margin-bottom:10px">
              <label>Comment for the instructor *</label>
              <textarea id="adminComment" placeholder="Provide context, cite policy, flag concerns, etc." oninput="updateAdminBtn()" style="min-height:80px"></textarea>
            </div>
            <button class="btn btn-gold btn-full" id="adminOverrideBtn" disabled onclick="submitAdminOverride('${r.id}')">Return to instructor</button>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        ${canEdit ? `<button class="btn btn-ghost" onclick="closeModal({target:{id:'modalOverlay'}});editRequest('${r.id}')">${icon('edit',12)} Edit</button>` : ''}
        ${canAddDoc ? `<button class="btn btn-ghost" onclick="openAddDocModal('${r.id}')">${icon('plus',12)} Add documentation</button>` : ''}
        ${canWithdraw ? `<button class="btn btn-danger" onclick="withdrawRequest('${r.id}')">Withdraw</button>` : ''}
        <button class="btn btn-ghost" onclick="closeModal({target:{id:'modalOverlay'}})">Close</button>
      </div>
    `, 'lg');
  } catch (err) {
    toast(err.message, 'error');
  }
}
window.viewRequest = viewRequest;

function renderThread(comments) {
  if (!comments.length) return `<div class="thread-empty">No messages yet. Start the conversation below.</div>`;
  return comments.map(c => `
    <div class="thread-comment" data-role="${c.author_role}">
      <div class="thread-meta">
        <span><span class="thread-author">${escapeHtml(c.author_name)}</span><span class="thread-role-pill">${c.author_role}</span></span>
        <span class="thread-time">${timeAgo(c.created_at_utc)}</span>
      </div>
      <div class="thread-body">${escapeHtml(c.body)}</div>
    </div>
  `).join('');
}
async function postComment(reqId) {
  const ta = document.getElementById('newComment');
  const body = ta.value.trim();
  if (!body) return;
  try {
    const { comments } = await API.addComment(reqId, body);
    document.getElementById('threadContainer').innerHTML = renderThread(comments);
    ta.value = '';
  } catch (err) {
    toast(err.message, 'error');
  }
}
window.postComment = postComment;

function formatCondition(c) {
  if (c.type === 'deadline_extension') return `+${c.days || ''} day extension${c.scope ? ' (' + c.scope + ')' : ''}`;
  if (c.type === 'makeup_required')    return `Makeup: ${c.item || c.detail || 'TBD'}${c.by ? ' by ' + c.by : ''}`;
  if (c.type === 'partial_excuse')     return `Partial: ${c.scope || c.detail || ''}`;
  if (c.type === 'late_penalty_waived') return `Late penalty waived`;
  return (c.type || '').replace(/_/g, ' ') + (c.detail ? ': ' + c.detail : '');
}

async function downloadDoc(id, name) {
  try {
    const blob = await API.downloadDocument(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  } catch (err) { toast(err.message, 'error'); }
}
window.downloadDoc = downloadDoc;

async function withdrawRequest(id) {
  const ok = await confirmDialog('Withdraw request?', 'This will return the request to Draft status. You can edit and re-submit. The 5-minute window must still be active.', 'Withdraw', true);
  if (!ok) return;
  try {
    await API.withdrawRequest(id);
    closeModal({ target: { id: 'modalOverlay' } });
    toast('Request withdrawn', 'success');
    if (state.page === 's-reqs') navigate('s-reqs');
  } catch (err) { toast(err.message, 'error'); }
}
window.withdrawRequest = withdrawRequest;

async function deleteRequest(id) {
  const ok = await confirmDialog('Delete this draft?', 'This permanently removes the draft. This cannot be undone.', 'Delete', true);
  if (!ok) return;
  try {
    await API.deleteRequest(id);
    toast('Draft deleted', 'success');
    if (state.page === 's-reqs') navigate('s-reqs');
  } catch (err) { toast(err.message, 'error'); }
}
window.deleteRequest = deleteRequest;

async function editRequest(id) {
  // Load the request and pre-fill the New Request form
  try {
    const data = await API.getRequest(id);
    const r = data.request;
    state.editingId = id;
    state.editingRequest = r;
    navigate('s-new');
  } catch (err) { toast(err.message, 'error'); }
}
window.editRequest = editRequest;

// ═══════════════════════════════════════════════════════════════════
// STUDENT — New / Edit Request
// ═══════════════════════════════════════════════════════════════════
ROUTES['s-new'] = async function() {
  const { courses } = await API.myCourses();
  const editing = state.editingRequest;
  state.editingRequest = null;  // consume

  // Build a lookup of instructor + TA info for the routing panel
  state._courseRouting = {};
  courses.forEach(c => {
    state._courseRouting[c.course_id] = {
      courseName: c.course_name,
      instructorName: c.instructor_name || 'TBA',
      instructorId: c.instructor_id
    };
  });

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>${editing ? 'Edit request' : 'Submit absence request'}</h2>
        <p>${editing ? 'Update your draft and submit when ready.' : 'Complete the form below. Required fields are marked with *.'}</p>
      </div>
    </div>
    <div class="card" style="max-width:780px">
      <div class="form-grid">
        <div class="field">
          <label>Course *</label>
          <select id="fCourse" onchange="updateRoutingPanel()">
            ${courses.length === 0 ? '<option value="">No enrolled courses — add one first</option>' : ''}
            ${courses.map(c => `<option value="${c.course_id}" ${editing && editing.course === c.course_id ? 'selected':''}>${escapeHtml(c.course_id)} — ${escapeHtml(c.course_name)}</option>`).join('')}
          </select>
          <button class="link-btn" style="margin-top:6px;font-size:12px" onclick="navigate('s-courses')">+ Add a new course</button>
        </div>
        <div class="field">
          <label>Category</label>
          <select id="fCat">
            <option value="">Select…</option>
            ${['Medical','Family Emergency','Academic Conflict','Planned','DSS','Other'].map(c =>
              `<option ${editing && editing.category === c ? 'selected':''}>${c}</option>`).join('')}
          </select>
        </div>

      <div id="routingPanel" style="grid-column:1/-1;padding:12px 14px;background:var(--gold-50);border:1px solid var(--gold-200);border-radius:var(--radius-sm);display:${courses.length ? 'flex' : 'none'};align-items:center;gap:12px;margin-bottom:4px">
        <div style="width:32px;height:32px;background:var(--gold-500);color:white;border-radius:50%;display:grid;place-items:center;flex-shrink:0">${icon('send',14)}</div>
        <div style="flex:1;font-size:12.5px;line-height:1.45">
          <strong>Routing:</strong> <span id="routingTarget">This request will be sent to your instructor for review.</span>
        </div>
      </div>

        <div class="field">
          <label>Absence date *</label>
          <input type="date" id="fDate" value="${editing ? editing.date : ''}">
        </div>
        <div class="field">
          <label>What will you miss?</label>
          <select id="fAbsType">
            <option value="">Select type…</option>
            ${['Exam','Midterm','Final','Quiz','Lecture','Lab','Presentation','Assignment Deadline','Group Meeting','Other'].map(t =>
              `<option ${editing && editing.absenceType === t ? 'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-grid-full">
          <div class="checkbox-row">
            <input type="checkbox" id="fPlanned" ${editing && editing.planned ? 'checked':''}>
            <label for="fPlanned">Planned absence — conference, religious observance, or scheduled event</label>
          </div>
        </div>
        <div class="field form-grid-full">
          <label>Reason *</label>
          <textarea id="fReason" placeholder="Brief explanation of your absence">${editing ? escapeHtml(editing.reason || '') : ''}</textarea>
        </div>
        <div class="field form-grid-full">
          <label>Supporting documentation</label>
          <div class="upload-zone" id="uploadZone" onclick="document.getElementById('fFile').click()">
            <strong>Drop a file or click to browse</strong>
            <small>PDF, JPG, PNG · Max 5 MB</small>
            <input type="file" id="fFile" accept=".pdf,.jpg,.jpeg,.png" style="display:none" onchange="handleFile(this)">
          </div>
        </div>
        <div class="form-grid-full">
          <div class="checkbox-row">
            <input type="checkbox" id="fConsent">
            <label for="fConsent">I acknowledge that uploaded documents may be reviewed by my instructor and authorized administrators in compliance with FERPA.</label>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="navigate('s-reqs')">Cancel</button>
        <button class="btn btn-ghost" onclick="submitRequest(true)">Save as draft</button>
        <button class="btn btn-gold" onclick="submitRequest(false)">${editing ? 'Update' : 'Submit'} request</button>
      </div>
    </div>
  `;
  if (state.editingId) {
    state._editId = state.editingId;
    state.editingId = null;
  } else {
    state._editId = null;
  }
  // Populate routing panel on initial load
  updateRoutingPanel();
}

function updateRoutingPanel() {
  const target = document.getElementById('routingTarget');
  const panel = document.getElementById('routingPanel');
  if (!target || !panel) return;
  const courseId = document.getElementById('fCourse')?.value;
  const info = courseId && state._courseRouting && state._courseRouting[courseId];
  if (!info) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'flex';
  target.innerHTML = `This request will be sent to <strong>${escapeHtml(info.instructorName)}</strong> for ${escapeHtml(info.courseName)}. If approved and rescheduling is needed, it will also route to the course's TAs for coordination.`;
}
window.updateRoutingPanel = updateRoutingPanel;

function handleFile(input) {
  const f = input.files[0];
  if (!f) return;
  if (f.size > 5 * 1024 * 1024) {
    toast('File exceeds 5 MB limit', 'error');
    input.value = '';
    return;
  }
  const zone = document.getElementById('uploadZone');
  zone.classList.add('has-file');
  zone.innerHTML = `<strong>✓ ${escapeHtml(f.name)}</strong><small>${Math.ceil(f.size / 1024)} KB · click to replace</small><input type="file" id="fFile" accept=".pdf,.jpg,.jpeg,.png" style="display:none" onchange="handleFile(this)">`;
  // Re-attach the file because we replaced the input
  const newInput = document.getElementById('fFile');
  const dt = new DataTransfer();
  dt.items.add(f);
  newInput.files = dt.files;
}
window.handleFile = handleFile;

async function submitRequest(asDraft) {
  const courseId = document.getElementById('fCourse').value;
  const date = document.getElementById('fDate').value;
  const reason = document.getElementById('fReason').value.trim();
  const category = document.getElementById('fCat').value;
  const absenceType = document.getElementById('fAbsType').value;
  const planned = document.getElementById('fPlanned').checked;
  const consent = document.getElementById('fConsent').checked;
  const file = document.getElementById('fFile').files[0];

  if (!courseId) { toast('Please choose a course', 'error'); return; }
  if (!date)     { toast('Please pick an absence date', 'error'); return; }
  if (!reason)   { toast('Please provide a reason', 'error'); return; }
  if (!asDraft && file && !consent) { toast('Please acknowledge FERPA consent', 'error'); return; }

  try {
    if (state._editId) {
      // Edit path
      await API.editRequest(state._editId, { absenceDate: date, reason, category, courseId, saveAsDraft: asDraft });
      const id = state._editId;
      state._editId = null;
      toast(asDraft ? 'Draft saved' : 'Request updated', 'success');
      navigate('s-reqs');
    } else {
      // New submission
      const fd = new FormData();
      fd.append('courseId', courseId);
      fd.append('absenceDate', date);
      fd.append('reason', reason);
      if (category) fd.append('category', category);
      if (absenceType) fd.append('absenceType', absenceType);
      fd.append('plannedAbsence', planned ? 'true' : 'false');
      fd.append('consent', 'true');
      if (file) fd.append('document', file);
      const { request } = await API.submitRequest(fd);

      if (asDraft) {
        // Move to draft after creating
        await API.editRequest(request.id, { saveAsDraft: true });
        toast('Draft saved', 'success');
        navigate('s-reqs');
      } else {
        // Show undo toast — 5 minute window, but we expose undo for ~10 sec
        toast(`Request ${request.id} submitted`, 'success', 'Undo', async () => {
          try { await API.withdrawRequest(request.id); toast('Request withdrawn — saved as draft', 'info'); navigate('s-reqs'); }
          catch (err) { toast(err.message, 'error'); }
        }, 10000);
        navigate('s-reqs');
      }
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}
window.submitRequest = submitRequest;

// ═══════════════════════════════════════════════════════════════════
// STUDENT — My Courses (with Add Course form)
// ═══════════════════════════════════════════════════════════════════
ROUTES['s-courses'] = async function() {
  const { courses } = await API.myCourses();
  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>My courses</h2>
        <p>Manage your enrollment for this semester</p>
      </div>
      <div class="ph-actions">
        <button class="btn btn-ghost" onclick="openBrowseCatalogModal()">${icon('search',14)} Browse catalog</button>
        <button class="btn btn-gold" onclick="openAddCourseModal()">${icon('plus',14)} Add course</button>
      </div>
    </div>

    ${courses.length === 0
      ? `<div class="empty">
          <div class="empty-icon">${icon('book',24)}</div>
          <h3>No courses yet</h3>
          <p>Browse the catalog to enroll in existing courses, or create a new one.</p>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
            <button class="btn btn-ghost" onclick="openBrowseCatalogModal()">${icon('search',14)} Browse catalog</button>
            <button class="btn btn-gold" onclick="openAddCourseModal()">${icon('plus',14)} Add new</button>
          </div>
        </div>`
      : `<div class="table-wrap">
          <table class="tbl">
            <thead><tr>
              <th>Course</th><th>Section</th><th>Instructor</th><th>Schedule</th><th></th>
            </tr></thead>
            <tbody>${courses.map(c => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span class="course-chip-dot" style="--course-color:${c.color || '#C5841F'};width:10px;height:10px;border-radius:2px"></span>
                    <div>
                      <div style="font-weight:600">${escapeHtml(c.course_id)}</div>
                      <div style="font-size:12px;color:var(--ink-500)">${escapeHtml(c.course_name)}</div>
                    </div>
                  </div>
                </td>
                <td>${escapeHtml(c.section)}</td>
                <td>${escapeHtml(c.instructor_name_override || c.instructor_name)}</td>
                <td><span class="hash-pill">${escapeHtml(c.meeting_days || 'MWF')}</span> ${escapeHtml(c.meeting_time || '10:00')}</td>
                <td style="text-align:right">
                  ${c.is_owner ? `<button class="btn btn-sm btn-danger" onclick="deleteCourse('${c.course_id}','${escapeHtml(c.course_name)}')">${icon('trash',12)}</button>` : ''}
                </td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>`
    }
  `;
};

async function openBrowseCatalogModal() {
  // Load all courses + my enrollments to know which ones I'm already in
  const [{ courses: all }, { courses: mine }] = await Promise.all([
    API.listCourses(),
    API.myCourses()
  ]);
  const enrolledIds = new Set(mine.map(c => c.course_id));
  window._catalogCourses = all;
  window._catalogEnrolled = enrolledIds;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">${icon('search')} Browse course catalog</div>
      <button class="icon-btn" onclick="closeModal({target:{id:'modalOverlay'}})">${ICONS.close.replace('<svg','<svg width="16" height="16"')}</button>
    </div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--ink-700);margin-bottom:12px">Every course created by every registered instructor appears here. Enroll with one click.</p>
      <input type="text" id="catalogSearch" placeholder="Search by course code, name, or instructor…" oninput="filterCatalog()" style="width:100%;margin-bottom:10px">
      <div id="catalogList" style="max-height:60vh;overflow-y:auto;border:1px solid var(--paper-300);border-radius:var(--radius-sm)">
        ${renderCatalogList(all, enrolledIds)}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal({target:{id:'modalOverlay'}})">Done</button>
    </div>
  `, 'md');
}
window.openBrowseCatalogModal = openBrowseCatalogModal;

function renderCatalogList(courses, enrolledIds) {
  if (courses.length === 0) return `<div style="padding:24px;text-align:center;color:var(--ink-500);font-size:13px">No courses found.</div>`;
  return courses.map(c => {
    const enrolled = enrolledIds.has(c.course_id);
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--paper-200)">
        <span style="width:10px;height:10px;border-radius:2px;background:${c.color || '#C5841F'};flex-shrink:0"></span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:600">${escapeHtml(c.course_id)} — ${escapeHtml(c.course_name)}</div>
          <div style="font-size:11.5px;color:var(--ink-500)">Section ${escapeHtml(c.section)} · ${escapeHtml(c.instructor_name || 'TBA')} · ${escapeHtml(c.meeting_days || 'MWF')} ${escapeHtml(c.meeting_time || '')}</div>
        </div>
        ${enrolled
          ? `<span class="badge badge-approved">Enrolled</span>`
          : `<button class="btn btn-sm btn-gold" onclick="enrollFromCatalog('${c.course_id}')">${icon('plus',12)} Enroll</button>`
        }
      </div>
    `;
  }).join('');
}
window.renderCatalogList = renderCatalogList;

function filterCatalog() {
  const searchEl = document.getElementById('catalogSearch');
  if (!searchEl) return;
  const q = (searchEl.value || '').toLowerCase().trim();
  const all = window._catalogCourses || [];
  const enrolled = window._catalogEnrolled || new Set();
  const filtered = !q ? all : all.filter(c =>
    String(c.course_id || '').toLowerCase().includes(q) ||
    String(c.course_name || '').toLowerCase().includes(q) ||
    String(c.instructor_name || '').toLowerCase().includes(q) ||
    String(c.section || '').toLowerCase().includes(q)
  );
  const listEl = document.getElementById('catalogList');
  if (listEl) listEl.innerHTML = renderCatalogList(filtered, enrolled);
}
window.filterCatalog = filterCatalog;

async function enrollFromCatalog(courseId) {
  try {
    await API.enrollCourse(courseId);
    toast('Enrolled successfully', 'success');
    // Refresh in place — re-fetch enrollments and redraw list
    const { courses: mine } = await API.myCourses();
    window._catalogEnrolled = new Set(mine.map(c => c.course_id));
    filterCatalog();
  } catch (err) { toast(err.message || 'Enrollment failed', 'error'); }
}
window.enrollFromCatalog = enrollFromCatalog;

function openAddCourseModal() {
  const colors = ['#C5841F','#2980B9','#27AE60','#8E44AD','#E74C3C','#F39C12','#16A085','#D35400'];
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${icon('plus')} Add a course</div>
      <button class="icon-btn" onclick="closeModal({target:{id:'modalOverlay'}})">${ICONS.close.replace('<svg','<svg width="16" height="16"')}</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label>Course ID *</label><input type="text" id="ncId" placeholder="e.g. ECON-201" autofocus></div>
        <div class="field"><label>Section</label><input type="text" id="ncSec" placeholder="001" value="001"></div>
        <div class="field form-grid-full"><label>Course name *</label><input type="text" id="ncName" placeholder="e.g. Intermediate Microeconomics"></div>
        <div class="field form-grid-full"><label>Instructor name *</label><input type="text" id="ncInst" placeholder="e.g. Dr. Anna Schmidt"></div>
        <div class="field"><label>Meeting days</label>
          <select id="ncDays">
            <option value="MWF">Mon / Wed / Fri</option>
            <option value="TR">Tue / Thu</option>
            <option value="MW">Mon / Wed</option>
            <option value="MWF">Mon / Wed / Fri</option>
            <option value="WF">Wed / Fri</option>
            <option value="M">Monday only</option>
            <option value="T">Tuesday only</option>
            <option value="W">Wednesday only</option>
            <option value="R">Thursday only</option>
            <option value="F">Friday only</option>
          </select>
        </div>
        <div class="field"><label>Meeting time</label><input type="time" id="ncTime" value="10:00"></div>
        <div class="field form-grid-full"><label>Color</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${colors.map((c, i) => `<label style="cursor:pointer">
              <input type="radio" name="ncColor" value="${c}" ${i===0?'checked':''} style="display:none">
              <span style="display:inline-block;width:32px;height:32px;border-radius:50%;background:${c};border:2px solid transparent;transition:all 200ms" data-c="${c}"></span>
            </label>`).join('')}
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal({target:{id:'modalOverlay'}})">Cancel</button>
      <button class="btn btn-gold" onclick="submitNewCourse()">Add course</button>
    </div>
  `);
  // Wire color picker visual
  document.querySelectorAll('input[name="ncColor"]').forEach(r => {
    r.addEventListener('change', () => {
      document.querySelectorAll('input[name="ncColor"] + span').forEach(s =>
        s.style.borderColor = (s.dataset.c === r.value) ? 'var(--ink-900)' : 'transparent'
      );
    });
  });
  // Initialize
  const first = document.querySelector('input[name="ncColor"] + span');
  if (first) first.style.borderColor = 'var(--ink-900)';
}
window.openAddCourseModal = openAddCourseModal;

async function submitNewCourse() {
  const courseId = document.getElementById('ncId').value.trim();
  const courseName = document.getElementById('ncName').value.trim();
  const instructorName = document.getElementById('ncInst').value.trim();
  const section = document.getElementById('ncSec').value.trim();
  const meetingDays = document.getElementById('ncDays').value;
  const meetingTime = document.getElementById('ncTime').value;
  const color = document.querySelector('input[name="ncColor"]:checked')?.value || '#C5841F';

  if (!courseId || !courseName || !instructorName) {
    toast('Please fill all required fields', 'error');
    return;
  }
  try {
    await API.createCourse({ courseId, courseName, instructorName, section, meetingDays, meetingTime, color });
    closeModal({ target: { id: 'modalOverlay' } });
    toast('Course added', 'success');
    if (state.page === 's-courses') navigate('s-courses');
    else navigate(state.page);
  } catch (err) { toast(err.message, 'error'); }
}
window.submitNewCourse = submitNewCourse;

async function deleteCourse(id, name) {
  const ok = await confirmDialog(`Remove ${id}?`, `This will remove "${name}" from your courses. Existing requests stay in your history.`, 'Remove', true);
  if (!ok) return;
  try {
    await API.deleteCourse(id);
    toast('Course removed', 'success');
    navigate('s-courses');
  } catch (err) {
    // Maybe they aren't owner — try drop instead
    try {
      await API.dropCourse(id);
      toast('Dropped from course', 'success');
      navigate('s-courses');
    } catch (err2) {
      toast(err2.message, 'error');
    }
  }
}
window.deleteCourse = deleteCourse;

// ═══════════════════════════════════════════════════════════════════
// INSTRUCTOR — My Courses (view + add more post-signup)
// ═══════════════════════════════════════════════════════════════════
ROUTES['i-courses'] = async function() {
  const { courses } = await API.myCourses();
  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>My courses</h2>
        <p>Courses you teach this term. Students enrolled in these will route requests to you.</p>
      </div>
      <div class="ph-actions">
        <button class="btn btn-gold" onclick="openAddInstructorCourseModal()">${icon('plus',14)} Add a course</button>
      </div>
    </div>

    ${courses.length === 0
      ? `<div class="empty">
          <div class="empty-icon">${icon('book',24)}</div>
          <h3>No courses yet</h3>
          <p>Add a course you teach to start receiving student requests.</p>
          <button class="btn btn-gold" onclick="openAddInstructorCourseModal()" style="margin-top:12px">${icon('plus',14)} Add your first course</button>
        </div>`
      : `<div class="table-wrap">
          <table class="tbl">
            <thead><tr>
              <th>Course</th><th>Section</th><th>Schedule</th><th>Students enrolled</th>
            </tr></thead>
            <tbody>${courses.map(c => {
              const enrolled = db_enrollCount(c.course_id);
              return `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px">
                      <span style="width:10px;height:10px;border-radius:2px;background:${c.color || '#C5841F'}"></span>
                      <div>
                        <div style="font-weight:600">${escapeHtml(c.course_id)}</div>
                        <div style="font-size:12px;color:var(--ink-500)">${escapeHtml(c.course_name)}</div>
                      </div>
                    </div>
                  </td>
                  <td>${escapeHtml(c.section)}</td>
                  <td><span class="hash-pill">${escapeHtml(c.meeting_days || 'MWF')}</span> ${escapeHtml(c.meeting_time || '10:00')}</td>
                  <td id="enrolled-${c.course_id}">—</td>
                </tr>
              `;
            }).join('')}</tbody>
          </table>
        </div>`
    }
  `;
  // Fetch enrollment counts async (server-side join via request list or similar)
  // Kept simple: just display "—" rather than building a new endpoint right now
};

function db_enrollCount() { return '—'; }  // placeholder helper

function openAddInstructorCourseModal() {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${icon('plus')} Add a course you teach</div>
      <button class="icon-btn" onclick="closeModal({target:{id:'modalOverlay'}})">${ICONS.close.replace('<svg','<svg width="16" height="16"')}</button>
    </div>
    <div class="modal-body">
      <p style="font-size:12.5px;color:var(--ink-700);margin-bottom:14px;line-height:1.5">Create a new course or section. You'll be set as the instructor, and students will be able to enroll in it.</p>
      <div class="form-grid">
        <div class="field">
          <label>Course code *</label>
          <input type="text" id="icNewCode" placeholder="CSCI-6364" autocomplete="off" style="text-transform:uppercase">
        </div>
        <div class="field">
          <label>Section *</label>
          <input type="text" id="icNewSection" placeholder="002" autocomplete="off" value="001">
        </div>
      </div>
      <div class="field">
        <label>Course name *</label>
        <input type="text" id="icNewName" placeholder="Foundations of AI" autocomplete="off">
      </div>
      <div class="form-grid">
        <div class="field">
          <label>Meeting days</label>
          <input type="text" id="icNewDays" placeholder="MWF" autocomplete="off" value="MWF">
        </div>
        <div class="field">
          <label>Meeting time</label>
          <input type="time" id="icNewTime" value="10:00">
        </div>
      </div>
      <div id="icNewError" class="alert alert-error hidden" style="margin-top:10px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal({target:{id:'modalOverlay'}})">Cancel</button>
      <button class="btn btn-gold" onclick="submitInstructorCourse()">Add course</button>
    </div>
  `, 'md');
}
window.openAddInstructorCourseModal = openAddInstructorCourseModal;

async function submitInstructorCourse() {
  const code = document.getElementById('icNewCode').value.trim().toUpperCase();
  const section = document.getElementById('icNewSection').value.trim() || '001';
  const name = document.getElementById('icNewName').value.trim();
  const days = document.getElementById('icNewDays').value.trim() || 'MWF';
  const time = document.getElementById('icNewTime').value || '10:00';
  const errEl = document.getElementById('icNewError');
  errEl.classList.add('hidden');
  if (!code || !name) {
    errEl.textContent = 'Please fill in course code and name.';
    errEl.classList.remove('hidden');
    return;
  }
  try {
    await API.createInstructorCourse({
      courseCode: code, section, courseName: name,
      meetingDays: days, meetingTime: time
    });
    closeModal({ target: { id: 'modalOverlay' } });
    toast(`Created ${code}-${section}`, 'success');
    navigate('i-courses');
  } catch (err) {
    errEl.textContent = err.message || 'Could not create course.';
    errEl.classList.remove('hidden');
  }
}
window.submitInstructorCourse = submitInstructorCourse;

// ═══════════════════════════════════════════════════════════════════
// CALENDAR (student & instructor)
// ═══════════════════════════════════════════════════════════════════
ROUTES['s-cal'] = function() { return renderCalendar(); };
ROUTES['i-cal'] = function() { return renderCalendar(); };

async function renderCalendar() {
  const cursor = state.calendar.cursor;
  const mode = state.calendar.mode;
  let from, to;
  if (mode === 'month') {
    from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    to   = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  } else {
    // week containing cursor
    const day = cursor.getDay();
    from = new Date(cursor); from.setDate(cursor.getDate() - day);
    to = new Date(from); to.setDate(from.getDate() + 6);
  }

  // Build events client-side from courses + requests
  const [{ requests }, { courses }] = await Promise.all([API.listRequests(), API.myCourses()]);
  const events = buildCalendarEvents(courses, requests, from, to);

  document.getElementById('main').innerHTML = `
    <div class="cal-header">
      <div class="cal-nav">
        <button class="btn btn-ghost btn-sm" onclick="calPrev()">‹</button>
        <span class="cal-nav-title" id="calTitle">${calTitle(cursor, mode, from, to)}</span>
        <button class="btn btn-ghost btn-sm" onclick="calNext()">›</button>
        <button class="btn btn-ghost btn-sm" onclick="calToday()" style="margin-left:8px">Today</button>
      </div>
      <div class="ph-actions">
        <div class="cal-toggle">
          <button class="${mode==='month'?'active':''}" onclick="calSetMode('month')">Month</button>
          <button class="${mode==='week'?'active':''}" onclick="calSetMode('week')">Week</button>
        </div>
        ${state.role === 'student' ? `<button class="btn btn-gold" onclick="navigate('s-new')">${icon('plus',14)} New request</button>` : ''}
      </div>
    </div>
    <div id="calBody"></div>
  `;
  document.getElementById('calBody').innerHTML = mode === 'month'
    ? renderMonth(cursor, events)
    : renderWeek(from, to, events);
}

function calTitle(cursor, mode, from, to) {
  if (mode === 'month') {
    return cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  const sameMonth = from.getMonth() === to.getMonth();
  if (sameMonth) {
    return `${from.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${to.getDate()}, ${to.getFullYear()}`;
  }
  return `${from.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${to.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
}

function calPrev() {
  if (state.calendar.mode === 'month') state.calendar.cursor.setMonth(state.calendar.cursor.getMonth() - 1);
  else state.calendar.cursor.setDate(state.calendar.cursor.getDate() - 7);
  renderCalendar();
}
function calNext() {
  if (state.calendar.mode === 'month') state.calendar.cursor.setMonth(state.calendar.cursor.getMonth() + 1);
  else state.calendar.cursor.setDate(state.calendar.cursor.getDate() + 7);
  renderCalendar();
}
function calToday() { state.calendar.cursor = new Date(); renderCalendar(); }
function calSetMode(m) { state.calendar.mode = m; renderCalendar(); }
window.calPrev = calPrev; window.calNext = calNext; window.calToday = calToday; window.calSetMode = calSetMode;

const DAY_LETTERS = { U: 0, M: 1, T: 2, W: 3, R: 4, F: 5, S: 6 };

function buildCalendarEvents(courses, requests, from, to) {
  const events = [];
  // Class meetings
  courses.forEach(c => {
    const days = (c.meeting_days || 'MWF').toUpperCase().split('').map(d => DAY_LETTERS[d]).filter(d => d !== undefined);
    const cur = new Date(from);
    while (cur <= to) {
      if (days.includes(cur.getDay())) {
        events.push({
          type: 'class',
          date: ymd(cur),
          time: c.meeting_time || '10:00',
          duration: c.meeting_duration || 60,
          title: c.course_id,
          subtitle: c.course_name,
          color: c.color || '#C5841F',
          courseId: c.course_id,
        });
      }
      cur.setDate(cur.getDate() + 1);
    }
  });
  // Absence requests
  requests.forEach(r => {
    if (!r.date) return;
    const d = r.date.slice(0, 10);
    if (d >= ymd(from) && d <= ymd(to)) {
      const colors = {
        'Pending': '#E67E22', 'Denied': '#E74C3C', 'Approved with Conditions': '#F39C12',
        'Partial Approval': '#2980B9', 'More Info Requested': '#8E44AD',
        'Approved': '#27AE60', 'Final Approved': '#27AE60', 'Scheduled': '#27AE60',
        'Draft': '#95A5A6', 'Reviewing': '#2980B9', 'Escalated': '#D35400'
      };
      events.push({
        type: 'absence',
        date: d,
        title: `${r.status}: ${r.courseName || r.course || ''}${r.studentName ? ' — ' + r.studentName : ''}`,
        color: colors[r.status] || '#95A5A6',
        requestId: r.id,
        time: null,
      });
    }
  });
  return events;
}

function renderMonth(cursor, events) {
  // First day of grid: prior Sunday
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = first.getDay();
  const gridStart = new Date(first); gridStart.setDate(first.getDate() - startOffset);
  // 6 weeks * 7 days
  const todayStr = ymd(new Date());
  const eventsByDay = {};
  events.forEach(e => { (eventsByDay[e.date] = eventsByDay[e.date] || []).push(e); });

  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
    const ds = ymd(d);
    const inMonth = d.getMonth() === cursor.getMonth();
    const isToday = ds === todayStr;
    const dayEvents = (eventsByDay[ds] || []).slice(0, 3);
    const overflow = (eventsByDay[ds] || []).length - 3;
    cells += `
      <div class="cal-day ${inMonth ? '' : 'other-month'} ${isToday ? 'today' : ''}" onclick="calDayClick('${ds}')">
        <div class="cal-day-num">${d.getDate()}</div>
        <div class="cal-events">
          ${dayEvents.map(e => `
            <div class="cal-event ${e.type==='class'?'cal-event-class':''}"
                 style="--accent-color:${e.color};${e.type!=='class'?'background:'+e.color:''}"
                 onclick="event.stopPropagation();calEventClick('${e.type}','${e.requestId||e.courseId||''}')"
                 title="${escapeHtml(e.title)}">${escapeHtml(e.title)}</div>
          `).join('')}
          ${overflow > 0 ? `<div class="cal-event-more">+${overflow} more</div>` : ''}
        </div>
      </div>
    `;
  }
  return `
    <div class="cal-month">
      <div class="cal-weekdays">
        ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-weekday">${d}</div>`).join('')}
      </div>
      <div class="cal-grid">${cells}</div>
    </div>
  `;
}

function renderWeek(from, to, events) {
  const todayStr = ymd(new Date());
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(from); d.setDate(from.getDate() + i); days.push(d); }
  const HOURS = []; for (let h = 7; h <= 21; h++) HOURS.push(h);
  const eventsByDay = {};
  events.forEach(e => { (eventsByDay[e.date] = eventsByDay[e.date] || []).push(e); });

  const headers = days.map(d => `
    <div class="cal-week-day-header">
      <div class="cal-week-day-name">${d.toLocaleDateString('en-US',{weekday:'short'})}</div>
      <div class="cal-week-day-num ${ymd(d) === todayStr ? 'today' : ''}">${d.getDate()}</div>
    </div>
  `).join('');

  const timeColCells = HOURS.map(h => `<div class="cal-week-time-cell">${h>12?h-12:h}${h>=12?'PM':'AM'}</div>`).join('');

  const dayCols = days.map(d => {
    const dayEvents = (eventsByDay[ymd(d)] || []);
    const hourCells = HOURS.map(() => `<div class="cal-week-hour"></div>`).join('');
    const eventEls = dayEvents.map(e => {
      let top, height;
      if (e.time) {
        const [h, m] = e.time.split(':').map(Number);
        const minutesFromStart = (h - 7) * 60 + (m || 0);
        top = (minutesFromStart / 60) * 56;
        height = ((e.duration || 60) / 60) * 56 - 2;
      } else {
        // All-day events at top
        top = 0;
        height = 24;
      }
      if (top < 0 || top > 56 * HOURS.length) return '';
      return `
        <div class="cal-week-event" style="top:${top}px;height:${height}px;background:${e.color}"
             onclick="calEventClick('${e.type}','${e.requestId||e.courseId||''}')"
             title="${escapeHtml(e.title)}">
          ${e.time ? `<div class="cal-week-event-time">${e.time}</div>` : ''}
          <div>${escapeHtml(e.title)}</div>
        </div>
      `;
    }).join('');
    return `
      <div class="cal-week-day-col">
        ${headers ? '' : ''}
        <div class="cal-week-grid" style="height:${HOURS.length * 56}px;position:relative">
          ${hourCells}
          ${eventEls}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="cal-week" style="grid-template-rows:auto 1fr">
      <div></div>${headers}
      <div class="cal-week-time-col">
        <div style="height:56px"></div>
        ${timeColCells}
      </div>
      ${dayCols}
    </div>
  `;
}

function calDayClick(dateStr) {
  if (state.role === 'student') {
    // Pre-fill new request with this date
    state.editingRequest = { date: dateStr };
    navigate('s-new');
  }
}
function calEventClick(type, id) {
  if (type === 'absence' && id) viewRequest(id);
}
window.calDayClick = calDayClick; window.calEventClick = calEventClick;

// ═══════════════════════════════════════════════════════════════════
// VIDEOS
// ═══════════════════════════════════════════════════════════════════
ROUTES['s-videos'] = function() { return renderVideos(); };
ROUTES['i-videos'] = function() { return renderVideos(); };

async function renderVideos() {
  const [{ videos }, { courses }] = await Promise.all([API.listVideos(), API.myCourses()]);
  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>Lecture videos</h2>
        <p>${videos.length} recording${videos.length !== 1 ? 's' : ''} across your courses</p>
      </div>
    </div>
    <div class="filter-bar">
      <select id="vidCourse" onchange="filterVideos()">
        <option value="">All courses</option>
        ${courses.map(c => `<option value="${c.course_id}">${escapeHtml(c.course_name)}</option>`).join('')}
      </select>
      <input type="text" id="vidSearch" placeholder="Search by title or topic…" oninput="filterVideos()">
    </div>
    <div id="videoGrid">${renderVideoGrid(videos)}</div>
  `;
  window._videos = videos;
}

function renderVideoGrid(videos) {
  if (!videos.length) {
    return `<div class="empty">
      <div class="empty-icon">${icon('video',24)}</div>
      <h3>No videos found</h3>
      <p>No lecture recordings match your filters.</p>
    </div>`;
  }
  return `<div class="video-grid">${videos.map(v => `
    <div class="video-card" onclick="playVideo(${v.video_id})">
      <div class="video-thumb" style="--thumb-color:${v.thumbnail_color || '#1A3E5C'};--thumb-color-2:${shadeColor(v.thumbnail_color || '#1A3E5C', -30)}">
        <div class="video-play">${icon('play',20)}</div>
        <div class="video-duration">${v.duration_min} min</div>
      </div>
      <div class="video-info">
        <div class="video-title">${escapeHtml(v.title)}</div>
        <div class="video-meta">
          <span class="video-course-pill" style="--course-color:${shadeColor(v.course_color||'#C5841F',60)};--course-text:${v.course_color||'#C5841F'}">${escapeHtml(v.course_name)}</span>
          <span>${fmtDate(v.lecture_date)}</span>
        </div>
      </div>
    </div>
  `).join('')}</div>`;
}

function shadeColor(hex, percent) {
  // percent: positive = lighter, negative = darker
  const f = parseInt(hex.slice(1), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const R = f >> 16, G = (f >> 8) & 0x00FF, B = f & 0x0000FF;
  return '#' + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
}

function filterVideos() {
  const cid = document.getElementById('vidCourse').value;
  const q = document.getElementById('vidSearch').value.toLowerCase();
  const filtered = (window._videos || []).filter(v => {
    if (cid && v.course_id !== cid) return false;
    if (q && !(v.title.toLowerCase().includes(q) || (v.topic||'').toLowerCase().includes(q) || (v.description||'').toLowerCase().includes(q))) return false;
    return true;
  });
  document.getElementById('videoGrid').innerHTML = renderVideoGrid(filtered);
}
window.filterVideos = filterVideos;

async function playVideo(id) {
  try {
    const { video } = await API.getVideo(id);
    let progress = 0;
    let playing = true;
    openModal(`
      <div class="modal-header">
        <div class="modal-title">${escapeHtml(video.title)}</div>
        <button class="icon-btn" onclick="closeModal({target:{id:'modalOverlay'}});window._stopVideo()">${ICONS.close.replace('<svg','<svg width="16" height="16"')}</button>
      </div>
      <div class="modal-body" style="padding:0">
        <div class="video-player" style="--thumb-color:${video.thumbnail_color || '#1A3E5C'};--thumb-color-2:${shadeColor(video.thumbnail_color || '#1A3E5C', -40)}">
          <div class="video-player-bg"></div>
          <div class="video-player-content">
            <div class="video-player-title">${escapeHtml(video.title)}</div>
            <div class="video-player-sub">${escapeHtml(video.course_name)} · ${fmtDate(video.lecture_date)} · ${video.duration_min} min · ${escapeHtml(video.topic || '')}</div>
            <div class="video-player-controls">
              <button class="video-player-btn" onclick="window._togglePlay()">${icon('play',24)}</button>
            </div>
          </div>
          <div class="video-player-progress"><div class="video-player-progress-fill" id="vidProgress"></div></div>
        </div>
        <div style="padding:18px 22px">
          <h4 style="font-family:var(--font-display);font-size:14px;margin-bottom:6px">About this lecture</h4>
          <p style="font-size:13.5px;color:var(--ink-700);line-height:1.55">${escapeHtml(video.description || 'No description provided.')}</p>
        </div>
      </div>
    `, 'lg');

    // Mock playback animation
    const totalSec = (video.duration_min || 50) * 60;
    let elapsed = 0;
    const tick = setInterval(() => {
      if (!playing) return;
      elapsed += totalSec / 100;  // complete in ~10 seconds for demo
      progress = Math.min(100, (elapsed / totalSec) * 100);
      const fill = document.getElementById('vidProgress');
      if (fill) fill.style.width = progress + '%';
      if (progress >= 100) clearInterval(tick);
    }, 100);
    window._stopVideo = () => clearInterval(tick);
    window._togglePlay = () => { playing = !playing; };
  } catch (err) { toast(err.message, 'error'); }
}
window.playVideo = playVideo;

// ═══════════════════════════════════════════════════════════════════
// STUDENT — Retake Scheduling
// ═══════════════════════════════════════════════════════════════════
ROUTES['s-retake'] = async function() {
  const { bookings } = await API.myBookings();

  // Split into upcoming vs past
  const now = new Date();
  const upcoming = bookings.filter(b => new Date(b.scheduled_datetime) >= now && (!b.status || b.status === 'Scheduled'))
    .sort((a, b) => new Date(a.scheduled_datetime) - new Date(b.scheduled_datetime));
  const past = bookings.filter(b => new Date(b.scheduled_datetime) < now || ['Completed','No-Show','Cancelled'].includes(b.status))
    .sort((a, b) => new Date(b.scheduled_datetime) - new Date(a.scheduled_datetime));

  function countdown(dt) {
    const diff = new Date(dt) - now;
    if (diff < 0) return '';
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hrs / 24);
    if (days > 1) return `in ${days} days`;
    if (days === 1) return 'tomorrow';
    if (hrs > 1) return `in ${hrs} hours`;
    if (hrs === 1) return 'in 1 hour';
    const mins = Math.max(1, Math.floor(diff / (1000 * 60)));
    return `in ${mins} min`;
  }

  function sessionIcon(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('exam') || t.includes('midterm') || t.includes('final') || t.includes('quiz')) return 'edit';
    if (t.includes('lab')) return 'settings';
    if (t.includes('office hour') || t.includes('review')) return 'chat';
    if (t.includes('presentation')) return 'video';
    return 'calendar';
  }

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>My scheduled retakes</h2>
        <p>${upcoming.length} upcoming session${upcoming.length !== 1 ? 's' : ''}${past.length ? ` · ${past.length} past` : ''}</p>
      </div>
      <div class="ph-actions">
        <button class="btn btn-ghost" onclick="navigate('s-reqs')">${icon('inbox',14)} My requests</button>
      </div>
    </div>

    ${bookings.length === 0 ? `
      <div class="empty">
        <div class="empty-icon">${icon('calendar',24)}</div>
        <h3>No scheduled retakes yet</h3>
        <p style="max-width:420px;margin:0 auto 14px">When your instructor approves an exam, lab, quiz, or similar absence, you'll be asked to propose makeup times from your My Requests page. Once the TA confirms a slot, it appears here.</p>
        <button class="btn btn-gold" onclick="navigate('s-new')">${icon('plus',14)} New request</button>
      </div>
    ` : `
      ${upcoming.length > 0 ? `
        <div style="margin-bottom:18px">
          <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-500);font-weight:600;margin-bottom:10px">Upcoming</h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">
            ${upcoming.map(b => {
              const dt = new Date(b.scheduled_datetime);
              const isToday = dt.toDateString() === now.toDateString();
              const sessionType = b.session_type || b.absence_type || 'Retake';
              return `
                <div class="card" style="padding:0;overflow:hidden;${isToday ? 'border-color:var(--gold-500);border-width:1.5px' : ''}">
                  <div style="padding:14px 16px;background:${isToday ? 'var(--gold-50)' : 'var(--paper-100)'};border-bottom:1px solid var(--paper-300);display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;gap:10px">
                      <div style="width:32px;height:32px;border-radius:var(--radius-sm);background:var(--navy-900);color:white;display:grid;place-items:center">${icon(sessionIcon(sessionType),16)}</div>
                      <div>
                        <div style="font-family:var(--font-display);font-weight:600;font-size:14px">${escapeHtml(sessionType)}</div>
                        <div style="font-size:11.5px;color:var(--ink-500)">${escapeHtml(b.course_id || '')} · ${escapeHtml(b.course_name || '')}</div>
                      </div>
                    </div>
                    ${isToday ? `<span class="badge badge-approved" style="background:var(--gold-500);color:white">Today</span>` : `<span style="font-size:11.5px;color:var(--ink-500);font-weight:500">${countdown(b.scheduled_datetime)}</span>`}
                  </div>
                  <div style="padding:14px 16px">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                      <span style="color:var(--ink-500);font-size:12px;width:48px">When</span>
                      <strong style="font-size:13.5px">${dt.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} at ${dt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</strong>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                      <span style="color:var(--ink-500);font-size:12px;width:48px">Where</span>
                      <strong style="font-size:13.5px">${escapeHtml(b.room || '—')}</strong>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                      <span style="color:var(--ink-500);font-size:12px;width:48px">Length</span>
                      <span style="font-size:13.5px">${b.duration} min${b.dss_applied ? ` <span style="color:var(--gold-700);font-size:11.5px">· DSS extension applied</span>` : ''}</span>
                    </div>
                    ${b.notes ? `
                      <div style="margin-top:10px;padding:8px 10px;background:var(--paper-100);border-radius:var(--radius-sm);font-size:12.5px;color:var(--ink-700);line-height:1.45">
                        <span style="color:var(--ink-500);text-transform:uppercase;font-size:10px;letter-spacing:0.06em;font-weight:600">Note from TA</span><br>${escapeHtml(b.notes)}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      ${past.length > 0 ? `
        <div>
          <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-500);font-weight:600;margin-bottom:10px">Past sessions</h4>
          <div class="table-wrap">
            <table class="tbl">
              <thead><tr>
                <th>When</th><th>Course</th><th>Type</th><th>Room</th><th>Status</th>
              </tr></thead>
              <tbody>${past.map(b => `
                <tr>
                  <td><strong>${fmtDate(b.scheduled_datetime)}</strong><div style="font-size:11.5px;color:var(--ink-500)">${new Date(b.scheduled_datetime).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</div></td>
                  <td>${escapeHtml(b.course_id || '')}<div style="font-size:11.5px;color:var(--ink-500)">${escapeHtml(b.course_name || '')}</div></td>
                  <td>${escapeHtml(b.session_type || b.absence_type || '—')}</td>
                  <td>${escapeHtml(b.room || '—')}</td>
                  <td>${statusBadge(b.status || 'Scheduled')}</td>
                </tr>
              `).join('')}</tbody>
            </table>
          </div>
        </div>
      ` : ''}
    `}
  `;
};

// ═══════════════════════════════════════════════════════════════════
// INSTRUCTOR — Dashboard
// ═══════════════════════════════════════════════════════════════════
ROUTES['i-dash'] = async function() {
  const [{ requests }, analytics, { tas } = { tas: [] }] = await Promise.all([
    API.listRequests(),
    API.getAnalytics().catch(() => null),
    API.myTAs().catch(() => ({ tas: [] }))
  ]);
  // Cache for use by other views (e.g. the reschedule decision text)
  state.myTAs = tas;

  const pending = requests.filter(r => r.status === 'Pending');
  const urgent  = requests.filter(r => r.priority === 'Urgent' && r.status === 'Pending');
  const today   = ymd(new Date());
  const todayDecisions = requests.filter(r => r.decisionAt && r.decisionAt.startsWith(today)).length;
  const avgHrs  = analytics?.totals?.avg_response_hours;

  // Group pending by student for "high-touch" callout
  const recentSubmissions = requests
    .filter(r => r.status === 'Pending')
    .sort((a, b) => new Date(b.submitted) - new Date(a.submitted))
    .slice(0, 6);

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${escapeHtml(state.user.name.split(' ').slice(-1)[0])}</h2>
        <p>${pending.length} pending request${pending.length !== 1 ? 's' : ''} need your attention</p>
      </div>
      <div class="ph-actions">
        <button class="btn btn-ghost" onclick="navigate('i-ana')">${icon('chart',14)} Analytics</button>
        <button class="btn btn-gold" onclick="navigate('i-inbox')">${icon('inbox',14)} Open inbox</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat" style="--accent-color:var(--orange-500)">
        <div class="stat-label">Pending review</div>
        <div class="stat-value">${pending.length}</div>
        <div class="stat-meta ${urgent.length ? 'down' : ''}">${urgent.length} urgent</div>
      </div>
      <div class="stat" style="--accent-color:var(--green-500)">
        <div class="stat-label">Decided today</div>
        <div class="stat-value">${todayDecisions}</div>
        <div class="stat-meta">${requests.filter(r => r.decisionAt).length} all-time</div>
      </div>
      <div class="stat" style="--accent-color:var(--gold-500)">
        <div class="stat-label">Avg response</div>
        <div class="stat-value">${avgHrs ? avgHrs.toFixed(1) + 'h' : '—'}</div>
        <div class="stat-meta ${avgHrs && avgHrs > 48 ? 'down' : 'up'}">target &lt; 48h</div>
      </div>
      <div class="stat" style="--accent-color:var(--blue-500)">
        <div class="stat-label">Total this term</div>
        <div class="stat-value">${requests.length}</div>
        <div class="stat-meta">across your courses</div>
      </div>
    </div>

    <div class="chart-grid">
      <div class="card chart-card">
        <div class="card-header">
          <div class="card-title">Submissions over time</div>
        </div>
        <div class="chart-canvas-wrap"><canvas id="iTrendChart"></canvas></div>
      </div>
      <div class="card chart-card">
        <div class="card-header">
          <div class="card-title">Recent submissions</div>
          <button class="link-btn" onclick="navigate('i-inbox')">Inbox →</button>
        </div>
        ${recentSubmissions.length === 0
          ? `<div style="padding:40px;text-align:center;color:var(--ink-500);font-size:13px">No pending requests right now.</div>`
          : `<div class="activity-feed">${recentSubmissions.map(r => `
              <div class="activity-item" onclick="reviewRequest('${r.id}')">
                <div class="activity-icon" style="background:var(--orange-50);color:var(--orange-600)">${icon('inbox',16)}</div>
                <div class="activity-content">
                  <div class="activity-title">${escapeHtml(r.studentName)} · ${escapeHtml(r.course)}</div>
                  <div class="activity-meta">${escapeHtml(r.category || 'Uncategorized')} · ${fmtDate(r.date)} · ${timeAgo(r.submitted)} ${priBadge(r.priority)}</div>
                </div>
                <button class="btn btn-sm btn-gold" onclick="event.stopPropagation();reviewRequest('${r.id}')">Review</button>
              </div>
            `).join('')}</div>`
        }
      </div>
    </div>

    ${urgent.length > 0 ? `
      <div class="card" style="margin-top:14px;border-color:var(--red-100);background:var(--red-50)">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;background:var(--red-500);color:white;border-radius:50%;display:grid;place-items:center;flex-shrink:0">${icon('alert',18)}</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px;color:var(--red-600)">You have ${urgent.length} urgent request${urgent.length>1?'s':''}</div>
            <div style="font-size:12.5px;color:var(--red-600)">Time-sensitive — please review first.</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="navigate('i-inbox')">Jump to urgent</button>
        </div>
      </div>
    ` : ''}

    <div class="card" style="margin-top:14px">
      <div class="card-header">
        <div class="card-title">${icon('users',16)} My teaching assistants</div>
        <span style="font-size:12px;color:var(--ink-500)">${tas.length} TA${tas.length !== 1 ? 's' : ''}</span>
      </div>
      ${tas.length === 0
        ? `<div style="padding:16px;font-size:13px;color:var(--ink-500);background:var(--paper-50);border-radius:var(--radius-sm);border:1px dashed var(--paper-300)">
            No TAs have registered under you yet. When a TA signs up and selects you as their supervisor, they'll appear here and receive your reschedule requests automatically.
          </div>`
        : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;padding:2px">
            ${tas.map(t => `
              <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--paper-50);border:1px solid var(--paper-200);border-radius:var(--radius-sm)">
                <div style="width:36px;height:36px;background:var(--gold-100);color:var(--gold-700);border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:13px;flex-shrink:0">
                  ${escapeHtml((t.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase())}
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(t.name)}</div>
                  <div style="font-size:11.5px;color:var(--ink-500);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(t.email)}</div>
                </div>
              </div>
            `).join('')}
          </div>`
      }
    </div>
  `;

  // Trend chart (last 8 weeks from analytics, or simple count)
  if (analytics && analytics.weeklyTrend && analytics.weeklyTrend.length) {
    const trend = [...analytics.weeklyTrend].reverse();
    state.charts.iTrend = new Chart(document.getElementById('iTrendChart'), {
      type: 'line',
      data: {
        labels: trend.map(t => t.week.replace(/^\d{4}-W/, 'W')),
        datasets: [{
          label: 'Requests',
          data: trend.map(t => t.count),
          borderColor: '#C5841F',
          backgroundColor: 'rgba(197, 132, 31, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: '#C5841F',
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { grid: { display: false } }
        },
        maintainAspectRatio: false,
      }
    });
  } else {
    document.getElementById('iTrendChart').parentElement.innerHTML = `<div style="display:grid;place-items:center;height:100%;color:var(--ink-500);font-size:13px">No trend data yet</div>`;
  }
};

// ═══════════════════════════════════════════════════════════════════
// INSTRUCTOR — Inbox + 6-option decision modal
// ═══════════════════════════════════════════════════════════════════
ROUTES['i-inbox'] = async function() {
  const { requests } = await API.listRequests();
  // Sort: urgent first, then pending, then everything else
  requests.sort((a, b) => {
    const order = { 'Urgent': 0, 'High': 1, 'Normal': 2, 'Low': 3 };
    if (a.status === 'Pending' && b.status !== 'Pending') return -1;
    if (a.status !== 'Pending' && b.status === 'Pending') return 1;
    return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
  });

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>Request inbox</h2>
        <p>${requests.filter(r => r.status === 'Pending').length} pending · ${requests.length} total</p>
      </div>
    </div>

    <div class="filter-bar">
      <select id="iFilter" onchange="filterInbox()">
        <option value="pending">Pending only</option>
        <option value="all">All requests</option>
        <option value="urgent">Urgent only</option>
        <option value="decided">Decided</option>
      </select>
      <input type="text" id="iSearch" placeholder="Search by student, course, ID…" oninput="filterInbox()">
    </div>

    <div class="table-wrap">
      <table class="tbl">
        <thead><tr>
          <th>Request</th><th>Student</th><th>Course</th>
          <th>Date</th><th>Category</th><th>Status</th><th>Submitted</th><th></th>
        </tr></thead>
        <tbody id="iBody">${renderInboxRows(requests.filter(r => r.status === 'Pending'))}</tbody>
      </table>
    </div>
  `;
  window._iReqs = requests;
};

function renderInboxRows(requests) {
  if (!requests.length) {
    return `<tr class="empty-row"><td colspan="8">
      <div style="padding:20px">
        <div style="margin:0 auto 10px;width:36px;height:36px;background:var(--green-50);color:var(--green-600);border-radius:50%;display:grid;place-items:center">${icon('check',18)}</div>
        <div style="font-weight:600">All caught up</div>
        <div style="font-size:12.5px;color:var(--ink-500);margin-top:2px">No requests match these filters.</div>
      </div>
    </td></tr>`;
  }
  return requests.map(r => `
    <tr class="clickable" onclick="reviewRequest('${r.id}')">
      <td><strong>${r.id}</strong></td>
      <td>${escapeHtml(r.studentName)}</td>
      <td>${escapeHtml(r.course)}</td>
      <td>${fmtDate(r.date)}</td>
      <td>${escapeHtml(r.category || '—')}</td>
      <td>${statusBadge(r.status)} ${priBadge(r.priority)}</td>
      <td>${timeAgo(r.submitted)}</td>
      <td onclick="event.stopPropagation()" style="text-align:right">
        ${r.status === 'Pending'
          ? `<button class="btn btn-sm btn-gold" onclick="reviewRequest('${r.id}')">Review</button>`
          : `<button class="btn btn-sm btn-ghost" onclick="reviewRequest('${r.id}')">View</button>`
        }
      </td>
    </tr>
  `).join('');
}

function filterInbox() {
  const mode = document.getElementById('iFilter').value;
  const q = document.getElementById('iSearch').value.toLowerCase();
  let list = (window._iReqs || []).slice();
  if (mode === 'pending') list = list.filter(r => r.status === 'Pending');
  else if (mode === 'urgent') list = list.filter(r => r.priority === 'Urgent');
  else if (mode === 'decided') list = list.filter(r => r.decisionAt);
  if (q) list = list.filter(r =>
    (r.studentName||'').toLowerCase().includes(q) ||
    (r.course||'').toLowerCase().includes(q) ||
    r.id.toLowerCase().includes(q) ||
    (r.reason||'').toLowerCase().includes(q)
  );
  document.getElementById('iBody').innerHTML = renderInboxRows(list);
}
window.filterInbox = filterInbox;

// Decision options metadata (for modal)
const DECISION_OPTS = [
  { id: 'Approved',                     label: 'Approve',            desc: 'Excuse is granted in full',                         d: 'approve' },
  { id: 'Approved - Needs Reschedule',  label: 'Approve + Reschedule', desc: 'Approve and send to TA + student to coordinate',  d: 'reschedule' },
  { id: 'Approved with Conditions',     label: 'Conditional',        desc: 'Approve with conditions',                          d: 'conditional' },
  { id: 'Partial Approval',             label: 'Partial',            desc: 'Excuse only some items',                           d: 'partial' },
  { id: 'More Info Requested',          label: 'Need info',          desc: 'Ask for documentation',                            d: 'info' },
  { id: 'Escalated',                    label: 'Escalate',           desc: 'Refer to administration',                          d: 'escalate' },
  { id: 'Denied',                       label: 'Deny',               desc: 'Excuse is not granted',                            d: 'deny' },
];

async function reviewRequest(id) {
  state.viewingRequestId = id;
  state.selectedDecision = null;
  state.pendingConditions = [];
  // Ensure TA names are cached so the Approve+Reschedule preview can list them
  if (state.role === 'instructor' && !state.myTAs) {
    try { const { tas } = await API.myTAs(); state.myTAs = tas; }
    catch { state.myTAs = []; }
  }
  try {
    const data = await API.getRequest(id);
    const r = data.request;
    const comments = data.comments || [];
    const isPending = r.status === 'Pending';

    openModal(`
      <div class="modal-header">
        <div class="modal-title">${r.id} · ${escapeHtml(r.studentName)} ${priBadge(r.priority)}</div>
        <button class="icon-btn" onclick="closeModal({target:{id:'modalOverlay'}})">${ICONS.close.replace('<svg','<svg width="16" height="16"')}</button>
      </div>
      <div class="modal-body">
        <div class="two-col">
          <div class="info-section">
            <h4>Request details</h4>
            <div class="info-row"><span class="label">Course</span><span class="val">${escapeHtml(r.course)} — ${escapeHtml(r.courseName || '')}</span></div>
            <div class="info-row"><span class="label">Absence date</span><span class="val">${fmtDate(r.date)}</span></div>
            <div class="info-row"><span class="label">Category</span><span class="val">${escapeHtml(r.category || '—')}</span></div>
            <div class="info-row"><span class="label">Status</span><span class="val">${statusBadge(r.status)}</span></div>
            <div class="info-row"><span class="label">Submitted</span><span class="val">${fmtDateTime(r.submitted)}</span></div>
            <div class="info-row"><span class="label">DSS profile</span><span class="val">${r.dss ? 'Yes' : 'No'}</span></div>
            ${r.decisionAt ? `<div class="info-row"><span class="label">Decided</span><span class="val">${fmtDateTime(r.decisionAt)}</span></div>` : ''}
            ${isPending ? `
              <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
                <span style="font-size:11px;color:var(--ink-500);text-transform:uppercase;letter-spacing:0.06em;font-weight:600;align-self:center">Set priority:</span>
                ${['Low','Normal','High','Urgent'].map(p => `
                  <button class="btn btn-sm ${p===r.priority?'btn-primary':'btn-ghost'}" onclick="setReqPriority('${r.id}','${p}')">${p}</button>
                `).join('')}
              </div>
            ` : ''}
          </div>
          <div class="info-section">
            <h4>Reason &amp; documentation</h4>
            <div class="info-block">${escapeHtml(r.reason)}</div>
            ${r.document ? `
              <h4 style="margin-top:14px">Attached document</h4>
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--paper-100);border-radius:var(--radius-sm);margin-top:4px">
                <div>
                  <div style="font-weight:600;font-size:13px">${escapeHtml(r.document.name)}</div>
                  <div style="font-size:11.5px;color:var(--ink-500)">${escapeHtml(r.document.type)} · ${r.document.sizeKb} KB</div>
                </div>
                <button class="btn btn-sm btn-ghost" onclick="downloadDoc('${r.id}','${escapeHtml(r.document.name)}')">${icon('download',12)} Download</button>
              </div>
            ` : ''}
            ${r.instructorComment ? `
              <h4 style="margin-top:14px">Decision note</h4>
              <div class="info-block">${escapeHtml(r.instructorComment)}</div>
            ` : ''}
            ${r.conditions && r.conditions.length ? `
              <h4 style="margin-top:14px">Conditions</h4>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
                ${r.conditions.map(c => `<span class="course-chip" style="background:var(--gold-50);color:var(--gold-700)">${escapeHtml(formatCondition(c))}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>

        ${isPending ? `
          <div style="margin-top:18px">
            <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-500);font-weight:600;margin-bottom:10px">Make a decision</h4>
            <div class="decision-grid">
              ${DECISION_OPTS.map(o => `
                <div class="decision-opt" data-d="${o.d}" data-id="${o.id}" onclick="selectDecision('${o.id}','${o.d}')">
                  <div class="decision-opt-label">${o.label}</div>
                  <div class="decision-opt-desc">${o.desc}</div>
                </div>
              `).join('')}
            </div>
            <div id="decisionExtras"></div>
          </div>
        ` : ''}

        ${state.role !== 'ta' && (data.documents || []).length > 0 ? `
        <div style="margin-top:18px">
          <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-500);font-weight:600;margin-bottom:10px">Supporting documents (${(data.documents || []).length})</h4>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${(data.documents || []).map(d => `
              <a href="/api/requests/${r.id}/document/${d.document_id}?token=${EFAuth.getToken()}"
                 target="_blank"
                 style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--paper-50);border:1px solid var(--gold-200);border-radius:var(--radius-sm);font-size:13px;color:var(--gold-700);font-weight:600;text-decoration:none;transition:background var(--dur-fast) var(--ease)"
                 onmouseover="this.style.background='var(--gold-50)'"
                 onmouseout="this.style.background='var(--paper-50)'">
                <span style="font-size:18px">📄</span>
                <div style="flex:1;min-width:0">
                  <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(d.file_name)}</div>
                  <div style="font-size:11px;color:var(--ink-500);font-weight:500">${escapeHtml(d.file_type)} · ${d.file_size_kb} KB · uploaded ${fmtDateTime(d.upload_timestamp_utc)}</div>
                </div>
                <span style="font-size:11px;color:var(--gold-700);text-transform:uppercase;letter-spacing:0.04em;font-weight:700">View</span>
              </a>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <div style="margin-top:18px">
          <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-500);font-weight:600;margin-bottom:10px">Discussion thread</h4>
          <div class="thread" id="threadContainer">${renderThread(comments)}</div>
          <div class="thread-compose">
            <textarea id="newComment" placeholder="Reply to the student or TA…"></textarea>
            <button class="btn btn-primary btn-sm" onclick="postComment('${r.id}')">Post</button>
          </div>
        </div>
      </div>
      ${isPending ? `
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal({target:{id:'modalOverlay'}})">Cancel</button>
          <button class="btn btn-gold" id="submitDecisionBtn" disabled onclick="submitDecision('${r.id}')">Submit decision</button>
        </div>
      ` : `
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeModal({target:{id:'modalOverlay'}})">Close</button>
        </div>
      `}
    `, 'lg');
  } catch (err) { toast(err.message, 'error'); }
}
window.reviewRequest = reviewRequest;

function selectDecision(id, d) {
  state.selectedDecision = id;
  document.querySelectorAll('.decision-opt').forEach(el => el.classList.remove('selected'));
  document.querySelector(`.decision-opt[data-id="${id}"]`)?.classList.add('selected');

  const extras = document.getElementById('decisionExtras');
  const requiresComment = ['Denied','More Info Requested','Partial Approval','Approved with Conditions','Escalated'].includes(id);
  const showConditions = id === 'Approved with Conditions';
  const showTARoute    = id === 'Approved - Needs Reschedule';

  let html = '';
  if (showTARoute) {
    const tas = state.myTAs || [];
    html += `
      <div style="margin-top:14px;padding:12px 14px;background:var(--gold-50);border:1px solid var(--gold-200);border-radius:var(--radius-sm)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:${tas.length ? '8px' : '0'}">
          <div style="width:28px;height:28px;background:var(--gold-500);color:white;border-radius:50%;display:grid;place-items:center;flex-shrink:0">${icon('users',14)}</div>
          <div style="flex:1;font-size:12.5px;line-height:1.4">
            <strong>Routing preview:</strong> ${tas.length === 0
              ? `<span style="color:var(--orange-600)">You have no TAs registered yet. The student will see this as "Awaiting Reschedule" and can propose times directly.</span>`
              : `This will notify <strong>${tas.length}</strong> teaching assistant${tas.length !== 1 ? 's' : ''} + the student at the same time:`}
          </div>
        </div>
        ${tas.length > 0 ? `
          <div style="display:flex;flex-wrap:wrap;gap:6px;padding-left:38px">
            ${tas.map(t => `
              <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:white;border:1px solid var(--gold-300);border-radius:14px;font-size:12px;font-weight:600;color:var(--gold-700)">
                ${icon('user',11)} ${escapeHtml(t.name)}
              </span>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
  if (showConditions) {
    state.pendingConditions = state.pendingConditions.length ? state.pendingConditions : [{ type: 'deadline_extension', days: 7 }];
    html += `
      <div class="conditions-builder">
        <h4>Conditions</h4>
        <div id="conditionRows">${renderConditionRows()}</div>
        <button class="add-cond" onclick="addCondition()">+ Add condition</button>
      </div>
    `;
  }
  if (requiresComment) {
    html += `
      <div class="field" style="margin-top:14px">
        <label>Comment ${requiresComment ? '*' : ''}</label>
        <textarea id="dComment" placeholder="${id === 'More Info Requested' ? 'What additional info do you need?' : id === 'Denied' ? 'Reason for denial' : 'Explain your decision'}" oninput="updateDecisionBtn()"></textarea>
      </div>
    `;
  } else {
    html += `
      <div class="field" style="margin-top:14px">
        <label>Comment (optional)</label>
        <textarea id="dComment" placeholder="Add an optional note for the student"></textarea>
      </div>
    `;
  }
  extras.innerHTML = html;
  updateDecisionBtn();
}
window.selectDecision = selectDecision;

function renderConditionRows() {
  return state.pendingConditions.map((c, i) => `
    <div class="condition-row">
      <select onchange="updateCondType(${i}, this.value)">
        <option value="deadline_extension"  ${c.type==='deadline_extension'?'selected':''}>Deadline extension</option>
        <option value="makeup_required"     ${c.type==='makeup_required'?'selected':''}>Make-up required</option>
        <option value="partial_excuse"      ${c.type==='partial_excuse'?'selected':''}>Partial excuse</option>
        <option value="late_penalty_waived" ${c.type==='late_penalty_waived'?'selected':''}>Late penalty waived</option>
      </select>
      <input type="text" placeholder="${condDetailPlaceholder(c.type)}" value="${escapeHtml(condDetailValue(c))}" oninput="updateCondDetail(${i}, this.value)">
      <button class="btn btn-sm btn-ghost" onclick="removeCondition(${i})">${icon('trash',12)}</button>
    </div>
  `).join('');
}
function condDetailPlaceholder(type) {
  return ({
    deadline_extension: '7 (days)',
    makeup_required:    'e.g. Quiz 4 by Oct 15',
    partial_excuse:     'e.g. exempt midterm only',
    late_penalty_waived: 'e.g. for HW 5'
  })[type] || '';
}
function condDetailValue(c) {
  if (c.type === 'deadline_extension') return c.days || '';
  if (c.type === 'makeup_required')    return c.item || '';
  if (c.type === 'partial_excuse')     return c.scope || '';
  return c.detail || '';
}
function updateCondType(i, t) { state.pendingConditions[i] = { type: t }; document.getElementById('conditionRows').innerHTML = renderConditionRows(); }
function updateCondDetail(i, v) {
  const t = state.pendingConditions[i].type;
  if (t === 'deadline_extension') state.pendingConditions[i].days = parseInt(v) || 0;
  else if (t === 'makeup_required') state.pendingConditions[i].item = v;
  else if (t === 'partial_excuse')  state.pendingConditions[i].scope = v;
  else state.pendingConditions[i].detail = v;
}
function addCondition() { state.pendingConditions.push({ type: 'deadline_extension', days: 7 }); document.getElementById('conditionRows').innerHTML = renderConditionRows(); }
function removeCondition(i) { state.pendingConditions.splice(i, 1); document.getElementById('conditionRows').innerHTML = renderConditionRows(); }
window.updateCondType = updateCondType;
window.updateCondDetail = updateCondDetail;
window.addCondition = addCondition;
window.removeCondition = removeCondition;

function updateDecisionBtn() {
  const btn = document.getElementById('submitDecisionBtn');
  if (!btn) return;
  const id = state.selectedDecision;
  const requiresComment = ['Denied','More Info Requested','Partial Approval','Approved with Conditions','Escalated'].includes(id);
  const comment = document.getElementById('dComment')?.value.trim();
  btn.disabled = !id || (requiresComment && !comment);
}
window.updateDecisionBtn = updateDecisionBtn;

async function submitDecision(reqId) {
  const decision = state.selectedDecision;
  if (!decision) return;
  const comment = document.getElementById('dComment')?.value.trim() || '';
  const conditions = decision === 'Approved with Conditions' ? state.pendingConditions : null;
  try {
    await API.decideRequest(reqId, decision, comment, conditions);
    closeModal({ target: { id: 'modalOverlay' } });
    toast(`Decision saved: ${decision}`, 'success');
    state.selectedDecision = null; state.pendingConditions = [];
    if (state.page === 'i-inbox' || state.page === 'i-dash') navigate(state.page);
  } catch (err) { toast(err.message, 'error'); }
}
window.submitDecision = submitDecision;

async function setReqPriority(reqId, p) {
  try {
    await API.setPriority(reqId, p);
    toast(`Priority set to ${p}`, 'success');
    reviewRequest(reqId);  // re-open to refresh
  } catch (err) { toast(err.message, 'error'); }
}
window.setReqPriority = setReqPriority;

// ═══════════════════════════════════════════════════════════════════
// INSTRUCTOR — Analytics
// ═══════════════════════════════════════════════════════════════════
ROUTES['i-ana'] = async function() {
  const a = await API.getAnalytics();

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>Analytics</h2>
        <p>Insights across your courses · ${a.totals.total} total requests</p>
      </div>
      <div class="ph-actions">
        <button class="btn btn-ghost" onclick="exportData('analytics','csv')">${icon('download',14)} Export CSV</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat" style="--accent-color:var(--gold-500)">
        <div class="stat-label">Total requests</div>
        <div class="stat-value">${a.totals.total || 0}</div>
        <div class="stat-meta">${a.byDepartment?.length || 0} department${(a.byDepartment?.length||0) !== 1 ? 's' : ''}</div>
      </div>
      <div class="stat" style="--accent-color:var(--green-500)">
        <div class="stat-label">Approval rate</div>
        <div class="stat-value">${a.totals.total ? Math.round((a.totals.approved / a.totals.total) * 100) + '%' : '—'}</div>
        <div class="stat-meta">${a.totals.approved || 0} approved</div>
      </div>
      <div class="stat" style="--accent-color:var(--blue-500)">
        <div class="stat-label">Avg response</div>
        <div class="stat-value">${a.totals.avg_response_hours ? a.totals.avg_response_hours.toFixed(1) + 'h' : '—'}</div>
        <div class="stat-meta ${a.totals.avg_response_hours > 48 ? 'down' : 'up'}">target &lt; 48h</div>
      </div>
      <div class="stat" style="--accent-color:var(--red-500)">
        <div class="stat-label">High-risk students</div>
        <div class="stat-value">${a.highRiskCount || 0}</div>
        <div class="stat-meta">&gt;3 requests this term</div>
      </div>
    </div>

    <div class="chart-grid">
      <div class="card chart-card">
        <div class="card-header"><div class="card-title">Status breakdown</div></div>
        <div class="chart-canvas-wrap"><canvas id="aStatus"></canvas></div>
      </div>
      <div class="card chart-card">
        <div class="card-header"><div class="card-title">Category breakdown</div></div>
        <div class="chart-canvas-wrap"><canvas id="aCategory"></canvas></div>
      </div>
    </div>

    <div class="chart-grid">
      <div class="card chart-card">
        <div class="card-header"><div class="card-title">Weekly submission trend</div></div>
        <div class="chart-canvas-wrap"><canvas id="aTrend"></canvas></div>
      </div>
      <div class="card chart-card">
        <div class="card-header"><div class="card-title">By department</div></div>
        <div class="chart-canvas-wrap"><canvas id="aDept"></canvas></div>
      </div>
    </div>
  `;

  // Charts
  if (a.byStatus?.length) {
    state.charts.aStatus = new Chart(document.getElementById('aStatus'), {
      type: 'doughnut',
      data: {
        labels: a.byStatus.map(s => s.status),
        datasets: [{
          data: a.byStatus.map(s => s.count),
          backgroundColor: ['#27AE60','#E67E22','#E74C3C','#F39C12','#2980B9','#8E44AD','#95A5A6','#D35400'],
          borderWidth: 0
        }]
      },
      options: {
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 11.5 } } } },
        cutout: '65%',
        maintainAspectRatio: false
      }
    });
  } else { document.getElementById('aStatus').parentElement.innerHTML = emptyChartHtml(); }

  if (a.byCategory?.length) {
    state.charts.aCategory = new Chart(document.getElementById('aCategory'), {
      type: 'bar',
      data: {
        labels: a.byCategory.map(c => c.category),
        datasets: [{
          data: a.byCategory.map(c => c.count),
          backgroundColor: '#C5841F',
          borderRadius: 4,
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        maintainAspectRatio: false
      }
    });
  } else { document.getElementById('aCategory').parentElement.innerHTML = emptyChartHtml(); }

  if (a.weeklyTrend?.length) {
    const trend = [...a.weeklyTrend].reverse();
    state.charts.aTrend = new Chart(document.getElementById('aTrend'), {
      type: 'line',
      data: {
        labels: trend.map(t => t.week.replace(/^\d{4}-W/, 'W')),
        datasets: [{
          label: 'Requests',
          data: trend.map(t => t.count),
          borderColor: '#0F1B2D',
          backgroundColor: 'rgba(15, 27, 45, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: '#C5841F',
          pointRadius: 4
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        maintainAspectRatio: false
      }
    });
  } else { document.getElementById('aTrend').parentElement.innerHTML = emptyChartHtml(); }

  if (a.byDepartment?.length) {
    state.charts.aDept = new Chart(document.getElementById('aDept'), {
      type: 'bar',
      data: {
        labels: a.byDepartment.map(d => d.dept),
        datasets: [
          { label: 'Approved', data: a.byDepartment.map(d => d.approved), backgroundColor: '#27AE60', borderRadius: 3 },
          { label: 'Denied',   data: a.byDepartment.map(d => d.denied),   backgroundColor: '#E74C3C', borderRadius: 3 },
          { label: 'Pending',  data: a.byDepartment.map(d => d.pending),  backgroundColor: '#E67E22', borderRadius: 3 },
        ]
      },
      options: {
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
        maintainAspectRatio: false
      }
    });
  } else { document.getElementById('aDept').parentElement.innerHTML = emptyChartHtml(); }
};

function emptyChartHtml() {
  return `<div style="display:grid;place-items:center;height:240px;color:var(--ink-500);font-size:13px">No data yet — analytics populate as requests come in.</div>`;
}

async function exportData(scope, format) {
  try {
    await API.exportData(scope, format);
    toast(`${scope} export logged in audit trail (${format.toUpperCase()})`, 'success');
  } catch (err) { toast(err.message, 'error'); }
}
window.exportData = exportData;

// ═══════════════════════════════════════════════════════════════════
// INSTRUCTOR — Retake Configuration
// ═══════════════════════════════════════════════════════════════════
ROUTES['i-retcfg'] = async function() {
  const [{ configs }, { courses }] = await Promise.all([
    API.listRetakeConfigs(),
    API.listCourses()
  ]);

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>Retake configuration</h2>
        <p>Define windows where students can self-book make-up assessments</p>
      </div>
      <div class="ph-actions">
        <button class="btn btn-gold" onclick="openRetakeConfigModal()">${icon('plus',14)} Add window</button>
      </div>
    </div>

    ${configs.length === 0
      ? `<div class="empty">
          <div class="empty-icon">${icon('clock',24)}</div>
          <h3>No retake windows configured</h3>
          <p>Create a window so approved students can self-book a make-up assessment.</p>
          <button class="btn btn-gold" onclick="openRetakeConfigModal()">${icon('plus',14)} Add your first window</button>
        </div>`
      : `<div class="table-wrap">
          <table class="tbl">
            <thead><tr>
              <th>Course</th><th>Assessment</th><th>Window</th>
              <th>Slots</th><th>Capacity</th><th></th>
            </tr></thead>
            <tbody>${configs.map(c => `
              <tr>
                <td><strong>${escapeHtml(c.course_id)}</strong><div style="font-size:12px;color:var(--ink-500)">${escapeHtml(c.course_name)}</div></td>
                <td>${escapeHtml(c.assessment_type)}</td>
                <td>${fmtDate(c.window_start)} → ${fmtDate(c.window_end)}</td>
                <td>${c.available_slots}</td>
                <td>${c.max_capacity}</td>
                <td style="text-align:right">
                  <button class="btn btn-sm btn-danger" onclick="deleteRetakeCfg(${c.config_id})">${icon('trash',12)}</button>
                </td>
              </tr>
            `).join('')}</tbody>
          </table>
        </div>`
    }
  `;
  window._retCourses = courses;
};

function openRetakeConfigModal() {
  const courses = window._retCourses || [];
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${icon('plus')} New retake window</div>
      <button class="icon-btn" onclick="closeModal({target:{id:'modalOverlay'}})">${ICONS.close.replace('<svg','<svg width="16" height="16"')}</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label>Course *</label>
          <select id="rcCourse">${courses.map(c => `<option value="${c.course_id}">${escapeHtml(c.course_id)} — ${escapeHtml(c.course_name)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Assessment type *</label>
          <select id="rcType">
            <option>Midterm</option><option>Final</option><option>Quiz</option>
            <option>Lab Practical</option><option>Presentation</option>
          </select>
        </div>
        <div class="field"><label>Window start *</label><input type="date" id="rcStart"></div>
        <div class="field"><label>Window end *</label><input type="date" id="rcEnd"></div>
        <div class="field"><label>Available slots</label><input type="number" id="rcSlots" value="3" min="1"></div>
        <div class="field"><label>Max capacity</label><input type="number" id="rcCap" value="5" min="1"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal({target:{id:'modalOverlay'}})">Cancel</button>
      <button class="btn btn-gold" onclick="submitRetakeCfg()">Create window</button>
    </div>
  `);
}
window.openRetakeConfigModal = openRetakeConfigModal;

async function submitRetakeCfg() {
  const courseId = document.getElementById('rcCourse').value;
  const assessmentType = document.getElementById('rcType').value;
  const windowStart = document.getElementById('rcStart').value;
  const windowEnd = document.getElementById('rcEnd').value;
  const availableSlots = document.getElementById('rcSlots').value;
  const maxCapacity = document.getElementById('rcCap').value;
  if (!courseId || !windowStart || !windowEnd) { toast('Required fields missing', 'error'); return; }
  try {
    await API.createRetakeConfig({ courseId, assessmentType, windowStart, windowEnd, availableSlots, maxCapacity });
    closeModal({ target: { id: 'modalOverlay' } });
    toast('Retake window created', 'success');
    navigate('i-retcfg');
  } catch (err) { toast(err.message, 'error'); }
}
window.submitRetakeCfg = submitRetakeCfg;

async function deleteRetakeCfg(id) {
  const ok = await confirmDialog('Delete this window?', 'Students will no longer be able to book under this configuration.', 'Delete', true);
  if (!ok) return;
  try {
    await API.deleteRetakeConfig(id);
    toast('Retake window deleted', 'success');
    navigate('i-retcfg');
  } catch (err) { toast(err.message, 'error'); }
}
window.deleteRetakeCfg = deleteRetakeCfg;

// ═══════════════════════════════════════════════════════════════════
// TA — Logistics Queue
// ═══════════════════════════════════════════════════════════════════
ROUTES['t-queue'] = async function() {
  const [{ queue }, { configs }] = await Promise.all([API.taQueue(), API.listRetakeConfigs()]);
  const scheduled = queue.filter(q => q.scheduled_datetime);
  const unscheduled = queue.filter(q => !q.scheduled_datetime);
  window._retakeConfigs = configs;

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>Logistics queue</h2>
        <p>${queue.length} approved request${queue.length !== 1 ? 's' : ''} · ${scheduled.length} booked · ${unscheduled.length} awaiting booking</p>
      </div>
    </div>

    ${queue.length === 0
      ? `<div class="empty">
          <div class="empty-icon">${icon('inbox',24)}</div>
          <h3>Queue is empty</h3>
          <p>No approved requests are awaiting logistics work right now.</p>
        </div>`
      : `<div class="table-wrap">
          <table class="tbl">
            <thead><tr>
              <th>Request</th><th>Student</th><th>Course</th>
              <th>Absence</th><th>Booking</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>${queue.map(q => {
              const needsTAAction = ['Awaiting TA Confirmation','Awaiting Reschedule'].includes(q.status);
              const waitingOnStudent = q.status === 'Awaiting Student Approval';
              const rowStyle = needsTAAction ? 'style="background:var(--gold-50)"' : (waitingOnStudent ? 'style="background:var(--paper-100)"' : '');
              return `
              <tr ${rowStyle}>
                <td><strong>${q.request_id}</strong> ${priBadge(q.priority)}</td>
                <td>${escapeHtml(q.student_name)}</td>
                <td>${escapeHtml(q.course_id)}<div style="font-size:11.5px;color:var(--ink-500)">${escapeHtml(q.course_name)}</div></td>
                <td>${fmtDate(q.absence_date)}<div style="font-size:11.5px;color:var(--ink-500)">${escapeHtml(q.absence_type || q.category || '')}</div></td>
                <td>${q.scheduled_datetime
                    ? `${fmtDateTime(q.scheduled_datetime)}<div style="font-size:11.5px;color:var(--ink-500)">${escapeHtml(q.room || '')}</div>`
                    : needsTAAction
                      ? `<span style="color:var(--gold-700);font-weight:600;font-size:12px">Needs your action</span>`
                      : waitingOnStudent
                        ? `<span style="color:var(--ink-500);font-size:12px">Awaiting student</span>`
                        : `<span style="color:var(--ink-500);font-style:italic">Not booked</span>`}
                </td>
                <td>${statusBadge(q.booking_status || q.status)}</td>
                <td style="text-align:right">
                  ${needsTAAction
                    ? `<button class="btn btn-sm btn-gold" onclick="viewRequest('${q.request_id}')">${icon('check',12)} Coordinate</button>`
                    : waitingOnStudent
                      ? `<button class="btn btn-sm btn-ghost" onclick="viewRequest('${q.request_id}')">View</button>`
                      : q.scheduled_datetime
                        ? `<button class="btn btn-sm btn-ghost" onclick="navigate('t-sched')">View</button>`
                        : `<button class="btn btn-sm btn-gold" onclick="openBookForModal('${q.request_id}','${escapeHtml(q.student_name)}','${escapeHtml(q.course_id)}','${escapeHtml(q.course_name)}')">${icon('plus',12)} Book</button>`
                  }
                </td>
              </tr>
              `;
            }).join('')}</tbody>
          </table>
        </div>`
    }
  `;
};

function openBookForModal(requestId, studentName, courseId, courseName) {
  const configs = (window._retakeConfigs || []).filter(c => c.course_id === courseId);
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${icon('calendar')} Book session for ${escapeHtml(studentName)}</div>
      <button class="icon-btn" onclick="closeModal({target:{id:'modalOverlay'}})">${ICONS.close.replace('<svg','<svg width="16" height="16"')}</button>
    </div>
    <div class="modal-body">
      <div style="background:var(--paper-100);padding:10px 14px;border-radius:var(--radius-sm);margin-bottom:14px;font-size:13px">
        <div><strong>Request:</strong> ${requestId}</div>
        <div><strong>Course:</strong> ${escapeHtml(courseId)} — ${escapeHtml(courseName)}</div>
      </div>

      <div class="form-grid">
        <div class="field">
          <label>Session type *</label>
          <select id="bfType">
            ${['Exam','Quiz','Midterm Retake','Final Retake','Lab','Office Hours','Makeup Assignment','Review Session','Presentation','Other']
              .map(t => `<option>${t}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Retake window <span style="text-transform:none;font-weight:400;color:var(--ink-500);letter-spacing:0">(optional)</span></label>
          <select id="bfCfg">
            <option value="">— None (ad-hoc booking) —</option>
            ${configs.map(c => `<option value="${c.config_id}">${escapeHtml(c.assessment_type)} · ${c.window_start} → ${c.window_end}</option>`).join('')}
          </select>
          <p style="font-size:11.5px;color:var(--ink-500);margin-top:4px">Leave empty for ad-hoc bookings — office hours, makeup sessions, anything.</p>
        </div>
      </div>

      <div class="form-grid">
        <div class="field"><label>Date &amp; time *</label><input type="datetime-local" id="bfDT"></div>
        <div class="field"><label>Room / Location *</label><input type="text" id="bfRoom" placeholder="e.g. Room 214 or Zoom"></div>
      </div>
      <div class="field"><label>Duration (min)</label><input type="number" id="bfDur" value="60" min="15"></div>

      <div class="field">
        <label>Notes <span style="text-transform:none;font-weight:400;color:var(--ink-500);letter-spacing:0">(optional)</span></label>
        <textarea id="bfNotes" placeholder="Anything the student should know — what to bring, prep materials, access info, etc." style="min-height:70px"></textarea>
      </div>

      <p style="font-size:12px;color:var(--ink-500);margin-top:4px">DSS accommodations are applied automatically if the student has them on file.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal({target:{id:'modalOverlay'}})">Cancel</button>
      <button class="btn btn-gold" onclick="submitBookFor('${requestId}')">Book session</button>
    </div>
  `);
}
window.openBookForModal = openBookForModal;

async function submitBookFor(requestId) {
  const configId = document.getElementById('bfCfg')?.value || null;
  const sessionType = document.getElementById('bfType').value;
  const dt = document.getElementById('bfDT').value;
  const room = document.getElementById('bfRoom').value.trim();
  const duration = document.getElementById('bfDur').value;
  const notes = document.getElementById('bfNotes').value.trim();
  if (!dt || !room) { toast('Date/time and room are required', 'error'); return; }
  try {
    const result = await API.taBookFor({
      requestId, configId,
      scheduledDatetime: dt.replace('T', ' ') + ':00',
      room, duration, sessionType, notes
    });
    closeModal({ target: { id: 'modalOverlay' } });
    toast(`${sessionType} booked${result.dssApplied ? ' with DSS extension' : ''}`, 'success');
    navigate('t-queue');
  } catch (err) { toast(err.message, 'error'); }
}
window.submitBookFor = submitBookFor;

// ═══════════════════════════════════════════════════════════════════
// TA — Scheduling (calendar of upcoming bookings)
// ═══════════════════════════════════════════════════════════════════
ROUTES['t-sched'] = async function() {
  const { queue } = await API.taQueue();
  const upcoming = queue.filter(q => q.scheduled_datetime).sort((a, b) =>
    new Date(a.scheduled_datetime) - new Date(b.scheduled_datetime)
  );

  // Group by date
  const groups = {};
  upcoming.forEach(b => {
    const d = b.scheduled_datetime.slice(0, 10);
    (groups[d] = groups[d] || []).push(b);
  });

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>Scheduling</h2>
        <p>${upcoming.length} booked retake${upcoming.length !== 1 ? 's' : ''} upcoming</p>
      </div>
    </div>

    ${upcoming.length === 0
      ? `<div class="empty">
          <div class="empty-icon">${icon('calendar',24)}</div>
          <h3>Nothing scheduled yet</h3>
          <p>Students will appear here once they book their make-up assessments.</p>
        </div>`
      : Object.keys(groups).sort().map(date => {
          const items = groups[date];
          const d = new Date(date);
          return `
            <div class="card" style="margin-bottom:12px;padding:0;overflow:hidden">
              <div style="padding:12px 18px;background:var(--paper-200);border-bottom:1px solid var(--paper-300);display:flex;align-items:center;justify-content:space-between">
                <div style="font-family:var(--font-display);font-weight:600;font-size:15px">${d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
                <div style="font-size:12px;color:var(--ink-500)">${items.length} session${items.length>1?'s':''}</div>
              </div>
              <table class="tbl" style="border:none">
                <tbody>${items.map(b => `
                  <tr>
                    <td style="width:90px"><strong>${new Date(b.scheduled_datetime).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</strong></td>
                    <td>${escapeHtml(b.student_name)}</td>
                    <td>${escapeHtml(b.course_id)}</td>
                    <td>${escapeHtml(b.room || '—')}</td>
                    <td>${statusBadge(b.booking_status || 'Scheduled')}</td>
                    <td style="text-align:right;white-space:nowrap">
                      <button class="btn btn-sm btn-ghost" onclick="openRescheduleModal(${b.booking_id || 0},'${escapeHtml(b.student_name)}','${b.scheduled_datetime}','${escapeHtml(b.room || '')}',${b.duration || 60})">${icon('edit',12)} Reschedule</button>
                      <button class="btn btn-sm btn-danger" onclick="cancelBooking(${b.booking_id || 0},'${escapeHtml(b.student_name)}')">Cancel</button>
                    </td>
                  </tr>
                `).join('')}</tbody>
              </table>
            </div>
          `;
        }).join('')
    }
  `;
};

// ═══════════════════════════════════════════════════════════════════
// TA — Proctoring (mark attendance)
// ═══════════════════════════════════════════════════════════════════
ROUTES['t-proc'] = async function() {
  const { queue } = await API.taQueue();
  const todayStr = ymd(new Date());
  // Show ALL sessions that are still 'Scheduled' (not Completed/No-Show/Cancelled),
  // regardless of date. That way the TA always has something to work with.
  const sessions = queue
    .filter(q => q.scheduled_datetime && (!q.booking_status || q.booking_status === 'Scheduled'))
    .sort((a, b) => new Date(a.scheduled_datetime) - new Date(b.scheduled_datetime));

  function dayLabel(dateStr) {
    if (dateStr === todayStr) return 'Today';
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateStr === ymd(tomorrow)) return 'Tomorrow';
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === ymd(yesterday)) return 'Yesterday';
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>Proctoring</h2>
        <p>Mark attendance for all scheduled retake sessions</p>
      </div>
    </div>

    ${sessions.length === 0
      ? `<div class="empty">
          <div class="empty-icon">${icon('check',24)}</div>
          <h3>No scheduled sessions</h3>
          <p>Nothing to proctor right now. Students may need to propose makeup times — check the Logistics Queue.</p>
          <button class="btn btn-ghost" onclick="navigate('t-queue')">${icon('inbox',14)} Go to queue</button>
        </div>`
      : `<div class="table-wrap">
          <table class="tbl">
            <thead><tr>
              <th>When</th><th>Student</th><th>Course</th>
              <th>Room</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>${sessions.map(b => {
              const dt = new Date(b.scheduled_datetime);
              const dateStr = b.scheduled_datetime.slice(0, 10);
              return `
                <tr>
                  <td><strong>${dt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</strong>
                    <div style="font-size:11.5px;color:var(--ink-500)">${dayLabel(dateStr)}</div></td>
                  <td>${escapeHtml(b.student_name)}</td>
                  <td>${escapeHtml(b.course_id)}<div style="font-size:11.5px;color:var(--ink-500)">${escapeHtml(b.course_name)}</div></td>
                  <td>${escapeHtml(b.room || '—')}</td>
                  <td>${statusBadge(b.booking_status || 'Scheduled')}</td>
                  <td>
                    <div style="display:flex;gap:4px;flex-wrap:wrap">
                      <button class="btn btn-sm btn-success" onclick="markAttendance(${b.booking_id || 0},'Completed','${escapeHtml(b.student_name)}')">Present</button>
                      <button class="btn btn-sm btn-danger" onclick="markAttendance(${b.booking_id || 0},'No-Show','${escapeHtml(b.student_name)}')">No-show</button>
                      <button class="btn btn-sm btn-ghost" onclick="markAttendance(${b.booking_id || 0},'Cancelled','${escapeHtml(b.student_name)}')">Cancel</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}</tbody>
          </table>
        </div>`
    }
  `;
};

async function markAttendance(bookingId, status, studentName) {
  if (!bookingId) { toast('No booking ID available — student may not have a confirmed booking yet', 'error'); return; }
  try {
    await API.taAttendance(bookingId, status);
    toast(`${studentName}: ${status}`, status === 'Completed' ? 'success' : status === 'No-Show' ? 'error' : 'info');
    navigate('t-proc');
  } catch (err) { toast(err.message, 'error'); }
}
window.markAttendance = markAttendance;

// Reschedule modal + cancel booking (TA)
function openRescheduleModal(bookingId, studentName, currentDT, currentRoom, currentDur) {
  if (!bookingId) { toast('This booking has no ID — cannot reschedule', 'error'); return; }
  // Convert current SQL datetime to datetime-local format
  const dtVal = currentDT ? currentDT.replace(' ', 'T').slice(0, 16) : '';
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${icon('edit')} Reschedule for ${escapeHtml(studentName)}</div>
      <button class="icon-btn" onclick="closeModal({target:{id:'modalOverlay'}})">${ICONS.close.replace('<svg','<svg width="16" height="16"')}</button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="field"><label>New date &amp; time *</label><input type="datetime-local" id="rsDT" value="${dtVal}"></div>
        <div class="field"><label>New room *</label><input type="text" id="rsRoom" value="${escapeHtml(currentRoom)}" placeholder="e.g. Room 214"></div>
      </div>
      <div class="field"><label>Duration (min)</label><input type="number" id="rsDur" value="${currentDur || 60}" min="15"></div>
      <p style="font-size:12px;color:var(--ink-500)">The student will be automatically notified of the change.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal({target:{id:'modalOverlay'}})">Cancel</button>
      <button class="btn btn-gold" onclick="submitReschedule(${bookingId})">Update booking</button>
    </div>
  `, 'sm');
}
window.openRescheduleModal = openRescheduleModal;

async function submitReschedule(bookingId) {
  const dt = document.getElementById('rsDT').value;
  const room = document.getElementById('rsRoom').value.trim();
  const duration = document.getElementById('rsDur').value;
  if (!dt || !room) { toast('Date/time and room are required', 'error'); return; }
  try {
    await API.taReschedule({
      bookingId,
      scheduledDatetime: dt.replace('T', ' ') + ':00',
      room, duration
    });
    closeModal({ target: { id: 'modalOverlay' } });
    toast('Booking rescheduled — student notified', 'success');
    navigate('t-sched');
  } catch (err) { toast(err.message, 'error'); }
}
window.submitReschedule = submitReschedule;

async function cancelBooking(bookingId, studentName) {
  if (!bookingId) { toast('No booking ID available', 'error'); return; }
  const ok = await confirmDialog(`Cancel booking for ${studentName}?`, 'The session will be marked as Cancelled. You can rebook later if needed.', 'Cancel booking', true);
  if (!ok) return;
  try {
    await API.taAttendance(bookingId, 'Cancelled');
    toast('Booking cancelled', 'info');
    navigate('t-sched');
  } catch (err) { toast(err.message, 'error'); }
}
window.cancelBooking = cancelBooking;

// ═══════════════════════════════════════════════════════════════════
// TA — Communication Log
// ═══════════════════════════════════════════════════════════════════
ROUTES['t-log'] = async function() {
  const { messages } = await API.taMessages();

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>Communication log</h2>
        <p>Messages between TAs and instructors · ${messages.length} entries</p>
      </div>
    </div>

    <div class="form-grid" style="grid-template-columns:1fr 1.2fr;gap:14px">
      <div class="card">
        <div class="card-header"><div class="card-title">Send a message</div></div>
        <div class="field"><label>Recipient</label>
          <input type="text" id="msgTo" placeholder="e.g. Prof. Dasgupta">
        </div>
        <div class="field"><label>Message</label>
          <textarea id="msgBody" placeholder="Write a logistics update or question…" style="min-height:100px"></textarea>
        </div>
        <div class="checkbox-row" style="margin-bottom:12px">
          <input type="checkbox" id="msgEsc">
          <label for="msgEsc">Mark as escalation (urgent attention required)</label>
        </div>
        <button class="btn btn-gold btn-full" onclick="sendTAMessage()">${icon('chat',14)} Send message</button>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">Recent messages</div></div>
        <div style="max-height:560px;overflow-y:auto">
        ${messages.length === 0
          ? `<div style="padding:32px;text-align:center;color:var(--ink-500);font-size:13px">No messages yet.</div>`
          : messages.map(m => `
            <div style="padding:12px 14px;border-radius:var(--radius-sm);margin-bottom:6px;${m.is_escalation ? 'background:var(--red-50);border:1px solid var(--red-100)' : 'background:var(--paper-100)'}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <div style="font-size:13px"><strong>${escapeHtml(m.sender_name)}</strong> → ${escapeHtml(m.recipient_name)}
                  ${m.is_escalation ? '<span class="badge badge-denied" style="margin-left:8px">Escalation</span>' : ''}
                </div>
                <span style="font-size:11.5px;color:var(--ink-500)">${timeAgo(m.sent_timestamp_utc)}</span>
              </div>
              <div style="font-size:13px;line-height:1.45">${escapeHtml(m.body)}</div>
            </div>
          `).join('')
        }
        </div>
      </div>
    </div>
  `;
};

async function sendTAMessage() {
  const recipientName = document.getElementById('msgTo').value.trim();
  const body = document.getElementById('msgBody').value.trim();
  const isEscalation = document.getElementById('msgEsc').checked;
  if (!recipientName || !body) { toast('Please fill recipient and message', 'error'); return; }
  try {
    await API.sendTAMessage(recipientName, body, isEscalation);
    toast('Message sent', 'success');
    navigate('t-msgs');
  } catch (err) { toast(err.message, 'error'); }
}
window.sendTAMessage = sendTAMessage;

// ═══════════════════════════════════════════════════════════════════
// ADMIN — Analytics dashboard
// ═══════════════════════════════════════════════════════════════════
ROUTES['a-ana'] = async function() {
  const [a, verify] = await Promise.all([
    API.getAnalytics(),
    API.verifyAuditChain().catch(() => null)
  ]);

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>Institutional analytics</h2>
        <p>Cross-departmental view of academic excuse activity</p>
      </div>
      <div class="ph-actions">
        <select id="anaSem" onchange="navigate('a-ana')" class="btn btn-ghost" style="padding-right:30px">
          <option value="">All semesters</option>
          <option>Spring 2026</option>
          <option>Fall 2025</option>
        </select>
        <button class="btn btn-ghost" onclick="exportData('analytics','csv')">${icon('download',14)} Export CSV</button>
        <button class="btn btn-ghost" onclick="exportData('analytics','pdf')">${icon('download',14)} Export PDF</button>
      </div>
    </div>

    ${verify ? `
      <div class="audit-banner ${verify.valid ? 'valid' : 'invalid'}">
        <div class="audit-banner-icon">${icon(verify.valid ? 'shield' : 'alert', 18)}</div>
        <div class="audit-banner-text">
          <strong>${verify.valid ? 'Audit chain verified' : 'AUDIT CHAIN COMPROMISED'}</strong>
          <span>${verify.valid
            ? `All ${verify.totalEntries} log entries integrity-checked · integrity verified`
            : `Tampering detected at entry ${verify.brokenAt || '?'} · contact security`
          }</span>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="navigate('a-audit')">View audit log →</button>
      </div>
    ` : ''}

    <div class="stat-grid">
      <div class="stat" style="--accent-color:var(--gold-500)">
        <div class="stat-label">Total requests</div>
        <div class="stat-value">${a.totals.total || 0}</div>
        <div class="stat-meta">all semesters</div>
      </div>
      <div class="stat" style="--accent-color:var(--orange-500)">
        <div class="stat-label">Pending</div>
        <div class="stat-value">${a.totals.pending || 0}</div>
        <div class="stat-meta">awaiting decision</div>
      </div>
      <div class="stat" style="--accent-color:var(--green-500)">
        <div class="stat-label">Approval rate</div>
        <div class="stat-value">${a.totals.total ? Math.round((a.totals.approved / a.totals.total) * 100) + '%' : '—'}</div>
        <div class="stat-meta">${a.totals.approved} approved · ${a.totals.denied} denied</div>
      </div>
      <div class="stat" style="--accent-color:var(--red-500)">
        <div class="stat-label">High-risk students</div>
        <div class="stat-value">${a.highRiskCount || 0}</div>
        <div class="stat-meta">&gt;3 requests · anonymized</div>
      </div>
    </div>

    <div class="chart-grid">
      <div class="card chart-card">
        <div class="card-header"><div class="card-title">By department</div></div>
        <div class="chart-canvas-wrap"><canvas id="adDept"></canvas></div>
      </div>
      <div class="card chart-card">
        <div class="card-header"><div class="card-title">Category breakdown</div></div>
        <div class="chart-canvas-wrap"><canvas id="adCat"></canvas></div>
      </div>
    </div>

    <div class="chart-grid">
      <div class="card chart-card">
        <div class="card-header"><div class="card-title">Submission trend (last 8 weeks)</div></div>
        <div class="chart-canvas-wrap"><canvas id="adTrend"></canvas></div>
      </div>
      <div class="card chart-card">
        <div class="card-header"><div class="card-title">Status mix</div></div>
        <div class="chart-canvas-wrap"><canvas id="adStatus"></canvas></div>
      </div>
    </div>

    ${a.flaggedInstructors?.length ? `
      <div class="card" style="margin-top:14px;border-color:var(--orange-100)">
        <div class="card-header">
          <div class="card-title" style="color:var(--orange-600)">${icon('alert')} Flagged instructors</div>
          <span style="font-size:11.5px;color:var(--ink-500)">Avg response &gt; 48h or stale pending requests</span>
        </div>
        <table class="tbl" style="border:none">
          <thead><tr><th>Instructor</th><th>Department</th><th>Avg response (hrs)</th><th>Stale pending</th></tr></thead>
          <tbody>${a.flaggedInstructors.map(f => `
            <tr>
              <td>${escapeHtml(f.name)}</td>
              <td>${escapeHtml(f.dept || '—')}</td>
              <td><strong style="color:${f.avg_hours > 72 ? 'var(--red-600)' : 'var(--orange-600)'}">${f.avg_hours ? f.avg_hours.toFixed(1) : '—'}</strong></td>
              <td>${f.stale_pending || 0}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    ` : ''}
  `;

  // Charts (admin)
  if (a.byDepartment?.length) {
    state.charts.adDept = new Chart(document.getElementById('adDept'), {
      type: 'bar',
      data: {
        labels: a.byDepartment.map(d => d.dept),
        datasets: [
          { label: 'Approved', data: a.byDepartment.map(d => d.approved), backgroundColor: '#27AE60', borderRadius: 3 },
          { label: 'Denied',   data: a.byDepartment.map(d => d.denied),   backgroundColor: '#E74C3C', borderRadius: 3 },
          { label: 'Pending',  data: a.byDepartment.map(d => d.pending),  backgroundColor: '#E67E22', borderRadius: 3 },
        ]
      },
      options: {
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
        maintainAspectRatio: false
      }
    });
  } else { document.getElementById('adDept').parentElement.innerHTML = emptyChartHtml(); }

  if (a.byCategory?.length) {
    state.charts.adCat = new Chart(document.getElementById('adCat'), {
      type: 'polarArea',
      data: {
        labels: a.byCategory.map(c => c.category),
        datasets: [{
          data: a.byCategory.map(c => c.count),
          backgroundColor: ['rgba(197,132,31,0.7)','rgba(39,174,96,0.7)','rgba(231,76,60,0.7)','rgba(41,128,185,0.7)','rgba(142,68,173,0.7)','rgba(243,156,18,0.7)'],
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
        maintainAspectRatio: false
      }
    });
  } else { document.getElementById('adCat').parentElement.innerHTML = emptyChartHtml(); }

  if (a.weeklyTrend?.length) {
    const trend = [...a.weeklyTrend].reverse();
    state.charts.adTrend = new Chart(document.getElementById('adTrend'), {
      type: 'line',
      data: {
        labels: trend.map(t => t.week.replace(/^\d{4}-W/, 'W')),
        datasets: [{
          label: 'Requests',
          data: trend.map(t => t.count),
          borderColor: '#0F1B2D',
          backgroundColor: 'rgba(15, 27, 45, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: '#C5841F',
          pointRadius: 4
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        maintainAspectRatio: false
      }
    });
  } else { document.getElementById('adTrend').parentElement.innerHTML = emptyChartHtml(); }

  if (a.byStatus?.length) {
    state.charts.adStatus = new Chart(document.getElementById('adStatus'), {
      type: 'doughnut',
      data: {
        labels: a.byStatus.map(s => s.status),
        datasets: [{
          data: a.byStatus.map(s => s.count),
          backgroundColor: ['#27AE60','#E67E22','#E74C3C','#F39C12','#2980B9','#8E44AD','#95A5A6','#D35400'],
          borderWidth: 0
        }]
      },
      options: {
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 11.5 } } } },
        cutout: '65%',
        maintainAspectRatio: false
      }
    });
  } else { document.getElementById('adStatus').parentElement.innerHTML = emptyChartHtml(); }
};

// ═══════════════════════════════════════════════════════════════════
// ADMIN — Audit log
// ═══════════════════════════════════════════════════════════════════
ROUTES['a-audit'] = async function() {
  const [{ entries, count }, verify] = await Promise.all([
    API.getAuditLog({ limit: 200 }),
    API.verifyAuditChain()
  ]);

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>Audit log</h2>
        <p>Tamper-evident Tamper-evident event log · ${count} entries shown</p>
      </div>
      <div class="ph-actions">
        <button class="btn btn-ghost" onclick="navigate('a-audit')">${icon('check',14)} Re-verify</button>
        <button class="btn btn-ghost" onclick="exportData('audit','csv')">${icon('download',14)} Export</button>
      </div>
    </div>

    <div class="audit-banner ${verify.valid ? 'valid' : 'invalid'}">
      <div class="audit-banner-icon">${icon(verify.valid ? 'shield' : 'alert', 18)}</div>
      <div class="audit-banner-text">
        <strong>${verify.valid ? 'Hash chain integrity verified' : 'AUDIT CHAIN COMPROMISED'}</strong>
        <span>${verify.valid
          ? `${verify.totalEntries} entries · integrity verified · last verified just now`
          : `Tampering detected at entry ${verify.brokenAt || '?'} · investigate immediately`
        }</span>
      </div>
    </div>

    <div class="filter-bar">
      <input type="text" id="auditSearch" placeholder="Filter by actor, action, or request ID…" oninput="filterAudit()">
    </div>

    <div class="table-wrap">
      <table class="tbl">
        <thead><tr>
          <th style="width:60px">#</th><th>Timestamp (UTC)</th><th>Actor</th>
          <th>Action</th><th>Request</th><th>Details</th><th>Hash</th>
        </tr></thead>
        <tbody id="auditBody">${renderAuditRows(entries)}</tbody>
      </table>
    </div>
  `;
  window._auditEntries = entries;
};

function renderAuditRows(entries) {
  if (!entries.length) return `<tr class="empty-row"><td colspan="7">No audit entries match.</td></tr>`;
  return entries.map(e => `
    <tr>
      <td><span class="hash-pill">${e.log_id}</span></td>
      <td style="font-family:var(--font-mono);font-size:11.5px">${e.timestamp_utc}</td>
      <td>${escapeHtml(e.actor_name || e.actor_user_id || 'SYSTEM')}</td>
      <td><strong>${escapeHtml(e.action_type)}</strong></td>
      <td>${e.request_id ? `<span class="hash-pill">${e.request_id}</span>` : '—'}</td>
      <td style="font-size:12px;color:var(--ink-700)">${escapeHtml((e.details||'').substring(0, 80))}${(e.details||'').length > 80 ? '…' : ''}</td>
      <td><span class="hash-pill" title="${escapeHtml(e.hash_value)}">${(e.hash_value||'').substring(0, 12)}…</span></td>
    </tr>
  `).join('');
}

function filterAudit() {
  const q = document.getElementById('auditSearch').value.toLowerCase();
  const filtered = (window._auditEntries || []).filter(e =>
    !q || (e.actor_name||'').toLowerCase().includes(q) ||
          (e.action_type||'').toLowerCase().includes(q) ||
          (e.request_id||'').toLowerCase().includes(q) ||
          (e.details||'').toLowerCase().includes(q)
  );
  document.getElementById('auditBody').innerHTML = renderAuditRows(filtered);
}
window.filterAudit = filterAudit;

// ═══════════════════════════════════════════════════════════════════
// ADMIN — Historical database (read-only with filters)
// ═══════════════════════════════════════════════════════════════════
ROUTES['a-hist'] = async function() {
  const data = await API.getHistorical({ limit: 250 });
  const records = data.records || [];

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>Historical records</h2>
        <p>Read-only view of all archived requests · ${records.length} records shown</p>
      </div>
      <div class="ph-actions">
        <button class="btn btn-ghost" onclick="exportData('historical','csv')">${icon('download',14)} Export CSV</button>
      </div>
    </div>

    <div class="filter-bar">
      <select id="hStatus" onchange="filterHist()">
        <option value="">All statuses</option>
        <option>Approved</option><option>Denied</option><option>Pending</option>
        <option>Approved with Conditions</option><option>Partial Approval</option>
        <option>More Info Requested</option><option>Escalated</option>
      </select>
      <select id="hCat" onchange="filterHist()">
        <option value="">All categories</option>
        <option>Medical</option><option>Family Emergency</option>
        <option>Academic Conflict</option><option>Planned</option>
        <option>DSS</option><option>Other</option>
      </select>
      <input type="text" id="hSearch" placeholder="Search by student or course…" oninput="filterHist()">
    </div>

    ${records.length === 0
      ? `<div class="empty">
          <div class="empty-icon">${icon('archive',24)}</div>
          <h3>No historical records</h3>
          <p>Records appear here once requests are archived.</p>
        </div>`
      : `<div class="table-wrap">
          <table class="tbl">
            <thead><tr>
              <th>Request</th><th>Student</th><th>Course</th>
              <th>Date</th><th>Category</th><th>Status</th><th>Submitted</th><th>Decided</th>
            </tr></thead>
            <tbody id="histBody">${renderHistRows(records)}</tbody>
          </table>
        </div>`
    }
  `;
  window._histRecords = records;
};

function renderHistRows(records) {
  if (!records.length) return `<tr class="empty-row"><td colspan="8">No records match.</td></tr>`;
  return records.map(r => `
    <tr>
      <td><span class="hash-pill">${r.request_id}</span></td>
      <td>${escapeHtml(r.student_name || '')}</td>
      <td>${escapeHtml(r.course_id)} <div style="font-size:11.5px;color:var(--ink-500)">${escapeHtml(r.course_name || '')}</div></td>
      <td>${fmtDate(r.absence_date)}</td>
      <td>${escapeHtml(r.category || '—')}</td>
      <td>${statusBadge(r.status)}</td>
      <td style="font-size:12.5px;color:var(--ink-500)">${fmtDateTime(r.submission_timestamp_utc)}</td>
      <td style="font-size:12.5px;color:var(--ink-500)">${r.decision_timestamp_utc ? fmtDateTime(r.decision_timestamp_utc) : '—'}</td>
    </tr>
  `).join('');
}

function filterHist() {
  const status = document.getElementById('hStatus').value;
  const cat = document.getElementById('hCat').value;
  const q = document.getElementById('hSearch').value.toLowerCase();
  const filtered = (window._histRecords || []).filter(r => {
    if (status && r.status !== status) return false;
    if (cat && r.category !== cat) return false;
    if (q && !(
      (r.student_name||'').toLowerCase().includes(q) ||
      (r.course_name||'').toLowerCase().includes(q) ||
      (r.course_id||'').toLowerCase().includes(q)
    )) return false;
    return true;
  });
  document.getElementById('histBody').innerHTML = renderHistRows(filtered);
}
window.filterHist = filterHist;

// ═══════════════════════════════════════════════════════════════════
// ADMIN — Dashboard (escalations queue, integrity check, quick actions)
// ═══════════════════════════════════════════════════════════════════
ROUTES['a-dash'] = async function() {
  const [{ requests }, analytics, verify] = await Promise.all([
    API.listRequests(),
    API.getAnalytics().catch(() => null),
    API.verifyAuditChain().catch(() => null)
  ]);

  const escalated = requests.filter(r => r.status === 'Escalated');
  const pending = requests.filter(r => r.status === 'Pending');
  const today = ymd(new Date());
  const todayDecisions = requests.filter(r => r.decisionAt && r.decisionAt.startsWith(today)).length;

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, Administrator</h2>
        <p>${escalated.length} escalated request${escalated.length !== 1 ? 's' : ''} awaiting review · ${pending.length} pending system-wide</p>
      </div>
      <div class="ph-actions">
        <button class="btn btn-ghost" onclick="navigate('a-audit')">${icon('shield',14)} Audit log</button>
        <button class="btn btn-ghost" onclick="navigate('a-ana')">${icon('chart',14)} Analytics</button>
      </div>
    </div>

    ${verify ? `
      <div class="audit-banner ${verify.valid ? 'valid' : 'invalid'}" style="margin-bottom:18px">
        <div class="audit-banner-icon">${icon(verify.valid ? 'shield' : 'alert', 18)}</div>
        <div class="audit-banner-text">
          <strong>${verify.valid ? 'System integrity verified' : 'AUDIT CHAIN COMPROMISED'}</strong>
          <span>${verify.valid
            ? `${verify.totalEntries} audit entries · integrity verified`
            : `Tampering detected at entry ${verify.brokenAt || '?'} · immediate investigation required`
          }</span>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="navigate('a-audit')">View log →</button>
      </div>
    ` : ''}

    <div class="stat-grid">
      <div class="stat" style="--accent-color:var(--red-500)">
        <div class="stat-label">Escalations</div>
        <div class="stat-value">${escalated.length}</div>
        <div class="stat-meta ${escalated.length ? 'down' : ''}">need admin review</div>
      </div>
      <div class="stat" style="--accent-color:var(--orange-500)">
        <div class="stat-label">Pending (all)</div>
        <div class="stat-value">${pending.length}</div>
        <div class="stat-meta">system-wide</div>
      </div>
      <div class="stat" style="--accent-color:var(--green-500)">
        <div class="stat-label">Decided today</div>
        <div class="stat-value">${todayDecisions}</div>
        <div class="stat-meta">across all instructors</div>
      </div>
      <div class="stat" style="--accent-color:var(--gold-500)">
        <div class="stat-label">Total requests</div>
        <div class="stat-value">${requests.length}</div>
        <div class="stat-meta">this term</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-header">
        <div class="card-title" style="${escalated.length ? 'color:var(--red-600)' : ''}">
          ${icon(escalated.length ? 'alert' : 'check')} Escalations queue
        </div>
        <span style="font-size:11.5px;color:var(--ink-500)">requests flagged by instructors for admin review</span>
      </div>
      ${escalated.length === 0
        ? `<div style="padding:32px 20px;text-align:center;color:var(--ink-500);font-size:13.5px">
            <div style="margin:0 auto 10px;width:40px;height:40px;background:var(--green-50);color:var(--green-600);border-radius:50%;display:grid;place-items:center">${icon('check',20)}</div>
            No escalations right now. All requests are being handled at the instructor level.
          </div>`
        : `<div class="table-wrap" style="border:none">
            <table class="tbl">
              <thead><tr>
                <th>Request</th><th>Student</th><th>Course</th>
                <th>Date</th><th>Category</th><th>Escalated</th><th></th>
              </tr></thead>
              <tbody>${escalated.map(r => `
                <tr>
                  <td><strong>${r.id}</strong> ${priBadge(r.priority)}</td>
                  <td>${escapeHtml(r.studentName)}</td>
                  <td>${escapeHtml(r.course)}<div style="font-size:11.5px;color:var(--ink-500)">${escapeHtml(r.courseName || '')}</div></td>
                  <td>${fmtDate(r.date)}</td>
                  <td>${escapeHtml(r.category || '—')}</td>
                  <td>${r.decisionAt ? timeAgo(r.decisionAt) : '—'}</td>
                  <td style="text-align:right">
                    <button class="btn btn-sm btn-gold" onclick="viewRequest('${r.id}')">Review</button>
                  </td>
                </tr>
              `).join('')}</tbody>
            </table>
          </div>`
      }
    </div>

    <div class="chart-grid">
      <div class="card chart-card">
        <div class="card-header"><div class="card-title">Status mix</div></div>
        <div class="chart-canvas-wrap"><canvas id="adashStatus"></canvas></div>
      </div>
      <div class="card chart-card">
        <div class="card-header"><div class="card-title">Recent activity</div></div>
        ${requests.slice(0, 6).length === 0
          ? `<div style="padding:24px;text-align:center;color:var(--ink-500);font-size:13px">No recent activity.</div>`
          : `<div class="activity-feed">${requests.slice(0, 6).map(r => `
              <div class="activity-item" onclick="viewRequest('${r.id}')">
                <div class="activity-icon" style="background:var(--paper-200);color:var(--ink-700)">${icon('inbox',16)}</div>
                <div class="activity-content">
                  <div class="activity-title">${escapeHtml(r.studentName || '')} · ${escapeHtml(r.course)}</div>
                  <div class="activity-meta">${statusBadge(r.status)} · ${timeAgo(r.submitted)}</div>
                </div>
              </div>
            `).join('')}</div>`
        }
      </div>
    </div>
  `;

  // Status chart
  if (analytics && analytics.byStatus && analytics.byStatus.length) {
    state.charts.adashStatus = new Chart(document.getElementById('adashStatus'), {
      type: 'doughnut',
      data: {
        labels: analytics.byStatus.map(s => s.status),
        datasets: [{
          data: analytics.byStatus.map(s => s.count),
          backgroundColor: ['#27AE60','#E67E22','#E74C3C','#F39C12','#2980B9','#8E44AD','#95A5A6','#D35400'],
          borderWidth: 0
        }]
      },
      options: {
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 11.5 } } } },
        cutout: '65%',
        maintainAspectRatio: false
      }
    });
  } else {
    document.getElementById('adashStatus').parentElement.innerHTML = emptyChartHtml();
  }
};

// ═══════════════════════════════════════════════════════════════════
// ADMIN — submit recommendation override (returns to instructor)
// ═══════════════════════════════════════════════════════════════════
function updateAdminBtn() {
  const btn = document.getElementById('adminOverrideBtn');
  if (!btn) return;
  const rec = document.querySelector('input[name="adminRec"]:checked')?.value;
  const comment = document.getElementById('adminComment')?.value.trim();
  btn.disabled = !rec || !comment;
  // Visually highlight selected option card
  document.querySelectorAll('.admin-rec-opt').forEach(el => {
    const input = el.querySelector('input[name="adminRec"]');
    el.style.borderColor = input && input.checked ? 'var(--gold-500)' : 'var(--paper-300)';
    el.style.background = input && input.checked ? 'var(--gold-50)' : 'white';
  });
}
window.updateAdminBtn = updateAdminBtn;

async function submitAdminOverride(requestId) {
  const recommendation = document.querySelector('input[name="adminRec"]:checked')?.value;
  const comment = document.getElementById('adminComment').value.trim();
  if (!recommendation || !comment) return;
  try {
    await API.adminOverride(requestId, recommendation, comment);
    closeModal({ target: { id: 'modalOverlay' } });
    toast(`Recommendation submitted — returned to instructor`, 'success');
    if (state.page === 'a-dash' || state.page === 'a-hist' || state.page === 'a-audit') navigate(state.page);
  } catch (err) { toast(err.message, 'error'); }
}
window.submitAdminOverride = submitAdminOverride;

// ═══════════════════════════════════════════════════════════════════
// STUDENT — add additional documentation to existing request
// ═══════════════════════════════════════════════════════════════════
function openAddDocModal(requestId) {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${icon('plus')} Add documentation</div>
      <button class="icon-btn" onclick="closeModal({target:{id:'modalOverlay'}})">${ICONS.close.replace('<svg','<svg width="16" height="16"')}</button>
    </div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--ink-700);margin-bottom:14px">Attach additional documentation to request <strong>${requestId}</strong>. Your instructor will be notified.</p>
      <div class="field">
        <label>File *</label>
        <div class="upload-zone" id="addDocZone" onclick="document.getElementById('addDocFile').click()">
          <strong>Drop a file or click to browse</strong>
          <small>PDF, JPG, PNG · Max 5 MB</small>
          <input type="file" id="addDocFile" accept=".pdf,.jpg,.jpeg,.png" style="display:none" onchange="previewAddDoc(this)">
        </div>
      </div>
      <div class="checkbox-row" style="margin-top:10px">
        <input type="checkbox" id="addDocConsent">
        <label for="addDocConsent">I acknowledge this document may be reviewed by my instructor and authorized administrators in compliance with FERPA.</label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal({target:{id:'modalOverlay'}})">Cancel</button>
      <button class="btn btn-gold" onclick="submitAddDoc('${requestId}')">Upload</button>
    </div>
  `, 'sm');
}
window.openAddDocModal = openAddDocModal;

function previewAddDoc(input) {
  const f = input.files[0];
  if (!f) return;
  if (f.size > 5 * 1024 * 1024) { toast('File exceeds 5 MB limit', 'error'); input.value = ''; return; }
  const zone = document.getElementById('addDocZone');
  zone.classList.add('has-file');
  zone.innerHTML = `<strong>✓ ${escapeHtml(f.name)}</strong><small>${Math.ceil(f.size / 1024)} KB · click to replace</small><input type="file" id="addDocFile" accept=".pdf,.jpg,.jpeg,.png" style="display:none" onchange="previewAddDoc(this)">`;
  const dt = new DataTransfer(); dt.items.add(f);
  document.getElementById('addDocFile').files = dt.files;
}
window.previewAddDoc = previewAddDoc;

async function submitAddDoc(requestId) {
  const file = document.getElementById('addDocFile').files[0];
  const consent = document.getElementById('addDocConsent').checked;
  if (!file) { toast('Please choose a file', 'error'); return; }
  if (!consent) { toast('Please acknowledge FERPA consent', 'error'); return; }
  const fd = new FormData();
  fd.append('document', file);
  try {
    await API.addDocument(requestId, fd);
    closeModal({ target: { id: 'modalOverlay' } });
    toast('Documentation added — instructor notified', 'success');
    // If we were viewing the request, reopen to show updated state
    if (state.viewingRequestId === requestId) viewRequest(requestId);
    else if (state.page === 's-reqs') navigate('s-reqs');
  } catch (err) { toast(err.message, 'error'); }
}
window.submitAddDoc = submitAddDoc;

// ═══════════════════════════════════════════════════════════════════
// MESSAGES — shared route handler for all 4 roles
// ═══════════════════════════════════════════════════════════════════
async function renderMessages() {
  const [{ messages }, { contacts }] = await Promise.all([
    API.listMessages(),
    API.listContacts()
  ]);
  state.msgs = messages;
  state.contacts = contacts;
  // Default to first contact with thread, or first contact overall
  if (!state.msgActiveContact && contacts.length) {
    // Prefer contact with most recent thread
    const withThreads = contacts.filter(c => messages.some(m => m.sender_id === c.user_id || m.recipient_id === c.user_id));
    state.msgActiveContact = (withThreads[0] || contacts[0]).user_id;
  }

  document.getElementById('main').innerHTML = `
    <div class="ph">
      <div>
        <h2>Messages</h2>
        <p>Direct messaging with anyone on ExcuseFlow · ${messages.length} total message${messages.length !== 1 ? 's' : ''}</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:280px 1fr;gap:14px;height:calc(100vh - 220px);min-height:480px">
      <!-- Contacts -->
      <div class="card" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
        <div style="padding:12px 14px;border-bottom:1px solid var(--paper-200);display:flex;align-items:center;justify-content:space-between">
          <strong style="font-size:13px">People</strong>
          <input type="text" id="msgSearch" placeholder="Search…" oninput="filterContacts()" style="padding:5px 8px;font-size:12px;border:1px solid var(--paper-300);border-radius:var(--radius-sm);width:130px;background:var(--paper-50)">
        </div>
        <div id="contactsList" style="overflow-y:auto;flex:1">${renderContactsList(contacts, messages)}</div>
      </div>

      <!-- Thread + Composer -->
      <div class="card" style="padding:0;display:flex;flex-direction:column;overflow:hidden" id="msgPane">
        ${renderActiveThread()}
      </div>
    </div>
  `;
}
ROUTES['s-msgs'] = renderMessages;
ROUTES['i-msgs'] = renderMessages;
ROUTES['t-msgs'] = renderMessages;
ROUTES['a-msgs'] = renderMessages;

function renderContactsList(contacts, messages) {
  const roleDots = { student: '#2980B9', instructor: '#C5841F', ta: '#27AE60', admin: '#8E44AD' };
  // For each contact, compute: last message time, unread count
  return contacts.map(c => {
    const thread = (messages || state.msgs || []).filter(m => m.sender_id === c.user_id || m.recipient_id === c.user_id);
    const last = thread[0];  // already ordered DESC
    const unread = thread.filter(m => m.recipient_id === state.user.userId && !m.read_status).length;
    const active = c.user_id === state.msgActiveContact;
    const initial = (c.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
    return `
      <div onclick="selectContact('${c.user_id}')" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--paper-200);transition:background var(--dur-fast) var(--ease);${active ? 'background:var(--gold-50)' : ''}">
        <div style="width:34px;height:34px;border-radius:50%;background:${roleDots[c.role] || '#999'};color:white;display:grid;place-items:center;font-weight:600;font-size:12px;flex-shrink:0">${initial}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
            <strong style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(c.name)}</strong>
            ${last ? `<span style="font-size:10.5px;color:var(--ink-500);white-space:nowrap">${timeAgo(last.sent_timestamp_utc)}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:1px">
            <span style="font-size:11.5px;color:var(--ink-500);text-transform:capitalize">${escapeHtml(c.role)}</span>
            ${unread > 0 ? `<span style="background:var(--gold-500);color:white;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;min-width:16px;text-align:center">${unread}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('') || `<div style="padding:24px;text-align:center;color:var(--ink-500);font-size:13px">No contacts found.</div>`;
}

function filterContacts() {
  const q = (document.getElementById('msgSearch').value || '').toLowerCase();
  const filtered = (state.contacts || []).filter(c =>
    !q || c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
  );
  document.getElementById('contactsList').innerHTML = renderContactsList(filtered, state.msgs);
}
window.filterContacts = filterContacts;

function selectContact(userId) {
  state.msgActiveContact = userId;
  document.getElementById('contactsList').innerHTML = renderContactsList(state.contacts, state.msgs);
  document.getElementById('msgPane').innerHTML = renderActiveThread();
  // Mark received unread messages as read
  (state.msgs || []).forEach(m => {
    if (m.sender_id === userId && m.recipient_id === state.user.userId && !m.read_status) {
      API.markMessageRead(m.message_id).catch(() => {});
      m.read_status = 1;
    }
  });
  loadNotifications();
}
window.selectContact = selectContact;

function renderActiveThread() {
  const contact = (state.contacts || []).find(c => c.user_id === state.msgActiveContact);
  if (!contact) {
    return `<div style="flex:1;display:grid;place-items:center;color:var(--ink-500);font-size:13.5px;padding:40px">
      <div style="text-align:center">
        <div style="width:48px;height:48px;background:var(--paper-200);border-radius:50%;display:grid;place-items:center;margin:0 auto 12px">${icon('chat',20)}</div>
        <h3 style="font-family:var(--font-display);font-size:16px;margin-bottom:4px;color:var(--ink-900)">Select a contact</h3>
        <p>Choose someone from the left to start or continue a conversation.</p>
      </div>
    </div>`;
  }
  const thread = (state.msgs || []).filter(m =>
    m.sender_id === state.msgActiveContact || m.recipient_id === state.msgActiveContact
  ).slice().reverse();  // oldest first for chat flow
  const initial = (contact.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const roleDots = { student: '#2980B9', instructor: '#C5841F', ta: '#27AE60', admin: '#8E44AD' };

  return `
    <div style="padding:12px 16px;border-bottom:1px solid var(--paper-200);display:flex;align-items:center;gap:10px">
      <div style="width:32px;height:32px;border-radius:50%;background:${roleDots[contact.role] || '#999'};color:white;display:grid;place-items:center;font-weight:600;font-size:12px;flex-shrink:0">${initial}</div>
      <div>
        <div style="font-weight:600;font-size:14px">${escapeHtml(contact.name)}</div>
        <div style="font-size:11.5px;color:var(--ink-500)">${escapeHtml(contact.email)} · <span style="text-transform:capitalize">${escapeHtml(contact.role)}</span></div>
      </div>
    </div>
    <div id="threadBody" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;background:var(--paper-100)">
      ${thread.length === 0
        ? `<div style="display:grid;place-items:center;height:100%;color:var(--ink-500);font-size:13px">No messages yet. Say hi!</div>`
        : thread.map(m => {
            const mine = m.sender_id === state.user.userId;
            return `
              <div style="display:flex;${mine ? 'justify-content:flex-end' : 'justify-content:flex-start'}">
                <div style="max-width:70%;padding:9px 13px;border-radius:14px;${mine ? 'background:var(--navy-900);color:white;border-bottom-right-radius:4px' : 'background:var(--paper-50);border:1px solid var(--paper-300);border-bottom-left-radius:4px'}">
                  ${m.subject ? `<div style="font-weight:600;font-size:12px;margin-bottom:3px;${mine ? 'color:var(--gold-200)' : 'color:var(--gold-700)'}">${escapeHtml(m.subject)}</div>` : ''}
                  <div style="font-size:13.5px;line-height:1.45;white-space:pre-wrap">${escapeHtml(m.body)}</div>
                  <div style="font-size:10.5px;opacity:0.7;margin-top:4px;${mine ? 'text-align:right' : ''}">${timeAgo(m.sent_timestamp_utc)}</div>
                </div>
              </div>
            `;
          }).join('')
      }
    </div>
    <div style="padding:10px 14px;border-top:1px solid var(--paper-200);background:var(--paper-50)">
      <div style="display:flex;gap:6px;align-items:flex-start">
        <textarea id="composeBody" placeholder="Type your message…" style="flex:1;padding:8px 10px;border:1px solid var(--paper-300);border-radius:var(--radius-sm);font-size:13.5px;resize:none;min-height:44px;max-height:120px;background:white" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendComposedMessage()}"></textarea>
        <button class="btn btn-gold" onclick="sendComposedMessage()" style="align-self:stretch;padding:0 16px">Send</button>
      </div>
      <div style="font-size:11px;color:var(--ink-500);margin-top:4px">Press Enter to send, Shift+Enter for newline.</div>
    </div>
  `;
}

async function sendComposedMessage() {
  const body = document.getElementById('composeBody').value.trim();
  if (!body) return;
  if (!state.msgActiveContact) { toast('Select a contact first', 'error'); return; }
  try {
    await API.sendMessage(state.msgActiveContact, body);
    document.getElementById('composeBody').value = '';
    // Refresh thread
    const { messages } = await API.listMessages();
    state.msgs = messages;
    document.getElementById('msgPane').innerHTML = renderActiveThread();
    document.getElementById('contactsList').innerHTML = renderContactsList(state.contacts, messages);
    // Scroll to bottom
    const tb = document.getElementById('threadBody');
    if (tb) tb.scrollTop = tb.scrollHeight;
  } catch (err) { toast(err.message, 'error'); }
}
window.sendComposedMessage = sendComposedMessage;

// ═══════════════════════════════════════════════════════════════════
// RESCHEDULING WORKFLOW — student proposes, TA confirms
// ═══════════════════════════════════════════════════════════════════
function addProposedRow() {
  const list = document.getElementById('proposedTimesList');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'proposed-time-row';
  row.style = 'display:grid;grid-template-columns:1fr auto;gap:6px';
  row.innerHTML = `
    <input type="datetime-local" class="proposed-time-input" style="padding:7px 10px;border:1px solid var(--paper-300);border-radius:var(--radius-sm);font-size:13px;background:white">
    <button class="btn btn-sm btn-ghost" onclick="removeProposedRow(this)">${icon('trash',12)}</button>
  `;
  list.appendChild(row);
}
window.addProposedRow = addProposedRow;

function removeProposedRow(btn) {
  const list = document.getElementById('proposedTimesList');
  const rows = list.querySelectorAll('.proposed-time-row');
  if (rows.length <= 1) {
    toast('Keep at least one proposed time', 'info');
    return;
  }
  btn.closest('.proposed-time-row').remove();
}
window.removeProposedRow = removeProposedRow;

async function submitProposedTimes(requestId) {
  const inputs = document.querySelectorAll('.proposed-time-input');
  const times = Array.from(inputs)
    .map(i => i.value)
    .filter(v => !!v)
    .map(v => v.replace('T', ' ') + ':00');
  if (times.length === 0) { toast('Please enter at least one time', 'error'); return; }
  try {
    await API.proposeTimes(requestId, times);
    closeModal({ target: { id: 'modalOverlay' } });
    toast(`${times.length} time${times.length !== 1 ? 's' : ''} proposed — TA will confirm one`, 'success');
    if (state.page === 's-reqs' || state.page === 's-dash') navigate(state.page);
  } catch (err) { toast(err.message, 'error'); }
}
window.submitProposedTimes = submitProposedTimes;

function pickProposedSlot(t) {
  // t is an SQL-style datetime "YYYY-MM-DD HH:MM:SS" — convert to datetime-local format
  const dtInput = document.getElementById('tcDT');
  if (!dtInput) return;
  dtInput.value = t.replace(' ', 'T').slice(0, 16);
  // Visual feedback on selection
  document.querySelectorAll('.ta-slot-opt').forEach(el => {
    const input = el.querySelector('input[name="taSlot"]');
    el.style.borderColor = input && input.checked ? 'var(--green-500)' : 'var(--paper-300)';
    el.style.background = input && input.checked ? 'var(--green-50)' : 'white';
  });
}

// Click radio again to deselect — lets TA change their mind without awkward workarounds
function toggleProposedSlot(radio, t) {
  // If it was already the selected one before the click, uncheck + clear the datetime
  // (the browser auto-checks it on click, so we detect via a "last clicked" tracker)
  if (radio.dataset.wasChecked === '1') {
    radio.checked = false;
    radio.dataset.wasChecked = '0';
    clearProposedSlot();
    return;
  }
  // Otherwise it's a fresh selection — mark this one, un-mark the others
  document.querySelectorAll('input[name="taSlot"]').forEach(r => { r.dataset.wasChecked = '0'; });
  radio.dataset.wasChecked = '1';
  pickProposedSlot(t);
}
window.toggleProposedSlot = toggleProposedSlot;

function clearProposedSlot() {
  document.querySelectorAll('input[name="taSlot"]').forEach(r => { r.checked = false; r.dataset.wasChecked = '0'; });
  const dt = document.getElementById('tcDT');
  if (dt) { dt.value = ''; dt.focus(); }
  // Reset visual styling
  document.querySelectorAll('.ta-slot-opt').forEach(el => {
    el.style.borderColor = 'var(--paper-300)';
    el.style.background = 'white';
  });
}
window.clearProposedSlot = clearProposedSlot;
window.pickProposedSlot = pickProposedSlot;

async function submitTAConfirm(requestId) {
  const dt = document.getElementById('tcDT').value;
  const room = document.getElementById('tcRoom').value.trim();
  const sessionType = document.getElementById('tcType').value;
  const duration = document.getElementById('tcDur').value;
  const notes = document.getElementById('tcNotes').value.trim();
  if (!dt || !room) { toast('Date/time and room are required', 'error'); return; }
  try {
    await API.confirmSchedule(requestId, {
      scheduledDatetime: dt.replace('T', ' ') + ':00',
      room, duration, sessionType, notes
    });
    closeModal({ target: { id: 'modalOverlay' } });
    toast(`Schedule confirmed — student notified`, 'success');
    if (['t-queue','t-sched','t-proc'].includes(state.page)) navigate(state.page);
  } catch (err) { toast(err.message, 'error'); }
}
window.submitTAConfirm = submitTAConfirm;

// ═══════════════════════════════════════════════════════════════════
// STUDENT — Accept / Counter-propose a TA's schedule offer
// ═══════════════════════════════════════════════════════════════════
function toggleCounterProposeUI() {
  const block = document.getElementById('counterProposeBlock');
  if (!block) return;
  block.style.display = block.style.display === 'none' ? 'block' : 'none';
}
window.toggleCounterProposeUI = toggleCounterProposeUI;

function addCounterRow() {
  const list = document.getElementById('counterList');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'counter-row';
  row.style = 'display:grid;grid-template-columns:1fr auto;gap:6px';
  row.innerHTML = `
    <input type="datetime-local" class="counter-input" style="padding:7px 10px;border:1px solid var(--paper-300);border-radius:var(--radius-sm);font-size:13px;background:white">
    <button class="btn btn-sm btn-ghost" onclick="removeCounterRow(this)">${icon('trash',12)}</button>
  `;
  list.appendChild(row);
}
window.addCounterRow = addCounterRow;

function removeCounterRow(btn) {
  const list = document.getElementById('counterList');
  const rows = list.querySelectorAll('.counter-row');
  if (rows.length <= 1) { toast('Keep at least one time', 'info'); return; }
  btn.closest('.counter-row').remove();
}
window.removeCounterRow = removeCounterRow;

async function acceptTASchedule(requestId) {
  const ok = await confirmDialog(
    'Accept this schedule?',
    'This will finalize the makeup. Both you and the TA will be notified.',
    'Accept',
    false
  );
  if (!ok) return;
  try {
    await API.approveSchedule(requestId, true);
    closeModal({ target: { id: 'modalOverlay' } });
    toast('Schedule accepted — you\'re all set', 'success');
    if (state.page === 's-dash' || state.page === 's-reqs' || state.page === 's-retake') navigate(state.page);
  } catch (err) { toast(err.message, 'error'); }
}
window.acceptTASchedule = acceptTASchedule;

async function declineTASchedule(requestId) {
  const inputs = document.querySelectorAll('.counter-input');
  const counters = Array.from(inputs).map(i => i.value).filter(v => !!v).map(v => v.replace('T', ' ') + ':00');
  try {
    await API.approveSchedule(requestId, false, counters);
    closeModal({ target: { id: 'modalOverlay' } });
    toast(counters.length ? `Counter-proposed ${counters.length} time${counters.length !== 1 ? 's' : ''}` : 'Declined — awaiting new TA suggestion', 'info');
    if (state.page === 's-dash' || state.page === 's-reqs') navigate(state.page);
  } catch (err) { toast(err.message, 'error'); }
}
window.declineTASchedule = declineTASchedule;
