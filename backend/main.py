from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import date
import auth
import os
import gmail_service

# Import our local files
import models, schemas
from database import engine, get_db

# This creates the database tables if they don't exist yet
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. READ: Get all jobs
@app.get("/api/jobs", response_model=list[schemas.JobResponse])
def get_jobs(db: Session = Depends(get_db)):
    # Query the database for all jobs, ordered by date descending (newest first)
    jobs = db.query(models.Job).order_by(models.Job.date.desc()).all()
    return jobs

# 2. CREATE: Add a new job
@app.post("/api/jobs", response_model=schemas.JobResponse)
def create_job(job: schemas.JobCreate, db: Session = Depends(get_db)):
    # Create a new database object
    db_job = models.Job(**job.dict())
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    return db_job

# 3. READ: Get a specific job by ID
@app.get("/api/jobs/{job_id}", response_model=schemas.JobResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    # Query the database for the job with the given ID
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

# 4. UPDATE: Change a job's status or details
@app.put("/api/jobs/{job_id}", response_model=schemas.JobResponse)
def update_job(job_id: int, job_update: schemas.JobCreate, db: Session = Depends(get_db)):
    # 1. Find the job
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    # 2. Update the fields
    db_job.status = job_update.status
    db_job.company = job_update.company 
    db_job.role = job_update.role
    
    db.commit()
    db.refresh(db_job)
    return db_job

# 5. DELETE: Remove a job
@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    db_job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    db.delete(db_job)
    db.commit()
    return {"message": "Job deleted successfully"}

# 1. Frontend calls this to get the Google Login URL
@app.get("/auth/login")
def login():
    url = auth.get_login_url()
    return {"url": url}

# 2. Google redirects the user here after they log in
@app.get("/auth/callback")
def auth_callback(code: str):
    # Exchange the temporary code for a long-lived token
    auth.exchange_code_for_token(code)
    
    # Redirect the user back to the frontend!
    return RedirectResponse(url="http://localhost:5173?login=success")

@app.get("/auth/status")
def auth_status():
    # Just check if the token file exists
    connected = os.path.exists("token.json")
    return {"connected": connected}

# 6. LOGOUT: Delete the saved token so the user is actually logged out
@app.post("/auth/logout")
def logout():
    # Delete the stored Google OAuth token
    if os.path.exists("token.json"):
        os.remove("token.json")
    # Clean up any leftover OAuth handshake state
    if os.path.exists(auth.STATE_FILE):
        os.remove(auth.STATE_FILE)
    return {"connected": False, "message": "Logged out successfully"}

@app.post("/api/sync-gmail")
def sync_gmail(db: Session = Depends(get_db)):
    new_jobs = gmail_service.fetch_and_parse_jobs()
    
    added_count = 0
    seen = set()  # THE FIX: track what we've added during this sync
    
    for job_data in new_jobs:
        key = (job_data['company'], job_data['role'])
        if key in seen:
            continue  # Skip duplicates within this batch
        seen.add(key)
        
        exists = db.query(models.Job).filter(
            models.Job.company == job_data['company'],
            models.Job.role == job_data['role']
        ).first()
        
        if not exists:
            db_job = models.Job(**job_data)
            db.add(db_job)
            added_count += 1
            
    db.commit()
    return {"message": f"Sync complete! Added {added_count} new jobs.", "added": added_count}
