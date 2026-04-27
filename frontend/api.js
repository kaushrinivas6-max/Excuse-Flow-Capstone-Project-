// ═══════════════════════════════════════════════════════════════════
// ExcuseFlow API Client v2
// fetch() wrapper + Server-Sent Events live stream
// ═══════════════════════════════════════════════════════════════════

const API_BASE = window.location.origin + '/api';
const TOKEN_KEY = 'excuseflow_token';
const USER_KEY  = 'excuseflow_user';

// ─── Token + user persistence ───────────────────────────────────────
const getToken        = () => localStorage.getItem(TOKEN_KEY);
const setToken        = (t) => localStorage.setItem(TOKEN_KEY, t);
const clearToken      = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); };
const getCurrentUser  = () => { const r = localStorage.getItem(USER_KEY); return r ? JSON.parse(r) : null; };
const setCurrentUser  = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u));

// ─── Core request wrapper ───────────────────────────────────────────
async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(API_BASE + path, { ...options, headers });

  if (res.status === 401) {
    // 401 on the login endpoint itself is just "wrong password" — let it bubble up with the real message
    const isLoginAttempt = path.startsWith('/auth/login');
    if (!isLoginAttempt) {
      clearToken();
      if (typeof window.onAuthFailed === 'function') window.onAuthFailed();
      throw new Error('Session expired. Please sign in again.');
    }
    // For login: let the normal error path below show "Invalid credentials" from the server
  }

  let data;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) data = await res.json();
  else data = await res.text();

  if (!res.ok) throw new Error((data && data.error) || ('Request failed: ' + res.status));
  return data;
}

// ─── API surface ────────────────────────────────────────────────────
const API = {
  // Auth
  login:  (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  publicCourses: () => request('/auth/public/courses'),
  publicInstructors: () => request('/auth/public/instructors'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me:     () => request('/auth/me'),
  health: () => request('/health'),

  // Requests
  listRequests:  (filters = {}) => request('/requests' + (Object.keys(filters).length ? '?' + new URLSearchParams(filters) : '')),
  getRequest:    (id) => request('/requests/' + id),
  submitRequest: (formData) => request('/requests', { method: 'POST', body: formData }),
  editRequest:   (id, data) => request('/requests/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  withdrawRequest: (id) => request('/requests/' + id + '/withdraw', { method: 'POST' }),
  deleteRequest: (id) => request('/requests/' + id, { method: 'DELETE' }),
  decideRequest: (id, decision, comment, conditions) =>
    request('/requests/' + id + '/decision', {
      method: 'POST',
      body: JSON.stringify({ decision, comment, conditions })
    }),
  addComment:    (id, body) => request('/requests/' + id + '/comments', { method: 'POST', body: JSON.stringify({ body }) }),
  setPriority:   (id, priority) => request('/requests/' + id + '/priority', { method: 'POST', body: JSON.stringify({ priority }) }),
  adminOverride: (id, recommendation, comment) =>
    request('/requests/' + id + '/admin-override', {
      method: 'POST',
      body: JSON.stringify({ recommendation, comment })
    }),
  addDocument:   (id, formData) => request('/requests/' + id + '/add-document', { method: 'POST', body: formData }),
  proposeTimes:  (id, times) =>
    request('/requests/' + id + '/propose-times', {
      method: 'POST',
      body: JSON.stringify({ times })
    }),
  confirmSchedule: (id, data) =>
    request('/requests/' + id + '/confirm-schedule', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  approveSchedule: (id, accept, counterProposals) =>
    request('/requests/' + id + '/student-approve-schedule', {
      method: 'POST',
      body: JSON.stringify({ accept, counterProposals: counterProposals || [] })
    }),
  downloadDocument: (id) => {
    const token = getToken();
    return fetch(API_BASE + '/requests/' + id + '/document', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => { if (!r.ok) throw new Error('Download failed'); return r.blob(); });
  },

  // Messages (direct)
  listMessages:    () => request('/messages'),
  listContacts:    () => request('/messages/contacts'),
  sendMessage:     (recipientId, body, subject, requestId) =>
    request('/messages', { method: 'POST', body: JSON.stringify({ recipientId, body, subject, requestId }) }),
  markMessageRead: (id) => request('/messages/' + id + '/read', { method: 'POST' }),

  // Courses
  listCourses:    () => request('/courses'),
  myCourses:      () => request('/courses/mine'),
  createCourse:   (data) => request('/courses', { method: 'POST', body: JSON.stringify(data) }),
  createInstructorCourse: (data) => request('/courses/instructor', { method: 'POST', body: JSON.stringify(data) }),
  myTAs: () => request('/ta/my-tas'),
  enrollCourse:   (id) => request('/courses/' + id + '/enroll', { method: 'POST' }),
  dropCourse:     (id) => request('/courses/' + id + '/enroll', { method: 'DELETE' }),
  deleteCourse:   (id) => request('/courses/' + id, { method: 'DELETE' }),

  // Videos
  listVideos:     (courseId) => request('/videos' + (courseId ? '?courseId=' + courseId : '')),
  getVideo:       (id) => request('/videos/' + id),

  // Notifications
  listNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request('/notifications/' + id + '/read', { method: 'POST' }),
  markAllRead:       () => request('/notifications/read-all', { method: 'POST' }),

  // Admin
  getAnalytics:    (filters = {}) => request('/admin/analytics' + (Object.keys(filters).length ? '?' + new URLSearchParams(filters) : '')),
  getAuditLog:     (filters = {}) => request('/admin/audit' + (Object.keys(filters).length ? '?' + new URLSearchParams(filters) : '')),
  verifyAuditChain: () => request('/admin/audit/verify'),
  exportData:      (scope, format) => request('/admin/export', { method: 'POST', body: JSON.stringify({ scope, format }) }),
  getHistorical:   (filters = {}) => request('/admin/historical' + (Object.keys(filters).length ? '?' + new URLSearchParams(filters) : '')),

  // TA + Retakes
  taQueue:         () => request('/ta/queue'),
  taAttendance:    (bookingId, status) => request('/ta/attendance', { method: 'POST', body: JSON.stringify({ bookingId, status }) }),
  taMessages:      () => request('/ta/messages'),
  sendTAMessage:   (recipientName, body, isEscalation) =>
    request('/ta/messages', { method: 'POST', body: JSON.stringify({ recipientName, body, isEscalation }) }),
  taBookFor:       (data) => request('/ta/book-for', { method: 'POST', body: JSON.stringify(data) }),
  taReschedule:    (data) => request('/ta/reschedule', { method: 'POST', body: JSON.stringify(data) }),
  listRetakeConfigs: () => request('/retakes/configs'),
  createRetakeConfig: (cfg) => request('/retakes/configs', { method: 'POST', body: JSON.stringify(cfg) }),
  deleteRetakeConfig: (id) => request('/retakes/configs/' + id, { method: 'DELETE' }),
  bookRetake:      (data) => request('/retakes/book', { method: 'POST', body: JSON.stringify(data) }),
  myBookings:      () => request('/retakes/mine'),
};

// ─── Server-Sent Events ─────────────────────────────────────────────
const EventBus = {
  source: null,
  listeners: {},
  connected: false,

  connect() {
    const token = getToken();
    if (!token) return;
    if (this.source) this.source.close();

    this.source = new EventSource(API_BASE + '/events?token=' + encodeURIComponent(token));

    // Wire all known event types
    ['connected','request_submitted','request_decided','request_updated','request_withdrawn',
     'request_deleted','request_returned','comment_posted','course_added','ta_escalation',
     'message_received'].forEach(type => {
      this.source.addEventListener(type, (e) => {
        try {
          if (type === 'connected') this.connected = true;
          this._dispatch(type, JSON.parse(e.data));
        } catch {}
      });
    });

    this.source.onerror = () => {
      this.connected = false;
      this._dispatch('disconnected', null);
      // Attempt reconnect after 3s
      setTimeout(() => { if (getToken()) this.connect(); }, 3000);
    };
  },

  disconnect() {
    if (this.source) { this.source.close(); this.source = null; }
    this.connected = false;
  },

  on(type, fn) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
  },

  off(type, fn) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(f => f !== fn);
  },

  _dispatch(type, data) {
    (this.listeners[type] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });
  }
};

window.API = API;
window.EFAuth = { getToken, setToken, clearToken, getCurrentUser, setCurrentUser };
window.EventBus = EventBus;
