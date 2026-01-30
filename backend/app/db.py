import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from flask import g

connection_pool = None

def init_db(app):
    """Initialize the database connection pool"""
    global connection_pool
    connection_pool = psycopg2.pool.ThreadedConnectionPool(
        minconn=1,
        maxconn=10,
        host=app.config['DB_HOST'],
        database=app.config['DB_NAME'],
        user=app.config['DB_USER'],
        password=app.config['DB_PASSWORD'],
        port=app.config['DB_PORT']
    )

def get_db():
    """Get a database connection from the pool"""
    if 'db' not in g:
        g.db = connection_pool.getconn()
    return g.db

def close_db(e=None):
    """Return the connection to the pool"""
    db = g.pop('db', None)
    if db is not None:
        connection_pool.putconn(db)

def query_db(query, args=(), one=False):
    """Execute a query and return results as dictionaries"""
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, args)
            if query.strip().upper().startswith('SELECT'):
                rv = cur.fetchall()
                return (dict(rv[0]) if rv else None) if one else [dict(row) for row in rv]
            conn.commit()
            return cur.rowcount
    except Exception as e:
        conn.rollback()
        raise e

def insert_db(query, args=()):
    """Execute an insert and return the new ID"""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(query + " RETURNING id", args)
            conn.commit()
            return cur.fetchone()[0]
    except Exception as e:
        conn.rollback()
        raise e

def execute_db(query, args=()):
    """Execute a query without returning results (for UPDATE, DELETE)"""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(query, args)
            conn.commit()
            return cur.rowcount
    except Exception as e:
        conn.rollback()
        raise e
