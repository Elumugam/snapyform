/**
 * SnapyForm API Client – fetch() wrapper with JWT auth
 * Includes: Auth, Forms, Responses, Stats, Templates, AI, Export,
 *           Automation, Webhooks, Public API, Offline Sync, Admin
 */
const DocmoAPI = {
    BASE: '/api',
    getToken: () => localStorage.getItem('docmo_token') || '',
    setToken: t => localStorage.setItem('docmo_token', t),
    clearToken: () => { localStorage.removeItem('docmo_token'); localStorage.removeItem('sf_user'); },
    isLoggedIn: () => !!localStorage.getItem('docmo_token'),
    getCachedUser: () => { try { return JSON.parse(localStorage.getItem('sf_user') || 'null'); } catch { return null; } },
    headers: (extra = {}) => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DocmoAPI.getToken(), ...extra }),

    async req(method, path, body) {
        const opts = { method, headers: this.headers() };
        if (body !== undefined) opts.body = JSON.stringify(body);
        const res = await fetch(this.BASE + path, opts);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    },

    // ── Auth ────────────────────────────────────────────────────────────
    async login(email, password) {
        const d = await this.req('POST', '/auth/login', { email, password });
        this.setToken(d.token); localStorage.setItem('sf_user', JSON.stringify(d.user));
        return d.user;
    },
    async register(name, email, password) {
        const d = await this.req('POST', '/auth/register', { name, email, password });
        this.setToken(d.token); localStorage.setItem('sf_user', JSON.stringify(d.user));
        return d.user;
    },
    async getMe() {
        if (!this.isLoggedIn()) return null;
        try { const u = await this.req('GET', '/auth/me'); localStorage.setItem('sf_user', JSON.stringify(u)); return u; }
        catch { return this.getCachedUser(); }
    },
    async updateMe(data) {
        const u = await this.req('PATCH', '/auth/me', data);
        localStorage.setItem('sf_user', JSON.stringify(u)); return u;
    },
    logout() { this.clearToken(); window.location = '/login'; },
    requireAuth() { if (!this.isLoggedIn()) { window.location = '/login'; return false; } return true; },

    // ── Forms ────────────────────────────────────────────────────────────
    getForms: () => DocmoAPI.req('GET', '/forms'),
    getForm: async id => {
        const r = await fetch('/api/forms/' + id);
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Form not found'); }
        return r.json();
    },
    createForm: data => DocmoAPI.req('POST', '/forms', data),
    updateForm: (id, data) => DocmoAPI.req('PATCH', '/forms/' + id, data),
    deleteForm: id => DocmoAPI.req('DELETE', '/forms/' + id),
    duplicateForm: id => DocmoAPI.req('POST', '/forms/' + id + '/duplicate'),
    setPublicAPI: (id, enabled) => DocmoAPI.req('PATCH', '/forms/' + id + '/public-api', { enabled }),

    // ── Responses ────────────────────────────────────────────────────────
    getResponses: formId => DocmoAPI.req('GET', formId ? '/responses?formId=' + formId : '/responses'),
    getFormResponses: formId => DocmoAPI.req('GET', '/forms/' + formId + '/responses'),

    // Submit (public) — works with service worker offline queueing
    submitResponse(formId, data, timeTakenSec = 0) {
        return fetch('/api/forms/' + formId + '/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-time-taken': String(timeTakenSec) },
            body: JSON.stringify(data)
        }).then(r => r.json()).then(d => {
            if (d.offline || d.queued) toast('Saved offline — will sync when reconnected', 'warning');
            return d;
        });
    },

    deleteResponse: id => DocmoAPI.req('DELETE', '/responses/' + id),
    clearResponses: formId => DocmoAPI.req('DELETE', '/responses?formId=' + formId),

    // ── Stats ─────────────────────────────────────────────────────────────
    getStats: () => DocmoAPI.req('GET', '/stats'),

    // ── Templates ─────────────────────────────────────────────────────────
    getTemplates: () => DocmoAPI.req('GET', '/templates'),

    // ── AI ────────────────────────────────────────────────────────────────
    generateForm: prompt => DocmoAPI.req('POST', '/ai/generate', { prompt }),
    analyzeResponses: (formTitle, responses) => DocmoAPI.req('POST', '/ai/analyze', { formTitle, responses }),
    getInsights: formId => DocmoAPI.req('GET', '/forms/' + formId + '/insights'),

    // ── Smart Transform ───────────────────────────────────────────────────
    transformData: (formId, formula, fieldName) => DocmoAPI.req('POST', '/forms/' + formId + '/transform', { formula, fieldName }),

    // ── Export ────────────────────────────────────────────────────────────
    exportDownload(formId, format, token) {
        const a = document.createElement('a');
        a.href = `/api/forms/${formId}/export/${format}?token=${token || this.getToken()}`;
        // Use fetch for authenticated download
        fetch(`/api/forms/${formId}/export/${format}`, { headers: this.headers() })
            .then(r => r.blob())
            .then(blob => {
                a.href = URL.createObjectURL(blob);
                const ext = { json: 'json', csv: 'csv', excel: 'csv', sql: 'sql', txt: 'txt' }[format] || format;
                a.download = `form_export.${ext}`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            });
    },
    // Legacy export routes
    exportCSV: formId => `/api/export/${formId}/csv`,
    exportJSON: formId => `/api/export/${formId}/json`,

    // ── QR Code ───────────────────────────────────────────────────────────
    getQRCode: formId => DocmoAPI.req('GET', '/forms/' + formId + '/qrcode'),

    // ── Automation ────────────────────────────────────────────────────────
    automation: {
        list: () => DocmoAPI.req('GET', '/automation'),
        create: data => DocmoAPI.req('POST', '/automation', data),
        update: (id, data) => DocmoAPI.req('PATCH', '/automation/' + id, data),
        delete: id => DocmoAPI.req('DELETE', '/automation/' + id),
        getLogs: id => DocmoAPI.req('GET', '/automation/' + id + '/logs'),
    },

    // ── Webhooks ──────────────────────────────────────────────────────────
    webhooks: {
        list: () => DocmoAPI.req('GET', '/webhooks'),
        create: data => DocmoAPI.req('POST', '/webhooks', data),
        delete: id => DocmoAPI.req('DELETE', '/webhooks/' + id),
    },

    // ── Public API ────────────────────────────────────────────────────────
    getPublicResponses: formId => fetch('/api/public/forms/' + formId + '/responses').then(r => r.json()),

    // ── Offline Sync ──────────────────────────────────────────────────────
    async syncOfflineQueue() {
        if (!('serviceWorker' in navigator)) return { synced: 0, failed: 0 };
        const sw = await navigator.serviceWorker.ready;
        return new Promise(resolve => {
            const ch = new MessageChannel();
            ch.port1.onmessage = e => resolve(e.data);
            sw.active?.postMessage({ type: 'MANUALLY_SYNC' }, [ch.port2]);
            setTimeout(() => resolve({ synced: 0, failed: 0 }), 3000);
        });
    },
    async getOfflineQueue() {
        if (!('serviceWorker' in navigator)) return [];
        const sw = await navigator.serviceWorker.ready;
        return new Promise(resolve => {
            const ch = new MessageChannel();
            ch.port1.onmessage = e => resolve(e.data?.queue || []);
            sw.active?.postMessage({ type: 'GET_QUEUE' }, [ch.port2]);
            setTimeout(() => resolve([]), 1000);
        });
    },

    // ── Admin ─────────────────────────────────────────────────────────────
    admin: {
        getStats: () => DocmoAPI.req('GET', '/admin/stats'),
        getUsers: () => DocmoAPI.req('GET', '/admin/users'),
        updateUser: (id, d) => DocmoAPI.req('PATCH', '/admin/users/' + id, d),
        deleteUser: id => DocmoAPI.req('DELETE', '/admin/users/' + id),
        getForms: () => DocmoAPI.req('GET', '/admin/forms'),
        getResponses: () => DocmoAPI.req('GET', '/admin/responses'),
        getActivity: (limit = 100) => DocmoAPI.req('GET', '/admin/activity?limit=' + limit),
    },

    // ── Helpers ───────────────────────────────────────────────────────────
    relTime(iso) {
        const d = Date.now() - new Date(iso).getTime();
        if (d < 60000) return 'just now'; if (d < 3600000) return Math.floor(d / 60000) + 'm ago';
        if (d < 86400000) return Math.floor(d / 3600000) + 'h ago'; return Math.floor(d / 86400000) + 'd ago';
    },
    escH: s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    escA: s => String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
};

// ── Global toast system ───────────────────────────────────────────────────
window.toast = function (msg, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) { container = document.createElement('div'); container.id = 'toast-container'; container.className = 'toast-container'; document.body.appendChild(container); }
    const icons = { success: '✓', error: '✕', info: 'i', warning: '!' };
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<div class="toast-icon">${icons[type] || 'i'}</div><div class="toast-msg">${DocmoAPI.escH(msg)}</div>`;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = '.3s'; setTimeout(() => t.remove(), 300); }, 4000);
};

// ── Service Worker Registration + Offline Notifications ──────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            await navigator.serviceWorker.register('/sw.js');
            navigator.serviceWorker.addEventListener('message', e => {
                if (e.data?.type === 'SUBMISSION_QUEUED')
                    toast(`Response saved offline (${e.data.count} queued)`, 'warning');
                if (e.data?.type === 'SYNC_COMPLETE' && e.data.synced > 0)
                    toast(`${e.data.synced} offline response(s) synced!`, 'success');
            });
        } catch (e) { console.log('SW registration failed:', e); }
    });
    // Trigger background sync when coming back online
    window.addEventListener('online', () => {
        toast('Back online! Syncing offline responses...', 'info');
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(sw => {
                if ('sync' in sw) sw.sync.register('sync-responses').catch(() => { });
                else sw.active?.postMessage({ type: 'MANUALLY_SYNC' });
            });
        }
    });
    window.addEventListener('offline', () => toast('You are offline. Responses will be queued.', 'warning'));
}
