from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# This creates a file called 'jobs.db' in your backend folder.
SQLALCHEMY_DATABASE_URL = "sqlite:///./jobs.db"

engine = create_engine( SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get the DB session in our endpoints
def get_db():
   db = SessionLocal()
   try:
       yield db
   finally:
       db.close()
