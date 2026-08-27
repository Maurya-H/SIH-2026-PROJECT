import os
from contextlib import contextmanager

from dotenv import load_dotenv
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Add it to your .env locally, "
        "or as an environment variable on Render."
    )

connection_pool = pool.SimpleConnectionPool(
    minconn=1,
    maxconn=5,
    dsn=DATABASE_URL,
    cursor_factory=RealDictCursor,
)


@contextmanager
def get_connection():
    """
    Yields a pooled database connection and returns it to the pool afterward.

    Usage:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM incidents")
                rows = cur.fetchall()
    """
    conn = connection_pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        connection_pool.putconn(conn)


def close_pool():
    """Call this on app shutdown to close all pooled connections cleanly."""
    connection_pool.closeall()