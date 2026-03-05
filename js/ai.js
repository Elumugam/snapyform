/**
 * Docmo – Gemini AI Integration
 * AI Form Generation using Google Gemini 1.5 Flash
 */
const DocmoAI = {
    API_KEY: 'AIzaSyCrij96m5OpnfjN2qSRzY5PbK6PZsFWYz4',
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',

    /**
     * Generate form fields from a natural language prompt.
     * Returns an array of field objects compatible with the Docmo form schema.
     */
    async generateForm(prompt) {
        const systemInstruction = `You are an expert form builder AI assistant for Docmo platform.
The user will describe a form they want to create. You must generate a JSON object with:
- "title": a concise form title (string)
- "description": a short helpful description (string, 1-2 sentences)
- "fields": an array of field objects

Each field object must have:
- "id": unique string like "f1", "f2", etc.
- "type": one of: text, email, phone, number, paragraph, dropdown, radio, checkbox, rating, date, file, signature
- "label": clear field label (string)
- "required": true or false
- "placeholder": helpful placeholder text (string, optional)
- "options": array of strings (REQUIRED for dropdown, radio, checkbox types only)
- "helpText": optional helper text (string, optional)

Rules:
- Always include at minimum: name + email fields for contact/feedback forms
- Use "rating" type for satisfaction/score questions
- Use "radio" for yes/no or single-choice questions
- Use "dropdown" for lists with 4+ options
- Use "checkbox" for multiple-select questions
- Generate 4-10 fields appropriate for the form type
- Return ONLY valid JSON, no markdown, no explanation

Example output:
{"title":"Customer Feedback Form","description":"Share your experience with us.","fields":[{"id":"f1","type":"text","label":"Full Name","required":true,"placeholder":"Enter your name"},{"id":"f2","type":"email","label":"Email Address","required":true,"placeholder":"you@example.com"},{"id":"f3","type":"rating","label":"Overall Satisfaction","required":true},{"id":"f4","type":"radio","label":"Would you recommend us?","required":false,"options":["Yes","No","Maybe"]},{"id":"f5","type":"paragraph","label":"Additional Comments","required":false,"placeholder":"Any other feedback..."}]}`;

        const requestBody = {
            contents: [{
                parts: [{ text: systemInstruction + '\n\nUser request: ' + prompt }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
                responseMimeType: 'application/json'
            }
        };

        const response = await fetch(`${this.API_URL}?key=${this.API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Gemini API error');
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse JSON – try direct parse first, then extract from text
        try {
            return JSON.parse(text.trim());
        } catch {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            throw new Error('Could not parse AI response as JSON');
        }
    },

    /**
     * Generate a suggested title and description from fields array.
     */
    async suggestMetadata(fields) {
        const labels = fields.map(f => f.label).join(', ');
        const prompt = `Given these form fields: ${labels} — suggest a short form title (max 6 words) and one sentence description. Return JSON: {"title":"...","description":"..."}`;

        const response = await fetch(`${this.API_URL}?key=${this.API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.5, maxOutputTokens: 256, responseMimeType: 'application/json' }
            })
        });

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        try { return JSON.parse(text.trim()); } catch { return null; }
    }
};
