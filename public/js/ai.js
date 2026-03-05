/**
 * SnapyForm – OpenAI AI Integration
 * Uses gpt-4o-mini via the /api/ai/* server proxy
 */
const DocmoAI = {
    // Generate form fields from a natural language prompt
    async generateForm(prompt) {
        const res = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('docmo_token') || '') },
            body: JSON.stringify({ prompt })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'AI generation failed');
        return data;
    },

    // Analyze collected responses with AI
    async analyzeResponses(formTitle, responses) {
        const res = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('docmo_token') || '') },
            body: JSON.stringify({ formTitle, responses })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'AI analysis failed');
        return data;
    }
};

// Also expose globally for backward compat
window.DocmoAI = DocmoAI;
