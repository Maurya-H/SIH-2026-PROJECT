import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://sih_user:sih_password@localhost:5432/sih_db")


def get_connection():
    """
    Opens and returns a new database connection.
    Each route should call this, use it, and close it when done.
    """
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn