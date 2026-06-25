import os
from sqlalchemy import create_engine, text

def run_migration():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        # Fallback to local .env loading if run directly
        try:
            from dotenv import load_dotenv
            load_dotenv()
            database_url = os.environ.get("DATABASE_URL")
        except ImportError:
            pass

    if not database_url:
        print("DATABASE_URL environment variable is not set. Please configure it.")
        return

    # Handle URL encoding if present
    if "postgresql" in database_url:
        print(f"Connecting to database...")
    else:
        print(f"Connecting to database: {database_url}")

    engine = create_engine(database_url)
    
    with engine.begin() as conn:
        print("Dropping old constraint reviews_order_id_fkey if exists...")
        conn.execute(text("ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_order_id_fkey;"))
        
        print("Adding corrected reviews_order_id_fkey pointing to purchase_requests...")
        conn.execute(text("""
            ALTER TABLE reviews 
            ADD CONSTRAINT reviews_order_id_fkey 
            FOREIGN KEY (order_id) 
            REFERENCES purchase_requests(id) 
            ON DELETE CASCADE;
        """))
        print("Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
