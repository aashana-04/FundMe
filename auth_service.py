"""
FundMe Auth Service — signup, login, JWT token generation.
Clean MVP auth — no overengineering.
"""
import hashlib
import hmac
import os
import time
import base64
import json
import logging
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.orm import Session

from backend.models.auth import AuthUser

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)

# ── Simple secret key ──
SECRET_KEY = os.getenv("JWT_SECRET", "fundme-secret-key-change-in-production-2024")
TOKEN_EXPIRY_SECONDS = 7 * 24 * 3600  # 7 days


# ── Password hashing ──

def _hash_password(password: str) -> str:
    """SHA-256 based password hash with pepper."""
    pepper = SECRET_KEY[:16]
    salted = f"{pepper}:{password}"
    return hashlib.sha256(salted.encode()).hexdigest()


def _verify_password(password: str, stored_hash: str) -> bool:
    return hmac.compare_digest(_hash_password(password), stored_hash)


# ── Simple JWT-like token (base64 JSON + signature) ──

def _create_token(user_id: str, email: str) -> str:
    """Create a simple signed token (not full JWT, but sufficient for MVP)."""
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": int(time.time()) + TOKEN_EXPIRY_SECONDS,
        "iat": int(time.time()),
    }
    payload_b64 = base64.urlsafe_b64encode(
        json.dumps(payload).encode()
    ).decode()
    sig = hmac.new(
        SECRET_KEY.encode(),
        payload_b64.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"{payload_b64}.{sig}"


def verify_token(token: str) -> dict | None:
    """Verify token and return payload if valid."""
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, sig = parts
        expected_sig = hmac.new(
            SECRET_KEY.encode(),
            payload_b64.encode(),
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "==").decode())
        if payload.get("exp", 0) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


# ── Auth Operations ──

def signup_user(db: Session, name: str, email: str, password: str) -> dict:
    """Register new user. Returns token dict or raises ValueError."""
    existing = db.query(AuthUser).filter(AuthUser.email == email.lower().strip()).first()
    if existing:
        raise ValueError("An account with this email already exists.")

    user = AuthUser(
        name=name.strip(),
        email=email.lower().strip(),
        password_hash=_hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = _create_token(user.id, user.email)
    logger.info("New user registered: %s", user.email)
    return {
        "success": True,
        "token": token,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "message": f"Welcome to FundMe, {user.name}!",
    }


def login_user(db: Session, email: str, password: str) -> dict:
    """Authenticate user. Returns token dict or raises ValueError."""
    user = db.query(AuthUser).filter(AuthUser.email == email.lower().strip()).first()
    if not user or not _verify_password(password, user.password_hash):
        raise ValueError("Invalid email or password.")
    if not user.is_active:
        raise ValueError("Account is deactivated.")

    token = _create_token(user.id, user.email)
    logger.info("User logged in: %s", user.email)
    return {
        "success": True,
        "token": token,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "message": f"Welcome back, {user.name}!",
    }


def get_user_by_id(db: Session, user_id: str) -> AuthUser | None:
    return db.query(AuthUser).filter(AuthUser.id == user_id).first()
