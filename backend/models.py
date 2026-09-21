from database import Base
from sqlalchemy import Column, Date, Integer, String

class Job(Base):
   __tablename__ = "jobs"

   id = Column(Integer, primary_key=True, index=True, autoincrement=True)
   company = Column(String, index=True)
   role = Column(String)
   status = Column(String, default="Applied")
   date = Column(String) # Using String for simplicity, or you can use Date
