"""Serialize DB row dicts for JSON (time/date/datetime -> string)."""
from datetime import time, date, datetime


def serialize_row(row):
    """Convert time/date/datetime in a dict to JSON-serializable strings."""
    if not row:
        return row
    out = dict(row)
    for key, val in list(out.items()):
        if val is None:
            continue
        if isinstance(val, time):
            out[key] = val.strftime('%H:%M:%S') if val.second or val.microsecond else val.strftime('%H:%M')
        elif isinstance(val, datetime):
            out[key] = val.isoformat()
        elif isinstance(val, date):
            out[key] = val.isoformat()
    return out


def serialize_rows(rows):
    """Serialize a list of row dicts."""
    return [serialize_row(r) for r in rows] if rows else []
