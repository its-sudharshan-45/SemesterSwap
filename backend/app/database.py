from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from backend.app.config import settings

# If using SQLite, allow multithreading access and disable insertmanyvalues
connect_args = {}
extra_params = {}
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    extra_params["use_insertmanyvalues"] = False
else:
    extra_params["pool_pre_ping"] = True
    extra_params["pool_recycle"] = 300

engine = create_engine(
    db_url,
    connect_args=connect_args,
    **extra_params
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
