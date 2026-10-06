"""FastAPI app for a multi-user job tracker.

Identity comes from Google Sign-In; jobs live in each person's browser, so the
server holds no job data and no job database. The only thing stored server-side
per user is their own Gmail token, needed to read their inbox on request.
"""

import os

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

import auth
import gmail_service
import session

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Origins must be listed explicitly: the session cookie is sent with
# credentials, and the browser rejects a wildcard for credentialed requests.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS", f"{FRONTEND_URL},http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

# Private-network and loopback origins (any port), so the app can be opened from
# another device on the LAN without editing the list for every address.
PRIVATE_ORIGIN_REGEX = (
    r"^http://(localhost|127\.0\.0\.1|\[::1\]"
    r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r"|192\.168\.\d{1,3}\.\d{1,3}"
    r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$"
)

app = FastAPI(title="Job Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=PRIVATE_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def current_user(request: Request) -> dict:
    """The signed-in user, or 401. Every job and Gmail route depends on this."""
    payload = session.read_session(request.cookies.get(session.COOKIE_NAME))
    if not payload:
        raise HTTPException(status_code=401, detail="Not signed in")
    return payload


@app.get("/api/me")
def whoami(user: dict = Depends(current_user)):
    return {
        "user": {
            "id": user["sub"],
            "email": user.get("email"),
            "name": user.get("name"),
            "picture": user.get("picture"),
        },
        "gmail_connected": auth.is_connected(user["sub"]),
    }


@app.get("/auth/login")
def login(response: Response):
    """Return the Google sign-in URL for the frontend to redirect to."""
    try:
        url, attempt = auth.get_login_url()
    except auth.AuthError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Bound to this browser: the callback will only be accepted from here.
    session.set_attempt_cookie(response, attempt)
    return {"url": url}


@app.get("/auth/callback")
def auth_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    """Google sends the user back here; trade the code for a session cookie."""
    if error:
        response = RedirectResponse(url=f"{FRONTEND_URL}/?login=failed")
        session.clear_attempt_cookie(response)
        return response

    try:
        user = auth.complete_login(
            code=code or "",
            state=state or "",
            attempt=request.cookies.get(session.ATTEMPT_COOKIE),
        )
    except auth.AuthError as exc:
        # Send them back to a usable page rather than a raw error page.
        response = RedirectResponse(url=f"{FRONTEND_URL}/?login=failed&reason={exc}")
        session.clear_attempt_cookie(response)
        return response

    response = RedirectResponse(url=f"{FRONTEND_URL}/?login=success")
    session.clear_attempt_cookie(response)
    session.set_session_cookie(response, session.create_session(user))
    return response


@app.post("/auth/logout")
def logout(request: Request, response: Response, user: dict = Depends(current_user)):
    """Sign out and drop this user's Gmail token. Other users are unaffected."""
    # Revoke the session server-side too, so a copied cookie stops working here
    # and not just in this browser.
    session.revoke_token(request.cookies.get(session.COOKIE_NAME) or "")
    auth.disconnect(user["sub"])
    session.clear_session_cookie(response)
    return {"ok": True, "message": "Signed out"}


@app.post("/auth/disconnect-gmail")
def disconnect_gmail(user: dict = Depends(current_user)):
    """Keep the session, but stop reading this user's inbox."""
    auth.disconnect(user["sub"])
    return {"gmail_connected": False}


@app.post("/api/sync-gmail")
def sync_gmail(user: dict = Depends(current_user)):
    """Read this user's inbox and return parsed applications.

    Nothing is persisted: the frontend merges the result into its own local
    list, so one person's jobs can never appear in someone else's table.
    """
    try:
        jobs = gmail_service.fetch_and_parse_jobs(user["sub"])
    except auth.AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"jobs": jobs, "count": len(jobs)}


@app.get("/api/health")
@app.get("/health")
def health():
    """Liveness check.

    Served at both paths: /health is what Vite's dev server probes, and that
    probe should get a real answer rather than a 404.
    """
    return {"status": "ok"}
