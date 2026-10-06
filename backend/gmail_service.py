"""Gmail search and email parsing for one specific user.

Nothing here reads a shared token file: the caller passes in the credentials
that belong to the person who is signed in, so a sync can only ever read that
person's inbox.
"""

from email.utils import parsedate_to_datetime

from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

import auth

# Subject patterns that usually mean an application was received.
QUERY = (
    'subject:"application" OR subject:"received your application" '
    'OR subject:"thank you for applying" OR subject:"we have received"'
)

MAX_RESULTS = 25

# Generic lead-ins stripped from the subject to leave just the role.
PREFIXES_TO_REMOVE = [
    "Application received for ",
    "Thank you for applying to ",
    "Your application to ",
    "We have received your application for ",
]


def get_gmail_service(creds: Credentials):
    return build("gmail", "v1", credentials=creds)


def _parse_company(sender: str) -> str:
    # "Greenhouse <jobs@greenhouse.io>" -> "Greenhouse"
    if "<" in sender and ">" in sender:
        name = sender.split("<")[0].strip().strip('"')
        if name:
            return name
        sender = sender.split("<", 1)[1]
    if "@" in sender:
        return sender.rsplit("@", 1)[-1].split(">")[0].split(".")[0].capitalize()
    return "Unknown"


def _parse_role(subject: str) -> str:
    role = subject.strip()
    for prefix in PREFIXES_TO_REMOVE:
        if role.lower().startswith(prefix.lower()):
            return role[len(prefix):].strip()
    return role or "Unknown Role"


def _parse_date(date_str: str) -> str:
    try:
        return parsedate_to_datetime(date_str).strftime("%Y-%m-%d")
    except Exception:
        return date_str


def fetch_and_parse_jobs(user_id: str) -> list[dict]:
    """Search this user's Gmail and extract one entry per application email.

    Raises auth.AuthError when the user has not connected Gmail, or when their
    grant has expired and needs reconnecting.
    """
    creds = auth.load_credentials(user_id)
    if not creds:
        raise auth.AuthError("Connect your Gmail account first to sync.")

    service = get_gmail_service(creds)

    results = (
        service.users()
        .messages()
        .list(userId="me", q=QUERY, maxResults=MAX_RESULTS)
        .execute()
    )
    messages = results.get("messages", [])
    if not messages:
        return []

    parsed_jobs = []
    for summary in messages:
        msg = (
            service.users()
            .messages()
            .get(
                userId="me",
                id=summary["id"],
                format="metadata",
                metadataHeaders=["From", "Subject", "Date"],
            )
            .execute()
        )

        headers = {h["name"]: h["value"] for h in msg["payload"]["headers"]}
        subject = headers.get("Subject", "Unknown Role")
        sender = headers.get("From", "Unknown Company")

        parsed_jobs.append(
            {
                "company": _parse_company(sender),
                "role": _parse_role(subject),
                "date": _parse_date(headers.get("Date", "")),
                "status": "Applied",
            }
        )

    return parsed_jobs
