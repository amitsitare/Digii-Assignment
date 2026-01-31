"""
Vercel serverless entrypoint.
Vercel looks for a Flask `app` at index.py, app.py, or server.py.
"""
from app import create_app

app = create_app()
