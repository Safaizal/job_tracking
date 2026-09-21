# Job Tracker

A full-stack personal dashboard that automatically detects job application emails in your Gmail inbox and organizes them into a clean, searchable, interactive table. Stop losing track of applications — know exactly where you stand with every company, at a glance.

![Status](https://img.shields.io/badge/status-active-success)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-blue)
![Backend](https://img.shields.io/badge/backend-FastAPI-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

<!-- Optional: uncomment after you add a screenshot
![App Screenshot](./docs/screenshot.png)
-->

## ✨ Features

- **Gmail Auto-Sync** — Connect your Gmail account securely with OAuth 2.0 and pull application emails with one click
- **Smart Parsing** — Automatically extracts company name, role, and application date from email headers
- **Manual Entry** — Add applications by hand with a simple inline form
- **Status Management** — Move applications through your pipeline (Applied → Interview → Offer → Rejected) with inline dropdowns
- **Instant Search** — Filter by company or role as you type
- **Duplicate Protection** — Syncing repeatedly never creates duplicate entries
- **Safe Delete** — Remove entries with confirmation
- **Clean, Modern UI** — Built with shadcn/ui and Tailwind CSS

## Tech Stack

| Layer      | Technology                                    |
|------------|-----------------------------------------------|
| Frontend   | React (Vite), Tailwind CSS, shadcn/ui, Lucide |
| Backend    | Python, FastAPI, SQLAlchemy                   |
| Database   | SQLite                                        |
| Integration| Gmail API (Google OAuth 2.0, PKCE flow)       |

## Architecture

```
┌──────────────┐   REST / JSON   ┌──────────────┐   SQLAlchemy   ┌──────────┐
│  React SPA   │ ◄─────────────► │   FastAPI    │ ◄────────────► │  SQLite  │
│ (localhost:  │                 │  (localhost: │                └──────────
│    5173)     │                 │    8000)     │
└──────────────┘                 └──────┬───────┘
                                        │ OAuth 2.0
                                        ▼
                                ┌──────────────┐
                                │  Gmail API   │
                                └──────────────┘
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- A Google Cloud account (free)

### 1. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install fastapi uvicorn sqlalchemy google-api-python-client \
            google-auth-httplib2 google-auth-oauthlib
uvicorn main:app --reload
```

### 2. Google Cloud Configuration

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Gmail API**
3. Configure the **OAuth consent screen** (External) and add yourself as a **Test User**
4. Create an **OAuth Client ID** (Web application) with redirect URI:
   `http://localhost:8000/auth/callback`
5. Download the JSON and save it as `backend/credentials.json`

> `credentials.json` and `token.json` are git-ignored by design. Never commit secrets.

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), click **Connect Gmail**, and hit **Sync Gmail**.

## Project Structure

```
job-tracking/
├── backend/
│   ├── main.py            # FastAPI app, REST endpoints, CORS
│   ├── auth.py            # Google OAuth 2.0 flow (PKCE-aware)
│   ├── gmail_service.py   # Gmail search, fetch & email parsing
│   ├── models.py          # SQLAlchemy models
│   ├── schemas.py         # Pydantic schemas
│   └── database.py        # DB engine & session management
└── frontend/
    └── src/
        ├── App.jsx        # Main dashboard UI
        └── components/ui/ # shadcn/ui components
```

## Roadmap

- [ ] Scheduled background sync (no manual button needed)
- [ ] Stats dashboard (applications per week, response rate charts)
- [ ] Smarter email parsing (job board–specific templates)
- [ ] Multi-user support with per-user tokens
- [ ] Production deployment

## License

MIT — free to use, modify, and learn from.
