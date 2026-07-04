from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_admin_user, get_current_user
from app.db.session import get_db
from app.models.university_event import University_event
from app.schemas.university_event import CreateUniEvent, UpdateUniEvent

router = APIRouter()


@router.get("/api/university-events/{year}")
def get_university_events(
    year: int,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    events = db.query(University_event).filter(University_event.year == year).all()
    return [
        {
            "id": e.id,
            "name": e.name,
            "type": e.type,
            "date": e.date,
            "original_day": e.original_day,
        }
        for e in events
    ]


@router.post("/api/university-events")
def create_university_event(
    payload: CreateUniEvent,
    admin: Annotated[CurrentUser, Depends(get_admin_user)],
    db: Session = Depends(get_db),
):
    event = University_event(
        year=payload.year,
        name=payload.name,
        type=payload.type,
        date=payload.date,
        original_day=payload.original_day,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.put("/api/university-events/{uni_event_id}")
def update_university_event(
    uni_event_id: str,
    update_uni_event: UpdateUniEvent,
    admin: Annotated[CurrentUser, Depends(get_admin_user)],
    db: Session = Depends(get_db),
):
    event = (
        db.query(University_event)
        .filter(University_event.id == uni_event_id)
        .one_or_none()
    )
    if not event:
        raise HTTPException(status_code=404, detail="University Event not found")

    event.name = update_uni_event.name
    event.year = update_uni_event.year
    event.type = update_uni_event.type
    event.date = update_uni_event.date
    event.original_day = update_uni_event.original_day

    db.commit()
    db.refresh(event)
    return event


@router.delete("/api/university-events/{uni_event_id}")
def delete_university_event(
    uni_event_id: str,
    admin: Annotated[CurrentUser, Depends(get_admin_user)],
    db: Session = Depends(get_db),
):
    event = (
        db.query(University_event)
        .filter(University_event.id == uni_event_id)
        .one_or_none()
    )
    if not event:
        raise HTTPException(status_code=404, detail="University Event not found")

    db.delete(event)
    db.commit()
    return Response(status_code=204)
