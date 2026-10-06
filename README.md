# Job Tracker

A full-stack job application dashboard. Sign in with Google, and the app reads
your Gmail to find job application emails and organises them into a clean,
searchable table.

**Anyone with a Google account can sign in and use it.** Each person gets their
own private list — there is no shared database and no shared inbox access.

![Status](https://img.shields.io/badge/status-active-success)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-blue)
![Backend](https://img.shields.io/badge/backend-FastAPI-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

## ✨ Features

- **Google Sign-In** — anyone can sign in; no account or password to create
- **Private per-person data** — each account's applications are kept separately,
  in that person's own browser
- **Gmail Auto-Sync** — pull application emails with one click
- **Smart Parsing** — extracts company, role and application date from the email
- **Manual Entry** — add applications by hand with a simple inline form
- **Status Management** — move applications through your pipeline
  (Applied → Interview → Offer → Rejected)
- **Instant Search** — filter by company or role as you type
- **Duplicate Protection** — repeated syncs never create duplicate entries, and
  never overwrite a status you set by hand
- **Clean, Modern UI** — built with shadcn/ui and Tailwind CSS

## Tech Stack

| Layer        | Technology                                   |
|--------------|----------------------------------------------|
| Frontend     | React (Vite), Tailwind CSS, shadcn/ui, Lucide |
| Backend      | Python, FastAPI                              |
| Storage      | Browser `localStorage` — no job database     |
| Integration  | Gmail API (Google OAuth 2.0, PKCE flow)      |

## Architecture

```
                     sign in / sync
┌──────────────┐   ◄──────────────►   ┌──────────────┐   per-user token   ┌───────────┐
│  React SPA   │  REST / JSON       │   FastAPI    │  ────────────────►  │ tokens/   │
│              │  (session cookie)  │              │   backend/tokens/   │ 111.json  │
│  localStorage│                    │  who are you │                      │ 222.json  │
│  (per user)  │                    │  read inbox  │   nothing else      └───────────┘
└──────────────┘                    └──────┬───────┘   is stored
        │                                   │ OAuth 2.0
        │  applications live here,          ▼
        │  never on the server        ┌──────────────┐
        └───────────────────────────► │  Gmail API   │
                                     └──────────────┘
```

Two decisions keep this safe for more than one person:

1. **Each sign-in keeps its own state.** The OAuth `state` value and its PKCE
   verifier are held per in-flight login, so two people can sign in at the same
   moment without disturbing each other.
2. **Each user's Google token lives in their own file.** Nobody can read or
   revoke anybody else's inbox, and signing out only removes your own.

Your applications are never sent to the server. They live in your browser under
a key that includes your user id, so signing in as someone else shows an empty
table rather than the previous person's rows.

> The trade-off: your list is tied to that browser. Clearing site data, or
> switching browser or device, starts you fresh. Clearing your Gmail connection
> does not affect it.

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- A Google Cloud account (free)

### 1. Install Dependencies

```bash
python3 -m venv backend/venv
backend/venv/bin/pip install -r backend/requirements.txt
cd frontend && npm install
```

### 2. Google Cloud Configuration

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Gmail API**
3. Configure the **OAuth consent screen** (External). While it is in *Testing*,
   add every person who will use the app under **Test users** — Google limits
   unverified apps to 100 test users.
4. Create an **OAuth Client ID** (Web application) with redirect URI:
   `http://localhost:8000/auth/callback`
5. Download the JSON and save it as `backend/credentials.json`

> `credentials.json`, `.session_secret` and `backend/tokens/` are git-ignored by
> design. Never commit secrets — a token file grants read access to an inbox.

### 3. Start Both Servers

```bash
./start.sh
```

The script checks your environment, starts the backend and the frontend, waits
until each one actually answers, and prints the URL to open. `Ctrl+C` stops
both. Once it reports the app is running, open
[http://localhost:5173](http://localhost:5173) and click **Continue with
Google**, then press **Sync Gmail**.

| Command | What it does |
| --- | --- |
| `./start.sh` | Start both servers |
| `./start.sh --lan` | Also bind to `0.0.0.0` so other devices can reach it |
| `./start.sh --no-reload` | Start the backend without restarting on file changes |
| `./start.sh --stop` | Stop servers left over from a terminal that was closed |
| `BACKEND_PORT=8001 ./start.sh` | Use a different port if 8000 is taken |

To run them by hand instead:

```bash
cd backend  && uvicorn main:app --reload
cd frontend && npm run dev
```

### Using it from another device on your network

```bash
./start.sh --lan
```

This binds both servers to all interfaces and prints your LAN address, for
example `http://192.168.1.9:5173`. The backend already accepts
private-network origins, so no extra CORS setup is needed.

Google's redirect URI is registered as
`localhost`, so it must stay `http://localhost:8000/auth/callback` — the browser
completes the Google hop before the app redirects to the LAN address.

## Configuration

Every setting is an environment variable with a working default:

| Variable              | Default                              | Purpose                                     |
|-----------------------|--------------------------------------|---------------------------------------------|
| `FRONTEND_URL`        | `http://localhost:5173`              | Where sign-in returns the user              |
| `ALLOWED_ORIGINS`     | `FRONTEND_URL`, `http://127.0.0.1:5173` | Extra CORS origins (comma-separated)     |
| `GOOGLE_REDIRECT_URI` | `http://localhost:8000/auth/callback`| Must match the Google Cloud client         |
| `GOOGLE_CREDENTIALS_FILE` | `backend/credentials.json`        | OAuth client secrets                        |
| `TOKENS_DIR`          | `backend/tokens/`                    | Where per-user tokens are written           |
| `SESSION_SECRET`      | generated into `.session_secret`     | Signs session cookies                       |
| `COOKIE_SECURE`       | `0`                                  | Set to `1` only when serving over HTTPS     |
| `BACKEND_PORT`        | `8000`                               | Port `start.sh` runs the backend on         |
| `FRONTEND_PORT`       | `5173`                               | Port `start.sh` runs the frontend on        |

## API

All routes except `/health`, `/auth/login` and `/auth/callback` require the
session cookie; without it they return `401`.

| Method | Route                     | Purpose                                     |
|--------|---------------------------|---------------------------------------------|
| `GET`  | `/health`                 | Liveness check; also served at `/api/health` |
| `GET`  | `/api/me`                 | Who is signed in, and is Gmail connected     |
| `GET`  | `/auth/login`             | Google sign-in URL                           |
| `GET`  | `/auth/callback`          | Google redirects back here                   |
| `POST` | `/auth/logout`            | Sign out, revoke session, drop your token    |
| `POST` | `/auth/disconnect-gmail`  | Stop reading your inbox, keep your session   |
| `POST` | `/api/sync-gmail`         | Read your inbox, return parsed applications  |

## Project Structure

```
job-tracking/
├── start.sh               # Starts and stops both servers
├── backend/
│   ├── main.py            # FastAPI app, routes, CORS
│   ├── auth.py            # Multi-user Google OAuth, per-user token storage
│   ├── session.py         # Signed session cookies
│   ├── gmail_service.py   # Gmail search, fetch & email parsing
│   └── requirements.txt
└── frontend/
    └── src/
        ├── App.jsx             # Main dashboard UI
        ├── components/
        │   ├── LoginScreen.jsx # Google sign-in screen
        │   └── ui/             # shadcn/ui components
        └── lib/
            ├── api.js          # Backend calls
            └── jobsStore.js    # Per-user localStorage list
```

## Security Notes

- Session cookies are `HttpOnly` + `SameSite=Lax`, and a logout revokes the
  session server-side, so a copied cookie stops working immediately.
- `backend/tokens/` is written with `0600` permissions, and user ids are
  sanitised before being used as filenames.
- Gmail is only read when someone presses **Sync**, using that person's own
  token.
- Signing out removes only your own token file.

## Roadmap

- [ ] Scheduled background sync (no manual button needed)
- [ ] Stats dashboard (applications per week, response rate charts)
- [ ] Smarter email parsing (job board–specific templates)
- [ ] Optional cross-device sync of applications
- [ ] Production deployment

## License

MIT — free to use, modify, and learn from.
