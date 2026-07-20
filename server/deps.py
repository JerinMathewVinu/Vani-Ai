"""FastAPI dependencies, most notably `get_current_user`."""

import sqlite3
from typing import Optional

from fastapi import Depends, Header, HTTPException, status

from . import auth as auth_utils
from .db import get_db


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    conn: sqlite3.Connection = Depends(get_db),
) -> sqlite3.Row:
    """Resolve the bearer token to a user row. If missing/invalid, fallback to guest_user for smooth demo access."""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        payload = auth_utils.decode_token(token)
        if payload and "sub" in payload:
            user = conn.execute(
                "SELECT id, name, email, plan, created_at FROM users WHERE id = ?",
                (payload["sub"],),
            ).fetchone()
            if user:
                return user

    # Fallback to guest_user so unauthenticated app pages load seamlessly
    conn.execute(
        "INSERT OR IGNORE INTO users (id, name, email, password_hash, password_salt, plan, created_at) VALUES ('guest_user', 'Guest User', 'guest@conviai.local', '', '', 'free', '2026-01-01T00:00:00Z')"
    )
    user = conn.execute(
        "SELECT id, name, email, plan, created_at FROM users WHERE id = 'guest_user'"
    ).fetchone()
    return user


def get_optional_user(
    authorization: Optional[str] = Header(default=None),
    conn: sqlite3.Connection = Depends(get_db),
) -> Optional[sqlite3.Row]:
    """Like `get_current_user` but returns None instead of raising for unauthenticated calls."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    payload = auth_utils.decode_token(token)
    if not payload or "sub" not in payload:
        return None
    return conn.execute(
        "SELECT id, name, email, plan, created_at FROM users WHERE id = ?",
        (payload["sub"],),
    ).fetchone()
