"""Google OAuth 2.0 sign-in, scoped per user.

Google is both the identity provider and the Gmail provider, so one consent
screen covers "who are you" and "read my inbox". Two things make this safe for
more than one person at a time:

1. Every login attempt gets its own ``state`` value, and the PKCE verifier for
   that attempt is parked under that state. Two people can start a login at the
   same moment without overwriting each other.
2. Each user's Google credentials are written to their own file keyed by the
   immutable Google user id, so nobody can read or revoke anybody else's inbox.
"""

import hmac
import json
import os
import secrets
import threading
import time

import requests
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_FILE = os.getenv(
    "GOOGLE_CREDENTIALS_FILE", os.path.join(BACKEND_DIR, "credentials.json")
)
TOKENS_DIR = os.getenv("TOKENS_DIR", os.path.join(BACKEND_DIR, "tokens"))

REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback")

GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    GMAIL_SCOPE,
]

USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
STATE_TTL = 60 * 10  # A login attempt is abandoned after 10 minutes.

# In-flight logins: random state -> PKCE verifier. In memory on purpose: it is
# short-lived, and writing it to a shared file is exactly the race we are
# avoiding. Restarting the server only asks people to click "Sign in" again.
_pending_lock = threading.Lock()
_pending: dict[str, dict] = {}


class AuthError(Exception):
    """Raised when a sign-in attempt cannot be completed."""


def _purge_expired_pending() -> None:
    now = time.time()
    for state in [s for s, v in _pending.items() if v["created"] < now - STATE_TTL]:
        _pending.pop(state, None)


def token_path(user_id: str) -> str:
    """Path of the token file for a user.

    user_id is Google's immutable account id, but it is still sanitised so a
    crafted id can never escape the tokens directory.
    """
    safe = "".join(c for c in user_id if c.isalnum() or c in "-_")
    if not safe:
        raise AuthError("Invalid user id")
    return os.path.join(TOKENS_DIR, f"{safe}.json")


def get_flow() -> Flow:
    if not os.path.exists(CREDENTIALS_FILE):
        raise AuthError(
            f"Google OAuth client not found at {CREDENTIALS_FILE}. "
            "See README for setup steps."
        )
    return Flow.from_client_secrets_file(
        CREDENTIALS_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
        autogenerate_code_verifier=True,
    )


def get_login_url() -> tuple[str, str]:
    """Start a sign-in.

    Returns the Google URL to send the browser to, plus a one-time attempt id
    that the caller must store as a cookie. Requiring that cookie on the way
    back is what stops a sign-in started in one browser from being completed in
    another.
    """
    with _pending_lock:
        _purge_expired_pending()

    flow = get_flow()
    auth_url, state = flow.authorization_url(
        prompt="consent",
        access_type="offline",  # Needed for the refresh_token that keeps sync working.
        include_granted_scopes="true",
    )

    attempt = secrets.token_urlsafe(24)
    with _pending_lock:
        _pending[state] = {
            "verifier": flow.code_verifier,
            "created": time.time(),
            "attempt": attempt,
        }

    return auth_url, attempt


def _take_pending(state: str, attempt: str | None) -> dict:
    """Consume the PKCE verifier for this state, or fail loudly."""
    if not state:
        raise AuthError("Missing OAuth state")

    with _pending_lock:
        _purge_expired_pending()
        entry = _pending.pop(state, None)

    if entry is None:
        raise AuthError("Unknown or expired sign-in attempt. Please try again.")

    # The callback must come from the same browser that started the login.
    # A stolen or replayed state on its own is not enough.
    if not attempt or not hmac.compare_digest(entry["attempt"], attempt):
        raise AuthError("This sign-in was started in a different browser.")

    return entry


def _fetch_userinfo(creds: Credentials) -> dict:
    try:
        response = requests.get(
            USERINFO_URL,
            headers={"Authorization": f"Bearer {creds.token}"},
            timeout=15,
        )
    except requests.RequestException as exc:
        raise AuthError(f"Could not reach Google to read your profile: {exc}") from exc

    if not response.ok:
        raise AuthError(f"Google returned {response.status_code} while reading your profile.")

    info = response.json()
    if not info.get("sub") or not info.get("email"):
        raise AuthError("Google did not return an email address for this account.")

    return info


def complete_login(code: str, state: str, attempt: str | None = None) -> dict:
    """Exchange the callback code, store this user's token, return the user.

    Each user gets their own token file, so signing in as someone else never
    disturbs the tokens of the people already using the app.
    """
    entry = _take_pending(state, attempt)

    flow = get_flow()
    try:
        flow.fetch_token(code=code, code_verifier=entry["verifier"])
    except Exception as exc:  # google raises a variety of types here
        raise AuthError(f"Google rejected the sign-in: {exc}") from exc

    creds = flow.credentials
    info = _fetch_userinfo(creds)
    user_id = info["sub"]

    user = {
        "sub": user_id,
        "email": info["email"],
        "name": info.get("name") or info["email"].split("@")[0],
        "picture": info.get("picture"),
    }

    save_token(user_id, creds, info["email"])
    return user


def save_token(user_id: str, creds: Credentials, email: str) -> None:
    """Persist one user's Google credentials to their own file."""
    os.makedirs(TOKENS_DIR, exist_ok=True)
    path = token_path(user_id)
    payload = {"user_id": user_id, "email": email, "creds": json.loads(creds.to_json())}
    # Write to a temp file first so a crash cannot leave a truncated token behind.
    tmp = f"{path}.{os.getpid()}.tmp"
    with open(tmp, "w") as f:
        json.dump(payload, f)
    os.replace(tmp, path)
    os.chmod(path, 0o600)  # Grants inbox access: keep it owner-only.


def load_credentials(user_id: str) -> Credentials | None:
    """Load a user's credentials, refreshing them if they have expired.

    Returns None when the user has never connected or the grant was revoked.
    """
    path = token_path(user_id)
    if not os.path.exists(path):
        return None

    try:
        with open(path) as f:
            stored = json.load(f)
        creds = Credentials.from_authorized_user_info(stored["creds"], SCOPES)
    except (ValueError, KeyError, TypeError, json.JSONDecodeError, OSError) as exc:
        # Truncated, hand-edited or otherwise unusable: treat it as "not
        # connected" rather than failing the whole request.
        raise AuthError(
            "Your saved Google connection is unreadable. "
            "Please disconnect and connect Gmail again."
        ) from exc

    if creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request

        try:
            creds.refresh(Request())
        except Exception as exc:
            raise AuthError(
                "Your Google connection expired or was revoked. "
                "Please disconnect and connect Gmail again."
            ) from exc
        save_token(user_id, creds, stored.get("email", ""))

    return creds


def is_connected(user_id: str) -> bool:
    try:
        return os.path.exists(token_path(user_id))
    except AuthError:
        return False


def disconnect(user_id: str) -> bool:
    """Remove only this user's token. Other users are untouched."""
    try:
        path = token_path(user_id)
    except AuthError:
        return False
    if os.path.exists(path):
        os.remove(path)
        return True
    return False
