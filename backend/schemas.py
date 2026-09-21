from pydantic import BaseModel, Field

# What the frontend sends when creating a job
class JobCreate(BaseModel):
   company: str
   role: str
   status: str = "Applied"
   date: str =  "yyyy-mm-dd"

# What the backend sends back to the frontend
class JobResponse(BaseModel):
   id: int
   company: str
   role: str
   status: str
   date: str

class JobUpdate(BaseModel):
    company:str | None = None
    role:str | None = None
    status:str | None = None
    date: str | None = None

class Config:
   from_attributes = True # Crucial for SQLAlchemy compatibility in newer Pydantic
