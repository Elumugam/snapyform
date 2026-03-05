# Docmo – Full System Architecture

## 1. System Overview

Docmo is a smart document + form creation platform where users create forms, share links, collect responses, and export data in multiple formats.

```
┌─────────────────────────────────────────────────────────┐
│                     DOCMO PLATFORM                       │
│                                                          │
│  ┌──────────────┐    REST API    ┌──────────────────┐  │
│  │   Frontend   │◄──────────────►│     Backend      │  │
│  │  Next.js 14  │                │  Node.js/Express │  │
│  │  TailwindCSS │                │   JWT Auth       │  │
│  │  @dnd-kit    │                │   Rate Limiting  │  │
│  └──────────────┘                └────────┬─────────┘  │
│                                           │             │
│                         ┌─────────────────┼──────────┐  │
│                         │                 │          │  │
│                  ┌──────▼──────┐  ┌───────▼──────┐  │  │
│                  │  Database   │  │  AI Service  │  │  │
│                  │ PostgreSQL  │  │  OpenAI API  │  │  │
│                  │   MongoDB   │  │ Form Generator│  │  │
│                  └─────────────┘  └──────────────┘  │  │
│                                                      │  │
│                  ┌──────────────┐  ┌──────────────┐  │  │
│                  │Cloud Storage │  │   External   │  │  │
│                  │  Uploads     │  │ Integrations │  │  │
│                  │  (S3/R2)     │  │Zapier/Sheets │  │  │
│                  └──────────────┘  └──────────────┘  │  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema

### Users Table
```sql
CREATE TABLE users (
  user_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  password     VARCHAR(255),           -- hashed, nullable for OAuth
  google_id    VARCHAR(255),
  avatar_url   TEXT,
  role         VARCHAR(50) DEFAULT 'user',
  is_verified  BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);
```

### Forms Table
```sql
CREATE TABLE forms (
  form_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES users(user_id) ON DELETE CASCADE,
  title              VARCHAR(500) NOT NULL,
  description        TEXT,
  structure_json     JSONB NOT NULL DEFAULT '[]',
  share_link         VARCHAR(100) UNIQUE NOT NULL,
  status             VARCHAR(50) DEFAULT 'draft', -- draft | active | closed
  response_limit     INTEGER,
  deadline           TIMESTAMP,
  conditional_logic  JSONB DEFAULT '[]',
  theme_settings     JSONB DEFAULT '{}',
  is_multi_step      BOOLEAN DEFAULT FALSE,
  allow_anonymous    BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP DEFAULT NOW()
);
```

### Responses Table
```sql
CREATE TABLE responses (
  response_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id          UUID REFERENCES forms(form_id) ON DELETE CASCADE,
  respondent_email VARCHAR(255),
  submitted_data   JSONB NOT NULL,
  ip_address       INET,
  user_agent       TEXT,
  is_complete      BOOLEAN DEFAULT TRUE,
  time_taken_sec   INTEGER,
  created_at       TIMESTAMP DEFAULT NOW()
);
```

### Collaborators Table
```sql
CREATE TABLE collaborators (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id          UUID REFERENCES forms(form_id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(user_id) ON DELETE CASCADE,
  permission_level VARCHAR(50) NOT NULL,  -- owner | editor | viewer
  invited_by       UUID REFERENCES users(user_id),
  created_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE(form_id, user_id)
);
```

### File Uploads Table
```sql
CREATE TABLE file_uploads (
  upload_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id  UUID REFERENCES responses(response_id) ON DELETE CASCADE,
  field_key    VARCHAR(255),
  file_name    VARCHAR(500),
  file_url     TEXT NOT NULL,
  file_size    BIGINT,
  mime_type    VARCHAR(100),
  created_at   TIMESTAMP DEFAULT NOW()
);
```

### Export History Table
```sql
CREATE TABLE export_history (
  export_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     UUID REFERENCES forms(form_id),
  user_id     UUID REFERENCES users(user_id),
  format      VARCHAR(50),   -- xlsx | csv | json | sql | pdf
  filters     JSONB DEFAULT '{}',
  record_count INTEGER,
  file_url    TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## 3. Entity Relationship Diagram (ERD)

```
┌──────────┐       ┌──────────────┐       ┌─────────────┐
│  users   │──────<│    forms     │──────<│  responses  │
│──────────│  1:N  │──────────────│  1:N  │─────────────│
│ user_id  │       │ form_id      │       │ response_id │
│ name     │       │ user_id(FK)  │       │ form_id(FK) │
│ email    │       │ title        │       │ submitted_  │
│ password │       │ description  │       │   data(JSON)│
│ role     │       │ structure_   │       │ created_at  │
└──────────┘       │   json       │       └─────────────┘
     │             │ share_link   │              │
     │             │ status       │              │ 1:N
     │             │ response_    │       ┌──────▼──────┐
     │             │   limit      │       │file_uploads │
     │             │ deadline     │       └─────────────┘
     │             └──────┬───────┘
     │                    │ 1:N
     │             ┌──────▼───────────┐
     └────────────<│  collaborators   │
         N:M       │──────────────────│
                   │ form_id(FK)      │
                   │ user_id(FK)      │
                   │ permission_level │
                   └──────────────────┘
```

---

## 4. REST API Design

### Authentication Endpoints
```
POST   /api/auth/register          Register new user
POST   /api/auth/login             Login, returns JWT
POST   /api/auth/logout            Invalidate token
GET    /api/auth/me                Get current user
POST   /api/auth/verify-email      Verify email token
POST   /api/auth/forgot-password   Send reset email
POST   /api/auth/reset-password    Reset with token
GET    /api/auth/google            Google OAuth redirect
GET    /api/auth/google/callback   Google OAuth callback
```

### Forms Endpoints
```
GET    /api/forms                  List user's forms
POST   /api/forms                  Create new form
GET    /api/forms/:id              Get form by ID
PUT    /api/forms/:id              Update form
DELETE /api/forms/:id              Delete form
POST   /api/forms/:id/duplicate    Duplicate form
GET    /api/forms/:id/share        Get shareable link + QR code
GET    /api/forms/public/:link     Get public form (no auth)
POST   /api/forms/ai-generate      AI generate form from prompt
```

### Responses Endpoints
```
POST   /api/responses/:formId      Submit a response (public)
GET    /api/responses/:formId      Get all responses (auth)
GET    /api/responses/:formId/:id  Get single response
DELETE /api/responses/:id          Delete a response
GET    /api/responses/:formId/stats  Get analytics stats
```

### Export Endpoints
```
GET    /api/export/:formId/xlsx    Export as Excel
GET    /api/export/:formId/csv     Export as CSV
GET    /api/export/:formId/json    Export as JSON
GET    /api/export/:formId/sql     Export as SQL dump
GET    /api/export/:formId/pdf     Export as PDF
POST   /api/export/:formId/sheets  Sync to Google Sheets
GET    /api/export/:formId/history Export history
```

### Collaborators Endpoints
```
GET    /api/collaborators/:formId        List collaborators
POST   /api/collaborators/:formId/invite Invite collaborator
PUT    /api/collaborators/:id/role       Update role
DELETE /api/collaborators/:id            Remove collaborator
```

### Webhooks Endpoints
```
GET    /api/webhooks/:formId       List webhooks
POST   /api/webhooks/:formId       Create webhook
DELETE /api/webhooks/:id           Delete webhook
```

---

## 5. Code Structure

```
docmo/
├── app/                      # Next.js App Router pages
│   ├── layout.jsx            # Root layout
│   ├── page.jsx              # Landing page
│   ├── globals.css           # Global styles
│   ├── login/page.jsx
│   ├── register/page.jsx
│   ├── dashboard/page.jsx
│   ├── builder/[id]/page.jsx # Form builder
│   ├── form/[id]/page.jsx    # Public form
│   ├── responses/[id]/page.jsx
│   ├── export/[id]/page.jsx
│   └── settings/page.jsx
│
├── components/               # Reusable UI components
│   ├── ui/                   # Base UI elements
│   │   ├── Button.jsx
│   │   ├── Input.jsx
│   │   ├── Card.jsx
│   │   ├── Modal.jsx
│   │   └── Badge.jsx
│   ├── layout/
│   │   ├── Navbar.jsx
│   │   ├── Sidebar.jsx
│   │   └── Footer.jsx
│   ├── builder/
│   │   ├── FieldTypePicker.jsx
│   │   ├── FormCanvas.jsx
│   │   ├── FormFieldCard.jsx
│   │   └── PropertiesPanel.jsx
│   ├── analytics/
│   │   ├── StatsCard.jsx
│   │   ├── ResponseChart.jsx
│   │   └── ResponseTable.jsx
│   └── export/
│       └── ExportOptions.jsx
│
├── lib/                      # Utilities + API helpers
│   ├── api.js                # API client
│   ├── auth.js               # Auth helpers
│   ├── export.js             # Export utilities
│   └── validators.js         # Input validation
│
├── store/                    # State management (Zustand)
│   ├── formStore.js
│   ├── authStore.js
│   └── uiStore.js
│
├── hooks/                    # Custom React hooks
│   ├── useForm.js
│   ├── useResponses.js
│   └── useDragDrop.js
│
├── server/                   # Backend (separate or API routes)
│   ├── routes/
│   │   ├── auth.js
│   │   ├── forms.js
│   │   ├── responses.js
│   │   ├── export.js
│   │   └── webhooks.js
│   ├── controllers/
│   ├── models/
│   ├── middleware/
│   │   ├── auth.js           # JWT verification
│   │   ├── rateLimit.js
│   │   └── validate.js
│   └── services/
│       ├── aiService.js      # OpenAI integration
│       ├── emailService.js
│       └── exportService.js
│
├── docs/
│   └── architecture.md       # This file
├── public/
├── package.json
├── tailwind.config.js
└── next.config.js
```

---

## 6. Field Types Schema (structure_json)

Each form field is stored as a JSON object:
```json
{
  "id": "field_abc123",
  "type": "text",
  "label": "Full Name",
  "placeholder": "Enter your name",
  "required": true,
  "validation": {
    "minLength": 2,
    "maxLength": 100
  },
  "helpText": "As shown on your ID",
  "conditional": {
    "show_if": "field_xyz",
    "operator": "equals",
    "value": "business"
  }
}
```

Supported types: `text`, `paragraph`, `number`, `email`, `phone`, `date`, `dropdown`, `radio`, `checkbox`, `rating`, `file`, `signature`, `location`, `image`, `divider`

---

## 7. Security Implementation

| Layer | Measure |
|-------|---------|
| Authentication | JWT with 7d expiry + refresh tokens |
| Passwords | bcrypt hashing (12 rounds) |
| Rate Limiting | 100 req/min per IP (express-rate-limit) |
| Input Validation | Zod/Joi schema validation on all endpoints |
| CSRF | SameSite cookies + CSRF tokens |
| File Uploads | File type whitelist, virus scan, size limit 10MB |
| SQL Injection | Parameterized queries (no raw SQL from user) |
| XSS | DOMPurify on client, sanitize-html on server |
| HTTPS | Enforced via reverse proxy (nginx/Vercel) |
| Secrets | Environment variables, never in code |

---

## 8. Deployment Guide

### Option A: Vercel + Supabase (Recommended)

```bash
# 1. Push to GitHub
git init && git add . && git push origin main

# 2. Deploy frontend on Vercel
vercel deploy

# 3. Set up Supabase PostgreSQL
# Create project at supabase.com
# Run migrations via Supabase dashboard SQL editor

# 4. Configure env variables in Vercel:
NEXT_PUBLIC_API_URL=https://api.docmo.app
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
AWS_S3_BUCKET=docmo-uploads
```

### Option B: Docker Compose (Self-hosted)

```yaml
version: '3.8'
services:
  frontend:
    build: .
    ports: ['3000:3000']
    environment:
      - DATABASE_URL=postgresql://postgres:pass@db:5432/docmo
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: docmo
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
  redis:
    image: redis:alpine
```

### Environment Variables
```env
# App
NEXT_PUBLIC_APP_URL=https://docmo.app
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRE=7d

# Database
DATABASE_URL=postgresql://user:pass@host:5432/docmo

# AI
OPENAI_API_KEY=sk-...

# Storage
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=docmo-file-uploads
AWS_REGION=us-east-1

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASS=SG...

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```
