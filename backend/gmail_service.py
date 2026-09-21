import os
import re
from datetime import datetime
from email.utils import parsedate_to_datetime
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

def get_gmail_service():
    """Builds the Gmail API service using our saved token."""
    if not os.path.exists("token.json"):
        return None
    
    creds = Credentials.from_authorized_user_file("token.json", ['https://www.googleapis.com/auth/gmail.readonly'])
    return build('gmail', 'v1', credentials=creds)

def fetch_and_parse_jobs():
    """Searches Gmail for application emails and extracts data."""
    service = get_gmail_service()
    if not service:
        return []

    # This is the magic Gmail search query. 
    # We are looking for subjects that usually indicate an application was received.
    query = 'subject:"application" OR subject:"received your application" OR subject:"thank you for applying"'
    
    # Fetch message IDs
    results = service.users().messages().list(userId='me', q=query, maxResults=20).execute()
    messages = results.get('messages', [])
    
    parsed_jobs = []

    if not messages:
        return []

    # Fetch full details for each message
    for msg_summary in messages:
        msg = service.users().messages().get(
            userId='me', 
            id=msg_summary['id'], 
            format='metadata',
            metadataHeaders=['From', 'Subject', 'Date']
        ).execute()

        headers = {h['name']: h['value'] for h in msg['payload']['headers']}
        
        subject = headers.get('Subject', 'Unknown Role')
        sender = headers.get('From', 'Unknown Company')
        date_str = headers.get('Date', '')

        # --- Basic Parsing Logic ---
        # 1. Extract Company: Usually the email domain or the name before the <email>
        company = "Unknown"
        if '<' in sender and '>' in sender:
            # e.g., "Greenhouse <jobs@greenhouse.io>" -> "Greenhouse"
            company = sender.split('<')[0].strip()
            if not company:
                # fallback to domain if name is empty
                domain = sender.split('@')[-1].replace('>', '')
                company = domain.split('.')[0].capitalize()
        else:
            company = sender.split('@')[-1].split('.')[0].capitalize()

        # 2. Clean up Role: Remove generic prefixes
        role = subject
        prefixes_to_remove = ["Application received for ", "Thank you for applying to ", "Your application to "]
        for prefix in prefixes_to_remove:
            if role.lower().startswith(prefix.lower()):
                role = role[len(prefix):]
                break

        # 3. Format Date: Convert Gmail's RFC2822 date to YYYY-MM-DD
        formatted_date = ""
        try:
            dt = parsedate_to_datetime(date_str)
            formatted_date = dt.strftime('%Y-%m-%d')
        except Exception:
            formatted_date = date_str # Fallback to raw string if parsing fails

        parsed_jobs.append({
            "company": company,
            "role": role,
            "date": formatted_date,
            "status": "Applied"
        })

    return parsed_jobs
