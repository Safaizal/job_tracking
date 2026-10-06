"""Signed session cookies (HS256 JWT) built with the standard library only.

One cookie identifies the logged-in Google account. The payload is small on
purpose: a stable user id, the email and the display name. Nothing that changes
often belongs here.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import threading
import time

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
SECRET_FILE = os.path.join(BACKEND_DIR, ".session_secret")

COOKIE_NAME = "jobtracker_session"
DEFAULT_TTL = 60 * 60 * 24 * 7  # 7 days

HEADER = {"alg": "HS256", "typ": "JWT"}


def get_secret() -> str:
    """Return the signing secret, generating one on first run.

    Set SESSION_SECRET in the environment (recommended for deployments) or a
    random secret is created once and reused from .session_secret.
    """
    from_env = os.getenv("SESSION_SECRET")
    if from_env:
        return from_env

    try:
        with open(SECRET_FILE, "r") as f:
            secret = f.read().strip()
            if secret:
                return secret
    except FileNotFoundError:
        pass

    secret = secrets.token_hex(32)
    with open(SECRET_FILE, "w") as f:
        f.write(secret)
    os.chmod(SECRET_FILE, 0o600)  # Owner-only: this signs every session.
    return secret


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def create_session(user: dict, ttl_seconds: int = DEFAULT_TTL) -> str:
    """Build a signed token for a user, e.g. {"sub": ..., "email": ..., "name": ...}."""
    issued_at = int(time.time())
    payload = dict(user)
    payload["iat"] = issued_at
    payload["exp"] = issued_at + ttl_seconds
    # jti lets a single session be revoked on logout, which a stateless
    # signature alone cannot do.
    payload["jti"] = secrets.token_hex(16)

    header_segment = _b64encode(json.dumps(HEADER, separators=(",", ":")).encode())
    payload_segment = _b64encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")

    signature = hmac.new(get_secret().encode(), signing_input, hashlib.sha256).digest()
    return f"{header_segment}.{payload_segment}.{_b64encode(signature)}"


# Revoked session ids, so "log out" genuinely ends the session instead of just
# asking the browser to drop a cookie it would otherwise honour until expiry.
_revoked_lock = threading.Lock()
_revoked: dict[str, float] = {}


def revoke_token(token: str) -> bool:
    """Invalidate one session. Returns True if it was still live."""
    payload = read_session(token)
    if not payload:
        return False
    with _revoked_lock:
        _revoked[payload["jti"]] = float(payload.get("exp", 0))
    return True


def _is_revoked(payload: dict) -> bool:
    jti = payload.get("jti")
    if not jti:
        return False
    with _revoked_lock:
        now = time.time()
        # Drop entries that have expired anyway, so this cannot grow forever.
        for expired in [k for k, exp in _revoked.items() if exp < now]:
            _revoked.pop(expired, None)
        return jti in _revoked


def read_session(token: str, verify_exp: bool = True) -> dict | None:
    """Verify a token and return its payload, or None if it is invalid/expired/revoked."""
    if not token:
        return None

    try:
        header_segment, payload_segment, signature_segment = token.split(".")
        signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
        expected = hmac.new(get_secret().encode(), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(_b64decode(signature_segment), expected):
            return None

        header = json.loads(_b64decode(header_segment))
        if header.get("alg") != "HS256":  # Reject "alg": "none" and other tricks.
            return None

        payload = json.loads(_b64decode(payload_segment))
    except (ValueError, TypeError, json.JSONDecodeError, base64.binascii.Error):
        return None

    if not payload.get("sub"):
        return None
    if verify_exp and payload.get("exp", 0) < time.time():
        return None
    if _is_revoked(payload):
        return None

    return payload


def cookie_kwargs(name: str = COOKIE_NAME) -> dict:
    """Cookie flags shared by set and clear so browsers actually drop the cookie."""
    return {
        "key": name,
        "httponly": True,  # Never readable from JavaScript.
        "samesite": "lax",  # Sent on the top-level redirect back from Google.
        "secure": os.getenv("COOKIE_SECURE", "0") == "1",  # Enable behind HTTPS.
        "path": "/",
    }


def set_session_cookie(response, token: str, max_age: int = DEFAULT_TTL) -> None:
    response.set_cookie(value=token, max_age=max_age, **cookie_kwargs())


def clear_session_cookie(response) -> None:
    response.delete_cookie(**cookie_kwargs())


# A sign-in in progress, identified per browser so the callback can only be
# completed by the same browser that started it.
ATTEMPT_COOKIE = "jobtracker_login_attempt"
ATTEMPT_TTL = 60 * 10  # Matches the in-memory attempt lifetime.


def set_attempt_cookie(response, attempt: str) -> None:
    response.set_cookie(value=attempt, max_age=ATTEMPT_TTL, **cookie_kwargs(ATTEMPT_COOKIE))


def clear_attempt_cookie(response) -> None:
    response.delete_cookie(**cookie_kwargs(ATTEMPT_COOKIE))
