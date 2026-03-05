/**
 * SnapyForm SaaS – Express.js Backend Server
 * REST API · JWT Auth · OpenAI Integration · Admin Dashboard
 * Run: node server.js  →  http://localhost:3000
 */

require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Global Error Handlers for Vercel Debugging
process.on('uncaughtException', (err) => {
    console.error('[Vercel Error] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Vercel Error] Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const PORT = process.env.PORT || 3000;

// ── Environment Configuration ───────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'snapyform_secret_2026';
const OPENAI_KEY = process.env.OPENAI_KEY || '';
const NODE_VERSION_ENV = process.env.NODE_VERSION || '20.x';

// Validate Environment
if (!process.env.JWT_SECRET) {
    console.warn('[Vercel Config] JWT_SECRET is missing. Using default for dev only.');
}
if (!process.env.OPENAI_KEY) {
    console.warn('[Vercel Config] OPENAI_KEY is missing. AI features will fail at runtime.');
}

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Data Layer ───────────────────────────────────────────────────────────────
const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const DATA = isVercel ? '/tmp/data' : path.join(__dirname, 'data');
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
const UPLOADS = isVercel ? '/tmp/uploads' : path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

function readDB(col) {
    try {
        const file = path.join(DATA, col + '.json');
        if (!fs.existsSync(file)) {
            const s = seed(col);
            try {
                fs.writeFileSync(file, JSON.stringify(s, null, 2));
            } catch (e) {
                console.error(`[DB Error] Failed to write seed for ${col}:`, e.message);
            }
            return s;
        }
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.error(`[DB Error] Failed to read ${col}:`, error.message);
        return [];
    }
}
function writeDB(col, data) {
    try {
        fs.writeFileSync(path.join(DATA, col + '.json'), JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`[DB Error] Failed to write ${col}:`, error.message);
    }
}

// Activity logger
function logActivity(action, userId, meta = {}) {
    const logs = readDB('activity');
    logs.unshift({ id: 'log_' + Date.now(), action, userId, meta, timestamp: new Date().toISOString() });
    writeDB('activity', logs.slice(0, 500)); // keep last 500
}

function seed(col) {
    if (col === 'users') {
        return [
            {
                id: 'user_admin', name: 'Admin', email: 'info.elumugam@gmail.com',
                password: bcrypt.hashSync('ADMINELUMUGAM', 10),
                plan: 'Enterprise', avatar: 'AD', theme: 'dark', isAdmin: true,
                isBlocked: false, createdAt: new Date().toISOString()
            },
            {
                id: 'user_demo', name: 'John Smith', email: 'demo@snapyform.com',
                password: bcrypt.hashSync('demo1234', 10),
                plan: 'Pro', avatar: 'JS', theme: 'dark', isAdmin: false,
                isBlocked: false, createdAt: new Date().toISOString()
            }
        ];
    }
    if (col === 'forms') {
        return [{
            id: 'form_demo1', userId: 'user_demo',
            title: 'Customer Feedback Survey', description: 'Help us improve your experience',
            status: 'active', icon: '★', responseCount: 2,
            shareLink: 'customer-feedback-demo', allowAnonymous: true, showProgress: true,
            createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
            updatedAt: new Date(Date.now() - 3600000).toISOString(),
            fields: [
                { id: 'f1', type: 'text', label: 'Full Name', required: true, placeholder: 'Enter your name' },
                { id: 'f2', type: 'email', label: 'Email Address', required: true, placeholder: 'you@company.com' },
                { id: 'f3', type: 'rating', label: 'Overall Rating', required: true },
                { id: 'f4', type: 'radio', label: 'How did you find us?', required: false, options: ['Search engine', 'Social media', 'Referral', 'Advertisement'] },
                { id: 'f5', type: 'paragraph', label: 'Additional Comments', required: false, placeholder: 'Share your thoughts...' }
            ]
        }];
    }
    if (col === 'responses') {
        return [
            { id: 'resp_1', formId: 'form_demo1', submittedAt: new Date(Date.now() - 3600000).toISOString(), timeTakenSec: 142, data: { 'Full Name': 'Alice Johnson', 'Email Address': 'alice@company.com', 'Overall Rating': '5', 'How did you find us?': 'Search engine', 'Additional Comments': 'Excellent platform! Very intuitive.' } },
            { id: 'resp_2', formId: 'form_demo1', submittedAt: new Date(Date.now() - 7200000).toISOString(), timeTakenSec: 98, data: { 'Full Name': 'Bob Kumar', 'Email Address': 'bob@example.com', 'Overall Rating': '4', 'How did you find us?': 'Referral' } }
        ];
    }
    if (col === 'activity') { return []; }
    if (col === 'webhooks') { return []; }
    if (col === 'templates') {
        return [
            { id: 'tpl_1', title: 'Customer Feedback', description: 'Collect customer reviews and satisfaction ratings', icon: '⭐', category: 'Business', fields: [{ id: 't1', type: 'text', label: 'Name', required: true, placeholder: 'Your name' }, { id: 't2', type: 'email', label: 'Email', required: true }, { id: 't3', type: 'rating', label: 'Overall experience', required: true }, { id: 't4', type: 'paragraph', label: 'Feedback', required: false }] },
            { id: 'tpl_2', title: 'Job Application', description: 'Professional job application with experience fields', icon: '💼', category: 'HR', fields: [{ id: 't1', type: 'text', label: 'Full Name', required: true }, { id: 't2', type: 'email', label: 'Email', required: true }, { id: 't3', type: 'phone', label: 'Phone', required: false }, { id: 't4', type: 'dropdown', label: 'Position Applied For', required: true, options: ['Software Engineer', 'Designer', 'Product Manager', 'Marketing'] }, { id: 't5', type: 'paragraph', label: 'Cover Letter', required: false }] },
            { id: 'tpl_3', title: 'Event Registration', description: 'Collect registrations for events and conferences', icon: '📅', category: 'Events', fields: [{ id: 't1', type: 'text', label: 'Full Name', required: true }, { id: 't2', type: 'email', label: 'Email', required: true }, { id: 't3', type: 'radio', label: 'Ticket Type', required: true, options: ['Standard', 'VIP', 'Online Only'] }, { id: 't4', type: 'number', label: 'Number of attendees', required: false }] },
            { id: 'tpl_4', title: 'Contact Form', description: 'Simple contact enquiry form for your website', icon: '✉️', category: 'General', fields: [{ id: 't1', type: 'text', label: 'Name', required: true }, { id: 't2', type: 'email', label: 'Email', required: true }, { id: 't3', type: 'text', label: 'Subject', required: true }, { id: 't4', type: 'paragraph', label: 'Message', required: true }] },
            { id: 'tpl_5', title: 'Product Survey', description: 'Collect product feedback and NPS scores', icon: '📊', category: 'Business', fields: [{ id: 't1', type: 'rating', label: 'Product rating', required: true }, { id: 't2', type: 'radio', label: 'Would you recommend?', required: true, options: ['Definitely yes', 'Probably yes', 'Probably not', 'Definitely not'] }, { id: 't3', type: 'paragraph', label: 'What can we improve?', required: false }] },
            { id: 'tpl_6', title: 'Support Ticket', description: 'Allow users to submit support requests', icon: '🎫', category: 'Support', fields: [{ id: 't1', type: 'text', label: 'Name', required: true }, { id: 't2', type: 'email', label: 'Email', required: true }, { id: 't3', type: 'dropdown', label: 'Issue Category', required: true, options: ['Billing', 'Technical', 'Account', 'Feature Request', 'Other'] }, { id: 't4', type: 'paragraph', label: 'Describe your issue', required: true }] },
            { id: 'tpl_7', title: 'Lead Generation', description: 'Capture potential customer leads', icon: '🎯', category: 'Marketing', fields: [{ id: 't1', type: 'text', label: 'Company Name', required: true }, { id: 't2', type: 'text', label: 'Contact Person', required: true }, { id: 't3', type: 'email', label: 'Business Email', required: true }, { id: 't4', type: 'dropdown', label: 'Interest', required: true, options: ['Product A', 'Product B', 'Service C', 'Partnership'] }, { id: 't5', type: 'paragraph', label: 'Notes', required: false }] }
        ];
    }
    return [];
}

// Mock Email System
function mockEmail(to, subject, body) {
    console.log(`[Mock Email] To: ${to} | Subject: ${subject} | Body Snippet: ${body.slice(0, 100)}...`);
}

// ── Auth Middleware ──────────────────────────────────────────────────────────
function auth(req, res, next) {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Unauthorized' });
    try { req.user = jwt.verify(h.slice(7), JWT_SECRET); next(); }
    catch { res.status(401).json({ success: false, error: 'Invalid token' }); }
}

function adminAuth(req, res, next) {
    auth(req, res, () => {
        const u = readDB('users').find(u => u.id === req.user.id);
        if (!u?.isAdmin || u.email !== 'info.elumugam@gmail.com') return res.status(403).json({ success: false, error: 'Admin only access' });
        next();
    });
}

// Helpers
function slug(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40); }
function relTime(iso) { const d = Date.now() - new Date(iso).getTime(); if (d < 60000) return 'just now'; if (d < 3600000) return Math.floor(d / 60000) + 'm ago'; if (d < 86400000) return Math.floor(d / 3600000) + 'h ago'; return Math.floor(d / 86400000) + 'd ago'; }
function safeUser(u) { const { password: _, ...safe } = u; return safe; }

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  AUTH ROUTES                                                          ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ success: false, error: 'All fields required' });
        if (password.length < 6) return res.status(400).json({ success: false, error: 'Password min 6 chars' });
        const users = readDB('users');
        if (users.find(u => u.email === email)) return res.status(409).json({ success: false, error: 'Email already registered' });
        const p = name.split(' ');
        const user = {
            id: 'user_' + uuidv4().replace(/-/g, '').slice(0, 10),
            name, firstName: p[0], lastName: p.slice(1).join(' '),
            email, password: await bcrypt.hash(password, 10),
            plan: 'Free', avatar: (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase(),
            theme: 'dark', isAdmin: false, isBlocked: false,
            createdAt: new Date().toISOString()
        };
        users.push(user);
        writeDB('users', users);
        logActivity('user_register', user.id, { email });
        const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ success: true, token, user: safeUser(user) });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, error: 'Internal server error during registration' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = readDB('users');
        const user = users.find(u => u.email === email);
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ success: false, error: 'Invalid credentials' });
        if (user.isBlocked) return res.status(403).json({ success: false, error: 'Account suspended. Contact support.' });
        logActivity('user_login', user.id, { email });
        const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ success: true, token, user: safeUser(user) });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Internal server error during login' });
    }
});

app.get('/api/auth/me', auth, (req, res) => {
    try {
        const u = readDB('users').find(u => u.id === req.user.id);
        if (!u) return res.status(404).json({ success: false, error: 'User not found' });
        res.json(safeUser(u));
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve profile' });
    }
});

app.patch('/api/auth/me', auth, async (req, res) => {
    try {
        const users = readDB('users');
        const idx = users.findIndex(u => u.id === req.user.id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'Not found' });
        const { password, newPassword, ...rest } = req.body;
        if (newPassword) {
            if (!password || !(await bcrypt.compare(password, users[idx].password)))
                return res.status(401).json({ success: false, error: 'Current password incorrect' });
            users[idx].password = await bcrypt.hash(newPassword, 10);
        }
        users[idx] = { ...users[idx], ...rest, id: users[idx].id, isAdmin: users[idx].isAdmin, updatedAt: new Date().toISOString() };
        writeDB('users', users);
        res.json(safeUser(users[idx]));
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, error: 'Internal server error during profile update' });
    }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  FORMS ROUTES                                                         ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.get('/api/forms', auth, (req, res) => {
    try {
        res.json(readDB('forms').filter(f => f.userId === req.user.id));
    } catch (error) {
        console.error('List forms error:', error);
        res.status(500).json({ success: false, error: 'Failed to list forms' });
    }
});

app.get('/api/forms/:id', (req, res) => {
    try {
        const f = readDB('forms').find(f => f.id === req.params.id);
        if (!f) return res.status(404).json({ success: false, error: 'Form not found' });
        res.json(f);
    } catch (error) {
        console.error('Get form error:', error);
        res.status(500).json({ success: false, error: 'Failed to load form' });
    }
});

app.post('/api/forms', auth, (req, res) => {
    try {
        const forms = readDB('forms');
        const { title = 'Untitled Form', description = '', fields = [], icon = '◻', status = 'draft', ...rest } = req.body;
        const form = {
            id: 'form_' + uuidv4().replace(/-/g, '').slice(0, 12),
            userId: req.user.id, title, description, fields, icon, status,
            shareLink: slug(title) + '-' + Math.random().toString(36).slice(2, 7),
            allowAnonymous: true, showProgress: true, responseCount: 0,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...rest
        };
        forms.unshift(form);
        writeDB('forms', forms);
        logActivity('form_created', req.user.id, { formId: form.id, title });
        res.status(201).json({ success: true, ...form });
    } catch (error) {
        console.error('Create form error:', error);
        res.status(500).json({ success: false, error: 'Failed to create form' });
    }
});

app.patch('/api/forms/:id', auth, (req, res) => {
    try {
        const forms = readDB('forms');
        const idx = forms.findIndex(f => f.id === req.params.id && f.userId === req.user.id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'Form not found' });
        forms[idx] = { ...forms[idx], ...req.body, id: forms[idx].id, userId: forms[idx].userId, updatedAt: new Date().toISOString() };
        writeDB('forms', forms);
        res.json(forms[idx]);
    } catch (error) {
        console.error('Update form error:', error);
        res.status(500).json({ success: false, error: 'Failed to update form' });
    }
});

app.delete('/api/forms/:id', auth, (req, res) => {
    try {
        let forms = readDB('forms');
        const f = forms.find(f => f.id === req.params.id && f.userId === req.user.id);
        if (!f) return res.status(404).json({ success: false, error: 'Form not found' });
        writeDB('forms', forms.filter(f => f.id !== req.params.id));
        writeDB('responses', readDB('responses').filter(r => r.formId !== req.params.id));
        logActivity('form_deleted', req.user.id, { formId: req.params.id, title: f.title });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete form error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete form' });
    }
});

app.post('/api/forms/:id/duplicate', auth, (req, res) => {
    try {
        const forms = readDB('forms');
        const orig = forms.find(f => f.id === req.params.id && f.userId === req.user.id);
        if (!orig) return res.status(404).json({ success: false, error: 'Form not found' });
        const copy = { ...JSON.parse(JSON.stringify(orig)), id: 'form_' + uuidv4().replace(/-/g, '').slice(0, 12), title: orig.title + ' (Copy)', shareLink: slug(orig.title) + '-' + Math.random().toString(36).slice(2, 7), responseCount: 0, status: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        forms.unshift(copy);
        writeDB('forms', forms);
        res.status(201).json(copy);
    } catch (error) {
        console.error('Duplicate form error:', error);
        res.status(500).json({ success: false, error: 'Failed to duplicate form' });
    }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  RESPONSES ROUTES                                                     ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.get('/api/responses', auth, (req, res) => {
    try {
        let responses = readDB('responses');
        if (req.query.formId) {
            const form = readDB('forms').find(f => f.id === req.query.formId && f.userId === req.user.id);
            if (!form) return res.status(403).json({ success: false, error: 'Forbidden' });
            responses = responses.filter(r => r.formId === req.query.formId);
        } else {
            const ids = new Set(readDB('forms').filter(f => f.userId === req.user.id).map(f => f.id));
            responses = responses.filter(r => ids.has(r.formId));
        }
        res.json(responses);
    } catch (error) {
        console.error('List responses error:', error);
        res.status(500).json({ success: false, error: 'Failed to list responses' });
    }
});

app.post('/api/responses', (req, res) => {
    try {
        const { formId, data } = req.body;
        if (!formId || !data) return res.status(400).json({ success: false, error: 'formId and data required' });
        const form = readDB('forms').find(f => f.id === formId);
        if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
        if (form.status === 'closed') return res.status(403).json({ success: false, error: 'Form is closed' });
        const responses = readDB('responses');
        const r = { id: 'resp_' + uuidv4().replace(/-/g, '').slice(0, 12), formId, data, submittedAt: new Date().toISOString(), timeTakenSec: req.body.timeTakenSec || 0 };
        responses.unshift(r);
        writeDB('responses', responses);
        const forms = readDB('forms');
        const fi = forms.findIndex(f => f.id === formId);
        if (fi !== -1) { forms[fi].responseCount = (forms[fi].responseCount || 0) + 1; writeDB('forms', forms); }

        // Notify owner
        const owner = readDB('users').find(u => u.id === form.userId);
        if (owner) {
            const summary = Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n');
            mockEmail(owner.email, `New Response: ${form.title}`, `You received a new submission for your form "${form.title}".\n\nSummary:\n${summary}`);
        }

        logActivity('response_submitted', form.userId, { formId, responseId: r.id });
        res.status(201).json({ success: true, ...r });
    } catch (error) {
        console.error('Create response error:', error);
        res.status(500).json({ success: false, error: 'Failed to save response' });
    }
});

// Alias for responses/create
app.post('/api/responses/create', (req, res) => {
    res.redirect(307, '/api/responses');
});

app.delete('/api/responses/:id', auth, (req, res) => {
    try {
        const responses = readDB('responses');
        const r = responses.find(r => r.id === req.params.id);
        if (!r) return res.status(404).json({ success: false, error: 'Response not found' });
        const form = readDB('forms').find(f => f.id === r.formId && f.userId === req.user.id);
        if (!form) return res.status(403).json({ success: false, error: 'Forbidden' });
        writeDB('responses', responses.filter(r => r.id !== req.params.id));
        const forms = readDB('forms');
        const fi = forms.findIndex(f => f.id === r.formId);
        if (fi !== -1) { forms[fi].responseCount = Math.max(0, (forms[fi].responseCount || 1) - 1); writeDB('forms', forms); }
        res.json({ success: true });
    } catch (error) {
        console.error('Delete response error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete response' });
    }
});

app.delete('/api/responses', auth, (req, res) => {
    try {
        const { formId } = req.query;
        const form = readDB('forms').find(f => f.id === formId && f.userId === req.user.id);
        if (!form) return res.status(403).json({ success: false, error: 'Forbidden' });
        writeDB('responses', readDB('responses').filter(r => r.formId !== formId));
        const forms = readDB('forms');
        const fi = forms.findIndex(f => f.id === formId);
        if (fi !== -1) { forms[fi].responseCount = 0; writeDB('forms', forms); }
        res.json({ success: true });
    } catch (error) {
        console.error('Clear responses error:', error);
        res.status(500).json({ success: false, error: 'Failed to clear responses' });
    }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  STATS                                                                ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.get('/api/stats', auth, (req, res) => {
    try {
        const forms = readDB('forms').filter(f => f.userId === req.user.id);
        const responses = readDB('responses').filter(r => forms.find(f => f.id === r.formId));
        const today = responses.filter(r => (Date.now() - new Date(r.submittedAt)) < 86400000).length;
        const week = responses.filter(r => (Date.now() - new Date(r.submittedAt)) < 7 * 86400000).length;
        res.json({
            totalForms: forms.length,
            totalResponses: forms.reduce((s, f) => s + (f.responseCount || 0), 0),
            activeForms: forms.filter(f => f.status === 'active').length,
            responsesToday: today, responsesThisWeek: week,
            lastResponse: responses[0] ? relTime(responses[0].submittedAt) : 'Never'
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve stats' });
    }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  TEMPLATES                                                            ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.get('/api/templates', (req, res) => {
    try {
        res.json(readDB('templates'));
    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({ success: false, error: 'Failed to load templates' });
    }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  AI (OpenAI)                                                          ║
// ╚═══════════════════════════════════════════════════════════════════════╝
async function openAICall(messages, maxTokens = 1500) {
    const https = require('https');
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: maxTokens, temperature: 0.7 });
        const req = https.request({ hostname: 'api.openai.com', path: '/v1/chat/completions', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Length': Buffer.byteLength(body) } }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

app.post('/api/ai/generate', auth, async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt required' });
    try {
        const result = await openAICall([{ role: 'system', content: 'You are a form builder AI. Given a description, generate a JSON form with title, description, and fields array. Each field has: id (unique string), type (text/email/phone/number/paragraph/date/dropdown/radio/checkbox/rating/file), label, required (bool), placeholder (optional), options (array for dropdown/radio/checkbox only). Return ONLY valid JSON, no markdown.' }, { role: 'user', content: `Create a form for: ${prompt}` }], 1200);
        const text = result.choices?.[0]?.message?.content || '{}';
        const json = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
        logActivity('ai_generate', req.user.id, { prompt: prompt.slice(0, 60) });
        res.json({ success: true, ...json });
    } catch (e) { res.status(500).json({ success: false, error: 'AI generation failed: ' + e.message }); }
});

app.post('/api/ai/analyze', auth, async (req, res) => {
    const { formTitle, responses: data } = req.body;
    if (!data?.length) return res.status(400).json({ success: false, error: 'No responses to analyze' });
    try {
        const sample = data.slice(0, 30).map(r => r.data);
        const result = await openAICall([{ role: 'system', content: 'You are a data analyst. Analyze form responses and give a JSON report with: summary (string), sentimentScore (0-100), insights (string[]), commonThemes (string[]), recommendations (string[]). Return ONLY valid JSON.' }, { role: 'user', content: `Form: "${formTitle}"\nResponses: ${JSON.stringify(sample)}` }], 1000);
        const text = result.choices?.[0]?.message?.content || '{}';
        const json = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
        res.json({ success: true, ...json });
    } catch (e) { res.status(500).json({ success: false, error: 'AI analysis failed: ' + e.message }); }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  EXPORT (server-side CSV/JSON streams)                                ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.get('/api/export/:formId/json', auth, (req, res) => {
    try {
        const form = readDB('forms').find(f => f.id === req.params.formId && f.userId === req.user.id);
        if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
        const responses = readDB('responses').filter(r => r.formId === req.params.formId);
        logActivity('export', req.user.id, { formId: req.params.formId, format: 'json' });
        res.attachment(form.title.replace(/[^a-z0-9]/gi, '_') + '.json');
        res.json({ form: { title: form.title, description: form.description }, responses: responses.map(r => ({ id: r.id, submittedAt: r.submittedAt, data: r.data })) });
    } catch (error) {
        console.error('Export JSON error:', error);
        res.status(500).json({ success: false, error: 'Failed to export JSON' });
    }
});

app.get('/api/export/:formId/csv', auth, (req, res) => {
    try {
        const form = readDB('forms').find(f => f.id === req.params.formId && f.userId === req.user.id);
        if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
        const responses = readDB('responses').filter(r => r.formId === req.params.formId);
        const fields = form.fields || [];
        const headers = ['Response ID', 'Submitted At', ...fields.map(f => f.label)];
        const rows = responses.map(r => [r.id, new Date(r.submittedAt).toLocaleString(), ...fields.map(f => JSON.stringify(r.data?.[f.label] || ''))]);
        logActivity('export', req.user.id, { formId: req.params.formId, format: 'csv' });
        res.attachment(form.title.replace(/[^a-z0-9]/gi, '_') + '.csv');
        res.type('text/csv').send([headers.join(','), ...rows.map(r => r.join(','))].join('\n'));
    } catch (error) {
        console.error('Export CSV error:', error);
        res.status(500).json({ success: false, error: 'Failed to export CSV' });
    }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  ADMIN ROUTES                                                         ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.get('/api/admin/stats', adminAuth, (req, res) => {
    try {
        const users = readDB('users');
        const forms = readDB('forms');
        const responses = readDB('responses');
        const activity = readDB('activity');

        const today = (arr, f) => arr.filter(x => (Date.now() - new Date(x[f]).getTime()) < 86400000).length;

        // Past 30 days data for charts
        const getDailyTrend = (arr, dateField) => {
            const days = {};
            for (let i = 0; i < 30; i++) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const ds = date.toISOString().split('T')[0];
                days[ds] = 0;
            }
            arr.forEach(x => {
                const ds = new Date(x[dateField]).toISOString().split('T')[0];
                if (days[ds] !== undefined) days[ds]++;
            });
            return Object.entries(days).sort().map(([date, count]) => ({ date, count }));
        };

        res.json({
            totalUsers: users.length,
            totalForms: forms.length,
            totalResponses: responses.length,
            activeUsers: users.filter(u => !u.isBlocked).length,
            blockedUsers: users.filter(u => u.isBlocked).length,
            formsToday: today(forms, 'createdAt'),
            responsesToday: today(responses, 'submittedAt'),
            activityToday: today(activity, 'timestamp'),
            planBreakdown: {
                free: users.filter(u => u.plan === 'Free').length,
                pro: users.filter(u => u.plan === 'Pro').length,
                enterprise: users.filter(u => u.plan === 'Enterprise').length
            },
            trends: {
                users: getDailyTrend(users, 'createdAt'),
                forms: getDailyTrend(forms, 'createdAt'),
                responses: getDailyTrend(responses, 'submittedAt')
            }
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve admin stats' });
    }
});

app.get('/api/admin/users', adminAuth, (req, res) => {
    try {
        const users = readDB('users').map(u => {
            const uForms = readDB('forms').filter(f => f.userId === u.id);
            const uResp = readDB('responses').filter(r => uForms.find(f => f.id === r.formId));
            return { ...safeUser(u), formCount: uForms.length, responseCount: uResp.length };
        });
        res.json(users);
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve users' });
    }
});

app.patch('/api/admin/users/:id', adminAuth, (req, res) => {
    try {
        const users = readDB('users');
        const idx = users.findIndex(u => u.id === req.params.id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'User not found' });
        const { isBlocked, plan, isAdmin } = req.body;
        if (isBlocked !== undefined) users[idx].isBlocked = isBlocked;
        if (plan) users[idx].plan = plan;
        if (isAdmin !== undefined && req.user.id !== req.params.id) users[idx].isAdmin = isAdmin;
        writeDB('users', users);
        logActivity('admin_user_update', req.user.id, { targetId: req.params.id, changes: req.body });
        res.json(safeUser(users[idx]));
    } catch (error) {
        console.error('Admin update user error:', error);
        res.status(500).json({ success: false, error: 'Failed to update user' });
    }
});

app.delete('/api/admin/users/:id', adminAuth, (req, res) => {
    try {
        if (req.params.id === req.user.id) return res.status(400).json({ success: false, error: 'Cannot delete yourself' });
        const users = readDB('users');
        const u = users.find(u => u.id === req.params.id);
        if (!u) return res.status(404).json({ success: false, error: 'User not found' });
        writeDB('users', users.filter(u => u.id !== req.params.id));
        // Also delete their forms and responses
        const forms = readDB('forms').filter(f => f.userId !== req.params.id);
        const formIds = new Set(forms.map(f => f.id));
        writeDB('forms', forms);
        writeDB('responses', readDB('responses').filter(r => formIds.has(r.formId)));
        logActivity('admin_user_delete', req.user.id, { targetId: req.params.id, email: u.email });
        res.json({ success: true });
    } catch (error) {
        console.error('Admin delete user error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
});

app.get('/api/admin/forms', adminAuth, (req, res) => {
    try {
        const forms = readDB('forms');
        const users = readDB('users');
        res.json(forms.map(f => {
            const u = users.find(u => u.id === f.userId);
            return { ...f, ownerName: u?.name || 'Unknown', ownerEmail: u?.email || '—' };
        }));
    } catch (error) {
        console.error('Admin forms error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve forms' });
    }
});

app.get('/api/admin/responses', adminAuth, (req, res) => {
    try {
        const responses = readDB('responses');
        const forms = readDB('forms');
        res.json(responses.slice(0, 200).map(r => {
            const f = forms.find(f => f.id === r.formId);
            return { ...r, formTitle: f?.title || 'Deleted Form' };
        }));
    } catch (error) {
        console.error('Admin responses error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve responses' });
    }
});

app.get('/api/admin/activity', adminAuth, (req, res) => {
    try {
        const logs = readDB('activity');
        const users = readDB('users');
        const limit = parseInt(req.query.limit) || 100;
        res.json(logs.slice(0, limit).map(l => {
            const u = users.find(u => u.id === l.userId);
            return { ...l, userName: u?.name || 'Unknown', userEmail: u?.email || '—' };
        }));
    } catch (error) {
        console.error('Admin activity error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve activity' });
    }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  RATE LIMITING                                                        ║
// ╚═══════════════════════════════════════════════════════════════════════╝
const rateLimitMap = new Map();
function rateLimit(maxReq, windowMs) {
    return (req, res, next) => {
        const key = req.ip + ':' + req.path;
        const now = Date.now();
        const entry = rateLimitMap.get(key) || { count: 0, start: now };
        if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
        entry.count++;
        rateLimitMap.set(key, entry);
        if (entry.count > maxReq) return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
        next();
    };
}
// Apply rate limit to all API routes: 200 req/min per IP
app.use('/api/', rateLimit(200, 60000));
// Stricter rate limit for public form submission: 30/min
app.use('/api/forms/:id/submit', rateLimit(30, 60000));
// Stricter for AI endpoints: 20/min
app.use('/api/ai/', rateLimit(20, 60000));

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  DEDICATED SUBMIT ENDPOINT  POST /api/forms/:formId/submit           ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.post('/api/forms/:formId/submit', (req, res) => {
    try {
        const formId = req.params.formId;
        const data = req.body;
        if (!data || !Object.keys(data).length) return res.status(400).json({ success: false, error: 'Response data required' });
        const form = readDB('forms').find(f => f.id === formId);
        if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
        if (form.status === 'closed') return res.status(403).json({ success: false, error: 'This form is no longer accepting responses' });
        const responses = readDB('responses');
        const r = {
            id: 'resp_' + uuidv4().replace(/-/g, '').slice(0, 12),
            formId, data,
            submittedAt: new Date().toISOString(),
            timeTakenSec: req.headers['x-time-taken'] ? parseInt(req.headers['x-time-taken']) : 0,
            ip: req.ip, userAgent: req.headers['user-agent'] || ''
        };
        responses.unshift(r);
        writeDB('responses', responses);
        const forms = readDB('forms');
        const fi = forms.findIndex(f => f.id === formId);
        if (fi !== -1) { forms[fi].responseCount = (forms[fi].responseCount || 0) + 1; writeDB('forms', forms); }
        logActivity('response_submitted', form.userId, { formId, responseId: r.id });
        // Check automations
        checkAutomations(formId, r);
        res.status(201).json({ success: true, responseId: r.id, message: 'Response submitted successfully' });
    } catch (error) {
        console.error('Submit form error:', error);
        res.status(500).json({ success: false, error: 'Failed to submit response' });
    }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  PER-FORM RESPONSES  GET /api/forms/:id/responses                   ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.get('/api/forms/:id/responses', auth, (req, res) => {
    try {
        const form = readDB('forms').find(f => f.id === req.params.id && f.userId === req.user.id);
        if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
        const responses = readDB('responses').filter(r => r.formId === req.params.id);
        res.json({ form: { id: form.id, title: form.title }, total: responses.length, responses });
    } catch (error) {
        console.error('Get form responses error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve responses' });
    }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  AI INSIGHTS  GET /api/forms/:id/insights                           ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.get('/api/forms/:id/insights', auth, async (req, res) => {
    const form = readDB('forms').find(f => f.id === req.params.id && f.userId === req.user.id);
    if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
    const responses = readDB('responses').filter(r => r.formId === req.params.id);
    if (!responses.length) return res.json({ success: true, summary: 'No responses yet', sentimentScore: 0, insights: [], commonThemes: [], recommendations: [] });
    try {
        const sample = responses.slice(0, 30).map(r => r.data);
        const result = await openAICall([
            { role: 'system', content: 'You are a data analyst. Analyze form responses and return a JSON report with: summary (string), sentimentScore (number 0-100, where 100 is most positive), insights (string[]), commonThemes (string[]), recommendations (string[]), common_feedback (string). Return ONLY valid JSON.' },
            { role: 'user', content: `Form: "${form.title}"\nTotal responses: ${responses.length}\nSample data: ${JSON.stringify(sample)}` }
        ], 1000);
        const text = result.choices?.[0]?.message?.content || '{}';
        const json = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
        res.json({ success: true, ...json, sentiment_score: (json.sentimentScore || 0) / 100, formId: req.params.id, analyzedAt: new Date().toISOString(), totalResponses: responses.length });
    } catch (e) { res.status(500).json({ success: false, error: 'AI insights failed: ' + e.message }); }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  SMART DATA TRANSFORMATION  POST /api/forms/:id/transform           ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.post('/api/forms/:id/transform', auth, (req, res) => {
    try {
        const form = readDB('forms').find(f => f.id === req.params.id && f.userId === req.user.id);
        if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
        const { formula, fieldName } = req.body;
        if (!formula) return res.status(400).json({ success: false, error: 'formula is required. Example: "full_name = first_name + \" \" + last_name"' });
        const responses = readDB('responses').filter(r => r.formId === req.params.id);
        const results = [];
        const transformErrors = [];
        // Simple formula parser: support field concatenation, addition, subtraction, string ops
        const parseFormula = (formula, data) => {
            try {
                // Replace field names with their values for safe eval
                const keys = Object.keys(data);
                let expr = formula;
                // Extract target field (left of =)
                const eqIdx = expr.indexOf('=');
                if (eqIdx === -1) return { error: 'Invalid formula, must be: target = expression' };
                const target = expr.slice(0, eqIdx).trim().replace(/\s+/g, '_');
                let exprStr = expr.slice(eqIdx + 1).trim();
                // Replace data field refs with values
                keys.forEach(k => {
                    const safe = (data[k] || '').toString();
                    exprStr = exprStr.replace(new RegExp('\\b' + k.replace(/\s/g, '_') + '\\b', 'g'), JSON.stringify(safe));
                });
                // Allow only safe operations: strings, numbers, +, -, *, /, ()
                if (/[^a-zA-Z0-9_\s"'+\-*/().,'`]/.test(exprStr)) return { error: 'Formula contains unsafe characters' };
                const value = Function('"use strict"; return (' + exprStr + ')')();
                return { target, value };
            } catch (e) { return { error: e.message }; }
        };
        responses.forEach(r => {
            const result = parseFormula(formula, r.data || {});
            if (result.error) { transformErrors.push({ responseId: r.id, error: result.error }); return; }
            results.push({ responseId: r.id, fieldName: fieldName || result.target, value: result.value });
        });
        // Optionally store transform results in form
        const forms = readDB('forms');
        const fi = forms.findIndex(f => f.id === req.params.id);
        if (fi !== -1) {
            forms[fi].transforms = forms[fi].transforms || [];
            forms[fi].transforms.push({ formula, appliedAt: new Date().toISOString(), resultCount: results.length });
            writeDB('forms', forms);
        }
        logActivity('transform', req.user.id, { formId: req.params.id, formula: formula.slice(0, 60) });
        res.json({ success: true, formula, processed: responses.length, results, errors: transformErrors });
    } catch (error) {
        console.error('Transform error:', error);
        res.status(500).json({ success: false, error: 'Failed to apply transformation' });
    }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  WORKFLOW AUTOMATION ENGINE                                          ║
// ╚═══════════════════════════════════════════════════════════════════════╝
function checkAutomations(formId, response) {
    try {
        const automations = readDB('automations').filter(a => a.formId === formId && a.active !== false);
        automations.forEach(auto => {
            try {
                if (evaluateCondition(auto.condition, response.data)) {
                    executeAction(auto.action, response, auto);
                    const logs = readDB('automation_logs') || [];
                    logs.unshift({ id: 'alog_' + Date.now(), automationId: auto.id, formId, responseId: response.id, action: auto.action, triggeredAt: new Date().toISOString() });
                    writeDB('automation_logs', logs.slice(0, 1000));
                }
            } catch (e) { console.error('Automation error:', e.message); }
        });
    } catch (e) { /* no automations, skip */ }
}

function evaluateCondition(condition, data) {
    if (!condition) return true;
    // Support: "field operator value" e.g. "rating < 3", "status = approved", "score >= 80"
    const match = condition.match(/^(.+?)\s*(==|!=|>=|<=|>|<|=|contains|startsWith)\s*(.+)$/i);
    if (!match) return false;
    const [, field, op, expected] = match.map(s => s?.trim());
    const actual = String(data?.[field] || data?.[field.replace(/_/g, ' ')] || '');
    const exp = expected.replace(/^['"]|['"]$/g, '');
    const numA = parseFloat(actual), numE = parseFloat(exp);
    const useNum = !isNaN(numA) && !isNaN(numE);
    switch (op.toLowerCase()) {
        case '=': case '==': return actual.toLowerCase() === exp.toLowerCase();
        case '!=': return actual.toLowerCase() !== exp.toLowerCase();
        case '>': return useNum && numA > numE;
        case '<': return useNum && numA < numE;
        case '>=': return useNum && numA >= numE;
        case '<=': return useNum && numA <= numE;
        case 'contains': return actual.toLowerCase().includes(exp.toLowerCase());
        case 'startswith': return actual.toLowerCase().startsWith(exp.toLowerCase());
        default: return false;
    }
}

function executeAction(action, response, automation) {
    // Log the action — in production you'd send emails, call webhooks, etc.
    const logEntry = { action, responseId: response.id, formId: response.formId, executedAt: new Date().toISOString(), meta: automation.meta || {} };
    console.log('[Automation]', JSON.stringify(logEntry));
    if (action === 'webhook' && automation.webhookUrl) {
        const https = require('https');
        const http = require('http');
        const url = new URL(automation.webhookUrl);
        const body = JSON.stringify({ event: 'form_response', response, automation: { id: automation.id, name: automation.name } });
        const opts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
        const req = (url.protocol === 'https:' ? https : http).request(opts);
        req.on('error', () => { });
        req.write(body);
        req.end();
    }
}

// Automation CRUD
app.get('/api/automation', auth, (req, res) => {
    try {
        const automations = readDB('automations').filter(a => {
            const form = readDB('forms').find(f => f.id === a.formId);
            return form?.userId === req.user.id;
        });
        res.json(automations);
    } catch (error) {
        console.error('List automations error:', error);
        res.status(500).json({ success: false, error: 'Failed to list automations' });
    }
});

app.post('/api/automation', auth, (req, res) => {
    try {
        const { form_id, formId, condition, action, name, webhookUrl, meta, active } = req.body;
        const fId = form_id || formId;
        if (!fId || !condition || !action) return res.status(400).json({ success: false, error: 'form_id, condition, and action are required' });
        const form = readDB('forms').find(f => f.id === fId && f.userId === req.user.id);
        if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
        const automations = readDB('automations');
        const auto = {
            id: 'auto_' + uuidv4().replace(/-/g, '').slice(0, 10),
            formId: fId, name: name || `Rule: ${condition} → ${action}`,
            condition, action, webhookUrl: webhookUrl || null,
            meta: meta || {}, active: active !== false,
            createdAt: new Date().toISOString()
        };
        automations.unshift(auto);
        writeDB('automations', automations);
        logActivity('automation_created', req.user.id, { automationId: auto.id, formId: fId });
        res.status(201).json(auto);
    } catch (error) {
        console.error('Create automation error:', error);
        res.status(500).json({ success: false, error: 'Failed to create automation' });
    }
});

app.patch('/api/automation/:id', auth, (req, res) => {
    try {
        const automations = readDB('automations');
        const idx = automations.findIndex(a => a.id === req.params.id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'Automation not found' });
        const form = readDB('forms').find(f => f.id === automations[idx].formId && f.userId === req.user.id);
        if (!form) return res.status(403).json({ success: false, error: 'Forbidden' });
        automations[idx] = { ...automations[idx], ...req.body, id: automations[idx].id, updatedAt: new Date().toISOString() };
        writeDB('automations', automations);
        res.json(automations[idx]);
    } catch (error) {
        console.error('Update automation error:', error);
        res.status(500).json({ success: false, error: 'Failed to update automation' });
    }
});

app.delete('/api/automation/:id', auth, (req, res) => {
    try {
        const automations = readDB('automations');
        const auto = automations.find(a => a.id === req.params.id);
        if (!auto) return res.status(404).json({ success: false, error: 'Not found' });
        const form = readDB('forms').find(f => f.id === auto.formId && f.userId === req.user.id);
        if (!form) return res.status(403).json({ success: false, error: 'Forbidden' });
        writeDB('automations', automations.filter(a => a.id !== req.params.id));
        res.json({ success: true });
    } catch (error) {
        console.error('Delete automation error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete automation' });
    }
});

app.get('/api/automation/:id/logs', auth, (req, res) => {
    try {
        const auto = readDB('automations').find(a => a.id === req.params.id);
        if (!auto) return res.status(404).json({ success: false, error: 'Not found' });
        const form = readDB('forms').find(f => f.id === auto.formId && f.userId === req.user.id);
        if (!form) return res.status(403).json({ success: false, error: 'Forbidden' });
        const logs = (readDB('automation_logs') || []).filter(l => l.automationId === req.params.id);
        res.json(logs);
    } catch (error) {
        console.error('Get automation logs error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve logs' });
    }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  UNIVERSAL PUBLIC DATA API  GET /api/public/forms/:id/responses     ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.get('/api/public/forms/:id/responses', (req, res) => {
    try {
        const form = readDB('forms').find(f => f.id === req.params.id);
        if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
        if (!form.isPublicAPI) return res.status(403).json({ success: false, error: 'Public API not enabled for this form. Enable it in form settings.' });
        const responses = readDB('responses').filter(r => r.formId === req.params.id);
        res.json({
            form: { id: form.id, title: form.title, description: form.description },
            total: responses.length,
            responses: responses.map(r => ({ id: r.id, submittedAt: r.submittedAt, data: r.data }))
        });
    } catch (error) {
        console.error('Public API responses error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve public data' });
    }
});

// Enable/disable public API for a form
app.patch('/api/forms/:id/public-api', auth, (req, res) => {
    try {
        const forms = readDB('forms');
        const idx = forms.findIndex(f => f.id === req.params.id && f.userId === req.user.id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'Form not found' });
        forms[idx].isPublicAPI = req.body.enabled !== false;
        writeDB('forms', forms);
        res.json({ enabled: forms[idx].isPublicAPI, publicUrl: `/api/public/forms/${req.params.id}/responses` });
    } catch (error) {
        console.error('Enable public API error:', error);
        res.status(500).json({ success: false, error: 'Failed to update API settings' });
    }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  EXPORT ROUTES  GET /api/forms/:id/export/:format                   ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.get('/api/forms/:id/export/:format', auth, (req, res) => {
    try {
        const form = readDB('forms').find(f => f.id === req.params.id && f.userId === req.user.id);
        if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
        const responses = readDB('responses').filter(r => r.formId === req.params.id);
        const format = req.params.format.toLowerCase();
        const name = (form.title || 'form').replace(/[^a-zA-Z0-9]/g, '_');
        const fields = form.fields || [];
        logActivity('export', req.user.id, { formId: req.params.id, format });
        if (format === 'json') {
            res.attachment(name + '.json');
            return res.json({ form: { title: form.title, description: form.description, fields: fields.map(f => ({ type: f.type, label: f.label })) }, total: responses.length, responses: responses.map(r => ({ id: r.id, submittedAt: r.submittedAt, data: r.data })) });
        }
        if (format === 'csv') {
            const cols = ['ID', 'Submitted At', ...fields.filter(f => !['heading', 'divider'].includes(f.type)).map(f => f.label)];
            const rows = responses.map(r => [r.id, new Date(r.submittedAt).toLocaleString(), ...fields.filter(f => !['heading', 'divider'].includes(f.type)).map(f => '"' + String(r.data?.[f.label] || '').replace(/"/g, '""') + '"')]);
            res.attachment(name + '.csv');
            return res.type('text/csv').send([cols.join(','), ...rows.map(r => r.join(','))].join('\n'));
        }
        if (format === 'sql') {
            const tbl = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            const allCols = fields.filter(f => !['heading', 'divider'].includes(f.type)).map(f => f.label.toLowerCase().replace(/\W+/g, '_'));
            let sql = `-- SnapyForm SQL Export: ${form.title}\n-- Generated: ${new Date().toISOString()}\n\nCREATE TABLE IF NOT EXISTS ${tbl} (\n  id VARCHAR(32) PRIMARY KEY,\n  submitted_at TIMESTAMP,\n  ${allCols.map(c => c + ' TEXT').join(',\n  ')}\n);\n\n`;
            responses.forEach(r => {
                const vals = [r.id, r.submittedAt, ...fields.filter(f => !['heading', 'divider'].includes(f.type)).map(f => String(r.data?.[f.label] || '').replace(/'/g, "''"))];
                sql += `INSERT INTO ${tbl} (id, submitted_at, ${allCols.join(', ')}) VALUES ('${vals.join("', '")}');\n`;
            });
            res.attachment(name + '.sql');
            return res.type('text/plain').send(sql);
        }
        if (format === 'excel') {
            // Return CSV with Excel-compatible headers (xlsx requires a library; return csv with BOM for Excel compatibility)
            const cols = ['ID', 'Submitted At', ...fields.filter(f => !['heading', 'divider'].includes(f.type)).map(f => f.label)];
            const rows = responses.map(r => [r.id, new Date(r.submittedAt).toLocaleString(), ...fields.filter(f => !['heading', 'divider'].includes(f.type)).map(f => '"' + String(r.data?.[f.label] || '').replace(/"/g, '""') + '"')]);
            const csvContent = '\uFEFF' + [cols.join(','), ...rows.map(r => r.join(','))].join('\n'); // BOM for Excel UTF-8
            res.attachment(name + '.csv');
            return res.type('text/csv').send(csvContent);
        }
        if (format === 'txt') {
            let txt = `SnapyForm Export: ${form.title}\nGenerated: ${new Date().toLocaleString()}\nTotal: ${responses.length} responses\n${'='.repeat(60)}\n\n`;
            responses.forEach((r, i) => {
                txt += `Response #${i + 1}\nSubmitted: ${new Date(r.submittedAt).toLocaleString()}\n`;
                Object.entries(r.data || {}).forEach(([k, v]) => { txt += `  ${k}: ${v}\n`; });
                txt += '\n';
            });
            res.attachment(name + '.txt');
            return res.type('text/plain').send(txt);
        }
        res.status(400).json({ success: false, error: 'Unsupported format. Use: json, csv, excel, sql, txt' });
    } catch (error) {
        console.error('Export format error:', error);
        res.status(500).json({ success: false, error: 'Failed to export data' });
    }
});

// Alias for responses/export (form specific redirect)
app.get('/api/responses/export', auth, (req, res) => {
    const { formId, format = 'csv' } = req.query;
    if (!formId) return res.status(400).json({ success: false, error: 'formId required' });
    res.redirect(`/api/forms/${formId}/export/${format}`);
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  QR CODE ENDPOINT  GET /api/forms/:id/qrcode                        ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.get('/api/forms/:id/qrcode', auth, async (req, res) => {
    try {
        const form = readDB('forms').find(f => f.id === req.params.id && f.userId === req.user.id);
        if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
        // Generate QR code as SVG (no npm package needed — pure JS QR matrix)
        const url = (req.query.baseUrl || `http://localhost:${PORT}`) + '/form/' + req.params.id;
        // Return metadata + URL (client renders the actual QR using its own library)
        res.json({
            success: true,
            formId: req.params.id,
            title: form.title,
            formUrl: url,
            qrApiUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=300x300&format=png`,
            svgUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=300x300&format=svg`
        });
    } catch (error) {
        console.error('QR Code error:', error);
        res.status(500).json({ success: false, error: 'Internal server error generating QR code' });
    }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  OFFLINE SYNC ENDPOINT  POST /api/offline/sync                      ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.post('/api/offline/sync', (req, res) => {
    try {
        const { submissions } = req.body;
        if (!Array.isArray(submissions) || !submissions.length) return res.status(400).json({ success: false, error: 'submissions array required' });
        const results = { succeeded: [], failed: [] };
        submissions.forEach(sub => {
            try {
                const { formId, data, submittedAt } = sub;
                if (!formId || !data) { results.failed.push({ formId, error: 'Missing formId or data' }); return; }
                const form = readDB('forms').find(f => f.id === formId);
                if (!form) { results.failed.push({ formId, error: 'Form not found' }); return; }
                if (form.status === 'closed') { results.failed.push({ formId, error: 'Form closed' }); return; }
                const responses = readDB('responses');
                const r = { id: 'resp_' + uuidv4().replace(/-/g, '').slice(0, 12), formId, data, submittedAt: submittedAt || new Date().toISOString(), syncedAt: new Date().toISOString(), offline: true, timeTakenSec: 0 };
                responses.unshift(r);
                writeDB('responses', responses);
                const forms = readDB('forms');
                const fi = forms.findIndex(f => f.id === formId);
                if (fi !== -1) { forms[fi].responseCount = (forms[fi].responseCount || 0) + 1; writeDB('forms', forms); }
                results.succeeded.push({ formId, responseId: r.id });
            } catch (e) { results.failed.push({ formId: sub.formId, error: e.message }); }
        });
        res.json({ success: true, synced: results.succeeded.length, failed: results.failed.length, results });
    } catch (error) {
        console.error('Offline sync error:', error);
        res.status(500).json({ success: false, error: 'Sync failed' });
    }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  WEBHOOKS                                                             ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.get('/api/webhooks', auth, (req, res) => {
    try {
        const hooks = (readDB('webhooks') || []).filter(w => {
            const form = readDB('forms').find(f => f.id === w.formId);
            return form?.userId === req.user.id;
        });
        res.json(hooks);
    } catch (error) {
        console.error('List webhooks error:', error);
        res.status(500).json({ success: false, error: 'Failed to list webhooks' });
    }
});

app.post('/api/webhooks', auth, (req, res) => {
    try {
        const { formId, url, events, name } = req.body;
        if (!formId || !url) return res.status(400).json({ success: false, error: 'formId and url required' });
        const form = readDB('forms').find(f => f.id === formId && f.userId === req.user.id);
        if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
        const hooks = readDB('webhooks') || [];
        const hook = { id: 'wh_' + uuidv4().replace(/-/g, '').slice(0, 10), formId, url, name: name || 'Webhook', events: events || ['response_submitted'], active: true, createdAt: new Date().toISOString() };
        hooks.push(hook);
        writeDB('webhooks', hooks);
        res.status(201).json(hook);
    } catch (error) {
        console.error('Create webhook error:', error);
        res.status(500).json({ success: false, error: 'Failed to create webhook' });
    }
});

app.delete('/api/webhooks/:id', auth, (req, res) => {
    try {
        const hooks = readDB('webhooks') || [];
        const hook = hooks.find(h => h.id === req.params.id);
        if (!hook) return res.status(404).json({ success: false, error: 'Webhook not found' });
        const form = readDB('forms').find(f => f.id === hook.formId && f.userId === req.user.id);
        if (!form) return res.status(403).json({ success: false, error: 'Forbidden' });
        writeDB('webhooks', hooks.filter(h => h.id !== req.params.id));
        res.json({ success: true });
    } catch (error) {
        console.error('Delete webhook error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete webhook' });
    }
});

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  SPA ROUTING                                                          ║
// ╚═══════════════════════════════════════════════════════════════════════╝
const pages = { '/': false, '/dashboard': true, '/login': false, '/register': false, '/builder': true, '/responses': true, '/export': true, '/analytics': true, '/settings': true, '/templates': false, '/admin': true, '/automation': true };
Object.entries(pages).forEach(([p, _]) => {
    const file = p === '/' ? 'index' : p.slice(1);
    app.get(p, (req, res) => res.sendFile(path.join(__dirname, 'public', file + '.html')));
});
app.get('/form/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'form.html')));
app.use('/api/', (req, res) => res.status(404).json({ success: false, error: 'Not found' }));
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════╗
║   SnapyForm – running on port ${PORT}    ║
║   → http://localhost:${PORT}              ║
║                                       ║
║   Admin:  info.elumugam@gmail.com     ║
║   Pass:   ADMINELUMUGAM               ║
║                                       ║
║   Demo:   demo@snapyform.com          ║
║   Pass:   demo1234                    ║
╚═══════════════════════════════════════╝`);
    });
}
