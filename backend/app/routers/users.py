"""
===================================================================================
Script: users.py
Purpose:
    User management router for Watchlist application.
    Handles CRUD operations for user profiles and avatar uploads.
    No authentication — profiles are Netflix-style (just pick one).

Author: Frank Kelly
Date: 22-02-2026
===================================================================================
"""

import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.database import get_db
from app.models import User


# === PYDANTIC MODELS ===

class UserCreate(BaseModel):
    """Request model for creating a user."""
    name: str


class UserResponse(BaseModel):
    """Response model for user profile data."""
    id: int
    name: str
    avatar_path: Optional[str]
    created_at: str

    class Config:
        from_attributes = True


# === ROUTER INITIALISATION ===

router = APIRouter()

AVATAR_DIR = "/app/data/avatars"

# Only image formats browsers render safely as <img>. Anything else (e.g. .html,
# .svg) would be served back from /api/avatars with an executable content type.
ALLOWED_AVATAR_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}
MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB


# === HELPER ===

def _user_response(u: User) -> UserResponse:
    return UserResponse(
        id=u.id,
        name=u.name,
        avatar_path=u.avatar_path,
        created_at=u.created_at.isoformat() if u.created_at else '',
    )


def _remove_avatar_file(avatar_path: str):
    """Delete an avatar file from disk, ignoring missing files."""
    filepath = os.path.join("/app/data", avatar_path)
    if os.path.exists(filepath):
        os.remove(filepath)


# === USER ENDPOINTS ===

@router.get("/", response_model=List[UserResponse])
async def get_users(db: Session = Depends(get_db)):
    """List all user profiles."""
    users = db.query(User).order_by(User.id).all()
    return [_user_response(u) for u in users]


@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """Create a new user profile."""
    name = user_data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")

    user = User(name=name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_response(user)


@router.delete("/{user_id}")
async def delete_user(user_id: int, db: Session = Depends(get_db)):
    """
    Delete a user profile and all associated tracking data.
    Cascades to tracked_movies, tracked_shows, and tracked_episodes.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    avatar_path = user.avatar_path
    db.delete(user)
    db.commit()

    if avatar_path:
        _remove_avatar_file(avatar_path)

    return {"message": "User deleted", "user_id": user_id}


@router.post("/{user_id}/avatar", response_model=UserResponse)
async def upload_avatar(
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload or replace a user's avatar image.
    Saves file to /app/data/avatars/{uuid}.{ext} and updates the user record.
    Old avatar file is deleted if it exists.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    # Derive extension from original filename, default to jpg
    ext = "jpg"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()

    if ext not in ALLOWED_AVATAR_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type '.{ext}'. Allowed: {', '.join(sorted(ALLOWED_AVATAR_EXTENSIONS))}"
        )

    content = await file.read()
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Avatar too large ({len(content) // 1024} KB). Maximum is {MAX_AVATAR_BYTES // (1024 * 1024)} MB."
        )

    os.makedirs(AVATAR_DIR, exist_ok=True)

    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(AVATAR_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    # Remove old avatar file if present
    if user.avatar_path:
        _remove_avatar_file(user.avatar_path)

    user.avatar_path = f"avatars/{filename}"
    db.commit()
    db.refresh(user)

    return _user_response(user)
