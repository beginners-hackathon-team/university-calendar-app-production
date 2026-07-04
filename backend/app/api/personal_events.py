from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, ensure_profile, get_current_user
from app.db.session import get_db
from app.models.personal_event import PersonalEvent
from app.schemas.task import CreatePersonalEvent, PersonalEventPublic, UpdatePersonalEvent

router = APIRouter()


@router.get("/api/personal-events", response_model=list[PersonalEventPublic])
def get_personal_events(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    return (
        db.query(PersonalEvent)
        .filter(PersonalEvent.user_id == current_user.user_id)
        .all()
    )


@router.post("/api/personal-events", response_model=PersonalEventPublic, status_code=201)
def create_personal_event(
    body: CreatePersonalEvent,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    ensure_profile(current_user.user_id, db)
    event = PersonalEvent(
        user_id=current_user.user_id,
        title=body.title,
        start=body.start,
        end=body.end,
        all_day=body.all_day,
        color=body.color,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.put("/api/personal-events/{event_id}", response_model=PersonalEventPublic)
def update_personal_event(
    event_id: str,
    body: UpdatePersonalEvent,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    event = (
        db.query(PersonalEvent)
        .filter(
            PersonalEvent.id == event_id,
            PersonalEvent.user_id == current_user.user_id,
        )
        .one_or_none()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Personal event not found")
    event.title = body.title
    event.start = body.start
    event.end = body.end
    event.all_day = body.all_day
    event.color = body.color
    db.commit()
    db.refresh(event)
    return event


@router.delete("/api/personal-events/{event_id}")
def delete_personal_event(
    event_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    event = (
        db.query(PersonalEvent)
        .filter(
            PersonalEvent.id == event_id,
            PersonalEvent.user_id == current_user.user_id,
        )
        .one_or_none()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Personal event not found")
    db.delete(event)
    db.commit()
    return Response(status_code=204)
