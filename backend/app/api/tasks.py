import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, ensure_profile, get_current_user
from app.db.session import get_db
from app.models.course import Course
from app.models.enrollment import Enrollment
from app.models.task import Task
from app.schemas.task import (
    AssignmentPublic,
    CreateTodo,
    TodoPublic,
    UpdateAssignmentBoardStatus,
    UpdateAssignmentDone,
    UpdateAssignmentTitle,
    UpdateTodo,
)
from app.services.assignment_filter import is_assignment_candidate

logger = logging.getLogger("uvicorn.error")

router = APIRouter()


@router.get("/api/assignments", response_model=list[AssignmentPublic])
def get_assignments(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(weeks=1)
    rows = (
        db.query(Task)
        .filter(
            Task.user_id == current_user.user_id,
            Task.type == "assignment",
            Task.is_hidden.is_(False),
            ~(Task.is_done.is_(True) & (Task.done_at < cutoff)),
        )
        .all()
    )
    candidates = []
    excluded_items = []
    for a in rows:
        if is_assignment_candidate(a.title, a.kind):
            candidates.append(a)
        else:
            excluded_items.append(a)

    logger.info(
        "[get-assignments] user=%s total=%d excluded=%d returned=%d",
        current_user.user_id,
        len(rows),
        len(excluded_items),
        len(candidates),
    )
    for a in excluded_items:
        logger.info(
            "[get-assignments] excluded: id=%s kind=%r title=%r",
            a.id,
            a.kind,
            a.title,
        )
    return candidates


@router.get("/api/lms-system-types")
def get_lms_system_types(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Course.lms_course_id, Course.lms_system_type)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .filter(
            Enrollment.user_id == current_user.user_id,
            Course.lms_course_id.isnot(None),
        )
        .all()
    )
    return {row.lms_course_id: row.lms_system_type for row in rows}


@router.put("/api/assignments/{assignment_id}/done")
def update_assignment_done(
    assignment_id: str,
    body: UpdateAssignmentDone,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    a = (
        db.query(Task)
        .filter(
            Task.id == assignment_id,
            Task.user_id == current_user.user_id,
            Task.type == "assignment",
        )
        .one_or_none()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    a.is_done = body.is_done
    a.done_at = datetime.now(timezone.utc) if body.is_done else None
    db.commit()
    return {"status": "ok"}


@router.put("/api/assignments/{assignment_id}/board-status")
def update_assignment_board_status(
    assignment_id: str,
    body: UpdateAssignmentBoardStatus,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    a = (
        db.query(Task)
        .filter(
            Task.id == assignment_id,
            Task.user_id == current_user.user_id,
            Task.type == "assignment",
        )
        .one_or_none()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    a.board_status = body.board_status
    if body.board_status == "done":
        a.is_done = True
        a.done_at = datetime.now(timezone.utc)
    else:
        a.is_done = False
        a.done_at = None
    db.commit()
    return {"status": "ok"}


@router.put("/api/assignments/{assignment_id}/title")
def update_assignment_title(
    assignment_id: str,
    body: UpdateAssignmentTitle,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    a = (
        db.query(Task)
        .filter(
            Task.id == assignment_id,
            Task.user_id == current_user.user_id,
            Task.type == "assignment",
        )
        .one_or_none()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    a.title = body.task_name
    db.commit()
    return {"status": "ok"}


@router.delete("/api/assignments/{assignment_id}")
def delete_assignment(
    assignment_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    a = (
        db.query(Task)
        .filter(
            Task.id == assignment_id,
            Task.user_id == current_user.user_id,
            Task.type == "assignment",
        )
        .one_or_none()
    )
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    a.is_hidden = True
    db.commit()
    return Response(status_code=204)


@router.get("/api/todos", response_model=list[TodoPublic])
def get_todos(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(weeks=1)
    return (
        db.query(Task)
        .filter(
            Task.user_id == current_user.user_id,
            Task.type == "todo",
            Task.is_hidden.is_(False),
            ~(Task.is_done.is_(True) & (Task.done_at < cutoff)),
        )
        .all()
    )


@router.post("/api/todos", response_model=TodoPublic, status_code=201)
def create_todo(
    body: CreateTodo,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    ensure_profile(current_user.user_id, db)
    todo = Task(
        user_id=current_user.user_id,
        title=body.title,
        type="todo",
        source_type="manual",
        source_provider="user",
    )
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo


@router.put("/api/todos/{todo_id}", response_model=TodoPublic)
def update_todo(
    todo_id: str,
    body: UpdateTodo,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    todo = (
        db.query(Task)
        .filter(
            Task.id == todo_id,
            Task.user_id == current_user.user_id,
            Task.type == "todo",
        )
        .one_or_none()
    )
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    if body.title is not None:
        todo.title = body.title
    if body.is_done is not None:
        todo.is_done = body.is_done
        if body.is_done:
            todo.done_at = datetime.now(timezone.utc)
        else:
            todo.done_at = None
    db.commit()
    db.refresh(todo)
    return todo


@router.delete("/api/todos/{todo_id}")
def delete_todo(
    todo_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    todo = (
        db.query(Task)
        .filter(
            Task.id == todo_id,
            Task.user_id == current_user.user_id,
            Task.type == "todo",
        )
        .one_or_none()
    )
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    todo.is_hidden = True
    db.commit()
    return Response(status_code=204)
