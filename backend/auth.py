import os
import json
from google_auth_oauthlib.flow import Flow

# The scopes we want: reading gmail
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

# Where Google will send the user after they log in
REDIRECT_URI = "http://localhost:8000/auth/callback"
STATE_FILE = "oauth_state.json"

def get_flow():
    # Initialize the OAuth flow using the credentials.json we downloaded
    return Flow.from_client_secrets_file(
        "credentials.json",
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )

def get_login_url():
    flow = get_flow()
    # Generate the URL that the user needs to visit to log in
    auth_url, state = flow.authorization_url(prompt='consent')
    
    # THE FIX: Save the code_verifier to a local file so we don't lose it!
    with open(STATE_FILE, "w") as f:
        json.dump({"verifier": flow.code_verifier, "state": state}, f)
        
    return auth_url

def exchange_code_for_token(code):
    flow = get_flow()
    
    # THE FIX: Read the saved verifier from the file
    with open(STATE_FILE, "r") as f:
        state_data = json.load(f)
        
    # Exchange the code for a token, passing the verifier!
    flow.fetch_token(code=code, code_verifier=state_data["verifier"])
    
    # Save the credentials to a file so we can use them later
    creds = flow.credentials
    with open("token.json", "w") as token:
        token.write(creds.to_json())
        
    # Clean up the temporary state file
    if os.path.exists(STATE_FILE):
        os.remove(STATE_FILE)
        
    return creds
