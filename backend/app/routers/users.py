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


# === USER ENDPOINTS ===

@router.get("/", response_model=List[UserResponse])
async def get_users(db: Session = Depends(get_db)):
    """List all user profiles."""
    users = db.query(User).order_by(User.id).all()
    return [
        UserResponse(
            id=u.id,
            name=u.name,
            avatar_path=u.avatar_path,
            created_at=u.created_at.isoformat(),
        )
        for u in users
    ]


@router.post("/", response_model=UserResponse, status_code=201)
async def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """Create a new user profile."""
    user = User(name=user_data.name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse(
        id=user.id,
        name=user.name,
        avatar_path=user.avatar_path,
        created_at=user.created_at.isoformat(),
    )


@router.delete("/{user_id}")
async def delete_user(user_id: int, db: Session = Depends(get_db)):
    """
    Delete a user profile and all associated tracking data.
    Cascades to tracked_movies, tracked_shows, and tracked_episodes.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    db.delete(user)
    db.commit()

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

    os.makedirs(AVATAR_DIR, exist_ok=True)

    # Derive extension from original filename, default to jpg
    ext = "jpg"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()

    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(AVATAR_DIR, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    # Remove old avatar file if present
    if user.avatar_path:
        old_filepath = os.path.join("/app/data", user.avatar_path)
        if os.path.exists(old_filepath):
            os.remove(old_filepath)

    user.avatar_path = f"avatars/{filename}"
    db.commit()
    db.refresh(user)

    return UserResponse(
        id=user.id,
        name=user.name,
        avatar_path=user.avatar_path,
        created_at=user.created_at.isoformat(),
    )
