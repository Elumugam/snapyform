/**
 * Docmo – localStorage Database Layer
 * Full CRUD for Forms, Responses, and User data
 */
const DocmoDB = {
    FORMS_KEY: 'docmo_forms',
    RESPONSES_KEY: 'docmo_responses',
    USER_KEY: 'docmo_user',
    SETTINGS_KEY: 'docmo_settings',

    // ── Initialise with sample data ──────────────────────────────────────────
    init() {
        if (!localStorage.getItem(this.FORMS_KEY)) {
            localStorage.setItem(this.FORMS_KEY, JSON.stringify(this._sampleForms()));
        }
        if (!localStorage.getItem(this.RESPONSES_KEY)) {
            localStorage.setItem(this.RESPONSES_KEY, JSON.stringify(this._sampleResponses()));
        }
        if (!localStorage.getItem(this.USER_KEY)) {
            localStorage.setItem(this.USER_KEY, JSON.stringify({
                name: 'John Smith', firstName: 'John', lastName: 'Smith',
                email: 'john@docmo.app', plan: 'Pro', avatar: 'JS', theme: 'dark'
            }));
        }
    },

    // ── FORMS ────────────────────────────────────────────────────────────────
    getForms() {
        return JSON.parse(localStorage.getItem(this.FORMS_KEY) || '[]');
    },
    getForm(id) {
        return this.getForms().find(f => f.id === id) || null;
    },
    createForm(data) {
        const forms = this.getForms();
        const shareLink = this._slug(data.title || 'untitled') + '-' + Math.random().toString(36).slice(2, 7);
        const form = {
            id: 'form_' + Date.now(),
            title: 'Untitled Form',
            description: '',
            status: 'draft',
            icon: '📋',
            iconColor: '#6c63ff',
            shareLink,
            responseCount: 0,
            responseLimit: null,
            deadline: null,
            fields: [],
            allowAnonymous: true,
            showProgress: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...data
        };
        forms.unshift(form);
        localStorage.setItem(this.FORMS_KEY, JSON.stringify(forms));
        return form;
    },
    updateForm(id, data) {
        const forms = this.getForms();
        const idx = forms.findIndex(f => f.id === id);
        if (idx === -1) return null;
        forms[idx] = { ...forms[idx], ...data, updatedAt: new Date().toISOString() };
        localStorage.setItem(this.FORMS_KEY, JSON.stringify(forms));
        return forms[idx];
    },
    deleteForm(id) {
        localStorage.setItem(this.FORMS_KEY, JSON.stringify(this.getForms().filter(f => f.id !== id)));
        localStorage.setItem(this.RESPONSES_KEY, JSON.stringify(this.getResponses().filter(r => r.formId !== id)));
    },
    duplicateForm(id) {
        const form = this.getForm(id);
        if (!form) return null;
        return this.createForm({
            ...form,
            id: undefined,
            title: form.title + ' (Copy)',
            responseCount: 0,
            status: 'draft',
            shareLink: this._slug(form.title) + '-' + Math.random().toString(36).slice(2, 7)
        });
    },

    // ── RESPONSES ────────────────────────────────────────────────────────────
    getResponses(formId) {
        const all = JSON.parse(localStorage.getItem(this.RESPONSES_KEY) || '[]');
        return formId ? all.filter(r => r.formId === formId) : all;
    },
    getResponse(id) {
        return this.getResponses().find(r => r.id === id) || null;
    },
    addResponse(formId, responseData) {
        const responses = this.getResponses();
        const resp = {
            id: 'resp_' + Date.now(),
            formId,
            data: responseData,
            submittedAt: new Date().toISOString(),
            timeTakenSec: Math.floor(Math.random() * 180) + 30
        };
        responses.unshift(resp);
        localStorage.setItem(this.RESPONSES_KEY, JSON.stringify(responses));
        // bump count on form
        const form = this.getForm(formId);
        if (form) this.updateForm(formId, { responseCount: (form.responseCount || 0) + 1 });
        return resp;
    },
    deleteResponse(id) {
        const resp = this.getResponse(id);
        if (resp) {
            const form = this.getForm(resp.formId);
            if (form) this.updateForm(resp.formId, { responseCount: Math.max(0, (form.responseCount || 1) - 1) });
        }
        localStorage.setItem(this.RESPONSES_KEY, JSON.stringify(this.getResponses().filter(r => r.id !== id)));
    },

    // ── USER ──────────────────────────────────────────────────────────────────
    getUser() { return JSON.parse(localStorage.getItem(this.USER_KEY) || '{}'); },
    updateUser(data) {
        const user = { ...this.getUser(), ...data };
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        return user;
    },

    // ── HELPERS ──────────────────────────────────────────────────────────────
    _slug(str) {
        return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 30);
    },
    _relTime(iso) {
        const diff = Date.now() - new Date(iso).getTime();
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
        if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
        return Math.floor(diff / 86400000) + 'd ago';
    },

    _sampleForms() {
        return [
            {
                id: 'form_demo1', title: 'Customer Feedback Survey',
                description: 'Help us improve your experience', status: 'active',
                icon: '⭐', iconColor: '#6c63ff', shareLink: 'customer-feedback-xyz',
                responseCount: 12, responseLimit: null, deadline: null,
                allowAnonymous: true, showProgress: true,
                createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
                updatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
                fields: [
                    { id: 'f1', type: 'text', label: 'Full Name', required: true, placeholder: 'Enter your full name' },
                    { id: 'f2', type: 'email', label: 'Email Address', required: true, placeholder: 'you@example.com' },
                    { id: 'f3', type: 'rating', label: 'Rate your experience', required: true },
                    { id: 'f4', type: 'radio', label: 'Would you recommend us?', required: false, options: ['Yes, definitely', 'Maybe', 'Probably not'] },
                    { id: 'f5', type: 'paragraph', label: 'Additional feedback', required: false, placeholder: 'Share your thoughts...' }
                ]
            },
            {
                id: 'form_demo2', title: 'Job Application Form',
                description: 'Submit your application here', status: 'active',
                icon: '💼', iconColor: '#10b981', shareLink: 'job-application-abc',
                responseCount: 5, responseLimit: 100, deadline: null,
                allowAnonymous: true, showProgress: true,
                createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
                updatedAt: new Date(Date.now() - 86400000).toISOString(),
                fields: [
                    { id: 'f1', type: 'text', label: 'Full Name', required: true },
                    { id: 'f2', type: 'email', label: 'Email', required: true },
                    { id: 'f3', type: 'phone', label: 'Phone Number', required: false },
                    { id: 'f4', type: 'dropdown', label: 'Position Applied', required: true, options: ['Software Engineer', 'Product Manager', 'Designer', 'Marketing Manager'] },
                    { id: 'f5', type: 'paragraph', label: 'Cover Letter', required: true, placeholder: 'Tell us about yourself...' },
                    { id: 'f6', type: 'file', label: 'Upload Resume (PDF)', required: false }
                ]
            },
            {
                id: 'form_demo3', title: 'Contact Us',
                description: 'General inquiries form', status: 'active',
                icon: '📬', iconColor: '#0ea5e9', shareLink: 'contact-us-docmo',
                responseCount: 3, responseLimit: null, deadline: null,
                allowAnonymous: true, showProgress: false,
                createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
                updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
                fields: [
                    { id: 'f1', type: 'text', label: 'Name', required: true },
                    { id: 'f2', type: 'email', label: 'Email', required: true },
                    { id: 'f3', type: 'dropdown', label: 'Subject', required: false, options: ['General Inquiry', 'Technical Support', 'Billing', 'Partnership'] },
                    { id: 'f4', type: 'paragraph', label: 'Message', required: true, placeholder: 'How can we help?' }
                ]
            }
        ];
    },

    _sampleResponses() {
        const ts = (h) => new Date(Date.now() - h * 3600000).toISOString();
        return [
            { id: 'resp_1', formId: 'form_demo1', submittedAt: ts(2), timeTakenSec: 142, data: { 'Full Name': 'Alice Johnson', 'Email Address': 'alice@email.com', 'Rate your experience': '5', 'Would you recommend us?': 'Yes, definitely', 'Additional feedback': 'Absolutely love the UI!' } },
            { id: 'resp_2', formId: 'form_demo1', submittedAt: ts(5), timeTakenSec: 98, data: { 'Full Name': 'Bob Kumar', 'Email Address': 'bob@corp.in', 'Rate your experience': '4', 'Would you recommend us?': 'Yes, definitely' } },
            { id: 'resp_3', formId: 'form_demo1', submittedAt: ts(24), timeTakenSec: 210, data: { 'Full Name': 'Carol Lee', 'Email Address': 'carol@design.io', 'Rate your experience': '3', 'Would you recommend us?': 'Maybe', 'Additional feedback': 'Some improvements needed.' } },
            { id: 'resp_4', formId: 'form_demo1', submittedAt: ts(48), timeTakenSec: 175, data: { 'Full Name': 'David Park', 'Email Address': 'david@startup.co', 'Rate your experience': '5', 'Would you recommend us?': 'Yes, definitely' } },
            { id: 'resp_5', formId: 'form_demo1', submittedAt: ts(72), timeTakenSec: 88, data: { 'Full Name': 'Emma Wilson', 'Email Address': 'emma@agency.uk', 'Rate your experience': '4', 'Would you recommend us?': 'Yes, definitely' } },
            { id: 'resp_6', formId: 'form_demo2', submittedAt: ts(1), timeTakenSec: 320, data: { 'Full Name': 'Frank Zhang', 'Email': 'frank@tech.sg', 'Phone Number': '+65 9876 5432', 'Position Applied': 'Software Engineer', 'Cover Letter': 'Passionate developer with 5 years of experience.' } },
            { id: 'resp_7', formId: 'form_demo2', submittedAt: ts(3), timeTakenSec: 280, data: { 'Full Name': 'Grace Kim', 'Email': 'grace@design.kr', 'Position Applied': 'Designer' } },
            { id: 'resp_8', formId: 'form_demo3', submittedAt: ts(4), timeTakenSec: 65, data: { 'Name': 'Henry Ford', 'Email': 'henry@motors.com', 'Subject': 'General Inquiry', 'Message': 'Great platform! Keep it up.' } },
            { id: 'resp_9', formId: 'form_demo3', submittedAt: ts(10), timeTakenSec: 78, data: { 'Name': 'Iris Patel', 'Email': 'iris@startup.in', 'Subject': 'Technical Support', 'Message': 'Need help with export feature.' } },
            { id: 'resp_10', formId: 'form_demo3', submittedAt: ts(20), timeTakenSec: 55, data: { 'Name': 'Jack Chen', 'Email': 'jack@corp.cn', 'Subject': 'Partnership', 'Message': 'Interested in enterprise plan.' } }
        ];
    }
};
