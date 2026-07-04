from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user
from app.db.session import get_db
from app.models.profile import Profile

router = APIRouter()


class UpdateMePayload(BaseModel):
    display_name: str | None = None
    assignment_sync_mode: str | None = None


@router.get("/api/me")
def read_me(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    profile = db.get(Profile, current_user.user_id)
    return {
        "id": current_user.user_id,
        "display_name": profile.display_name if profile else None,
        "is_admin": current_user.is_admin,
        "assignment_sync_mode": profile.assignment_sync_mode if profile else "auto",
    }


@router.patch("/api/me")
def update_me(
    body: UpdateMePayload,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    if body.assignment_sync_mode is not None and body.assignment_sync_mode not in (
        "auto",
        "manual",
    ):
        raise HTTPException(
            status_code=400, detail="assignment_sync_mode must be 'auto' or 'manual'"
        )

    profile = db.get(Profile, current_user.user_id)
    if not profile:
        profile = Profile(
            user_id=current_user.user_id, display_name=None, is_admin=False
        )
        db.add(profile)

    if body.display_name is not None:
        profile.display_name = body.display_name
    if body.assignment_sync_mode is not None:
        profile.assignment_sync_mode = body.assignment_sync_mode

    db.commit()
    return {
        "display_name": profile.display_name,
        "assignment_sync_mode": profile.assignment_sync_mode,
    }
