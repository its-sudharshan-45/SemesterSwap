import os
import sys

# Add the project root to the python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database import engine
from sqlalchemy import text

def run():
    print("Connecting to database...")
    db_dir = os.path.dirname(os.path.abspath(__file__))
    migration_files = ["phase5.sql", "phase5_enhancements.sql", "phase6.sql", "phase7_payment_flow_redesign.sql", "phase7_1_reliability_audit.sql", "phase8_remove_admin.sql"]
    
    with engine.connect() as conn:
        for file_name in migration_files:
            sql_file = os.path.join(db_dir, file_name)
            if not os.path.exists(sql_file):
                print(f"Warning: SQL file not found at {sql_file}, skipping.")
                continue
                
            print(f"Reading {file_name}...")
            with open(sql_file, "r") as f:
                statements = f.read()

            trans = conn.begin()
            try:
                print(f"Executing migration SQL from {file_name}...")
                conn.execute(text(statements))
                trans.commit()
                print(f"Migration from {file_name} applied successfully!")
            except Exception as e:
                trans.rollback()
                print(f"Migration from {file_name} failed! Transaction rolled back.")
                print(f"Error: {e}")
                sys.exit(1)

if __name__ == "__main__":
    run()
