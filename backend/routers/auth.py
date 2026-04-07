import json
import os
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, HTTPException, Header
from jose import JWTError, jwt
from pydantic import BaseModel

from config import JWT_SECRET

router = APIRouter()

USERS_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "users.json")
ALGORITHM  = "HS256"
TOKEN_DAYS = 30


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_users() -> dict:
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, "r") as f:
        return json.load(f)


def _save_users(users: dict) -> None:
    os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)


def _create_token(email: str) -> str:
    payload = {
        "sub": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def _decode_token(token: str) -> str:
    """Returns email (sub) or raises HTTPException."""
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        email: str = data.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
        return email
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class UserResponse(BaseModel):
    email: str
    username: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=AuthResponse)
def register(body: RegisterRequest):
    users = _load_users()

    if body.email in users:
        raise HTTPException(status_code=400, detail="Email already registered")

    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    users[body.email] = {
        "username": body.username,
        "password_hash": password_hash,
    }
    _save_users(users)

    token = _create_token(body.email)
    return AuthResponse(
        token=token,
        user={"email": body.email, "username": body.username},
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest):
    users = _load_users()

    record = users.get(body.email)
    if not record:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not bcrypt.checkpw(body.password.encode(), record["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _create_token(body.email)
    return AuthResponse(
        token=token,
        user={"email": body.email, "username": record["username"]},
    )


@router.get("/me", response_model=UserResponse)
def me(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization.removeprefix("Bearer ")
    email = _decode_token(token)

    users = _load_users()
    record = users.get(email)
    if not record:
        raise HTTPException(status_code=401, detail="User not found")

    return UserResponse(email=email, username=record["username"])
