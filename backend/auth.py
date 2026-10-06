"""Create-account and login against the existing `users` table, with sessions stored in `sessions`."""

import hashlib
import hmac
import secrets
import sqlite3

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, field_validator

from db import get_db

router = APIRouter(prefix="/api/auth")

# Matches the format already used in the DB: pbkdf2_sha256$<salt>$<hex digest>
PBKDF2_ITERATIONS = 120_000

SESSION_DAYS = 30  # how long a login lasts before the customer has to log in again


def init_table() -> None:
    """Create the sessions table on startup if it doesn't exist yet. Safe to run every time."""
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,  -- SHA-256 of the token; the raw token is never stored
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                expires_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
            """
        )
        conn.execute("DELETE FROM sessions WHERE expires_at <= datetime('now')")  # tidy up old logins


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _token_from_header(authorization: str | None) -> str:
    return (authorization or "").removeprefix("Bearer ").strip()


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(8)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, salt, _ = stored.split("$")
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    return hmac.compare_digest(hash_password(password, salt), stored)


def public_user(row: sqlite3.Row) -> dict:
    """User fields that are safe to send to the browser (never the hash)."""
    return {
        "id": row["id"],
        "email": row["email"],
        "first_name": row["first_name"] or row["name"].split(" ")[0],
        "last_name": row["last_name"] or "",
    }


def start_session(row: sqlite3.Row) -> dict:
    token = secrets.token_urlsafe(32)
    with get_db() as conn:
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))",
            (_token_hash(token), row["id"], f"+{SESSION_DAYS} days"),
        )
    return {"token": token, "user": public_user(row)}


def user_id_from_header(authorization: str | None) -> int:
    token = _token_from_header(authorization)
    row = None
    if token:
        with get_db() as conn:
            row = conn.execute(
                "SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > datetime('now')",
                (_token_hash(token),),
            ).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Not logged in")
    return row["user_id"]


def optional_user(authorization: str | None) -> dict | None:
    """The logged-in user's public info, or None for guests / unknown tokens."""
    try:
        user_id = user_id_from_header(authorization)
    except HTTPException:
        return None
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return public_user(row) if row else None


class SignupRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str

    @field_validator("first_name", "last_name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("is required")
        return v.strip()

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("is not a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def long_enough(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/signup")
def signup(body: SignupRequest) -> dict:
    with get_db() as conn:
        try:
            cur = conn.execute(
                """INSERT INTO users (name, email, password_hash, first_name, last_name)
                   VALUES (?, ?, ?, ?, ?)""",
                (
                    f"{body.first_name} {body.last_name}",
                    body.email,
                    hash_password(body.password),
                    body.first_name,
                    body.last_name,
                ),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="An account with that email already exists")
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    return start_session(row)


@router.post("/login")
def login(body: LoginRequest) -> dict:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (body.email.strip().lower(),)
        ).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return start_session(row)


@router.get("/me")
def me(authorization: str | None = Header(default=None)) -> dict:
    user_id = user_id_from_header(authorization)
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Not logged in")
    return public_user(row)


@router.post("/logout")
def logout(authorization: str | None = Header(default=None)) -> dict:
    token = _token_from_header(authorization)
    if token:
        with get_db() as conn:
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))
    return {"ok": True}
