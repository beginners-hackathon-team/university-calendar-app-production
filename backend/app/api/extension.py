import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, ensure_profile, get_current_user
from app.db.session import get_db
from app.models.course import Course
from app.models.course_date import CourseDate
from app.models.enrollment import Enrollment
from app.models.task import Task
from app.schemas.extension import ExtensionSyncPayload, ImportCoursesPayload
from app.schemas.task import ImportAssignmentsPayload, ImportLmsTasksPayload
from app.services.assignment_filter import is_assignment_candidate

logger = logging.getLogger("uvicorn.error")

router = APIRouter()


@router.post("/api/extension/sync")
def extension_sync(
    payload: ExtensionSyncPayload,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    print(
        f"[extension/sync] user={current_user.user_id} type={payload.type} "
        f"url={payload.url} html_len={len(payload.html)}"
    )
    return {"status": "received", "type": payload.type}


@router.post("/api/extension/import-courses")
def import_courses(
    payload: ImportCoursesPayload,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    ensure_profile(current_user.user_id, db)

    # 集中講義は day_of_week=None/period=0 が全授業で同一になるため、
    # name を加えた 5-tuple をキーにして区別する
    def make_key(year, quarter, day_of_week, period, name):
        if day_of_week is None and period == 0:
            return (year, quarter, None, 0, name)
        return (year, quarter, day_of_week, period, None)

    existing_map: dict[tuple, tuple] = {}
    enrolled_course_ids = {
        e.course_id
        for e in db.query(Enrollment)
        .filter(Enrollment.user_id == current_user.user_id)
        .all()
    }
    if enrolled_course_ids:
        for cd in (
            db.query(CourseDate)
            .filter(CourseDate.course_id.in_(enrolled_course_ids))
            .all()
        ):
            course_obj = (
                db.query(Course).filter(Course.id == cd.course_id).one_or_none()
            )
            if course_obj:
                key = make_key(
                    cd.year, cd.quarter, cd.day_of_week, cd.period, course_obj.name
                )
                existing_map[key] = (course_obj, cd)

    incoming_keys: set[tuple] = set()
    count = 0
    for item in payload.courses:
        key = make_key(
            item.year, item.quarter, item.day_of_week, item.period, item.name
        )
        incoming_keys.add(key)
        if key in existing_map:
            # 既存コースを上書き
            existing_course, existing_cd = existing_map[key]
            existing_course.name = item.name
            existing_course.room = item.room
            existing_course.teacher = item.teacher
            existing_course.lms_course_id = item.lms_course_id
            existing_course.lms_system_type = item.lms_system_type
            existing_cd.is_intensive_lct = item.is_intensive_lct
        else:
            # 新規追加
            course = Course(
                name=item.name,
                room=item.room,
                teacher=item.teacher,
                lms_course_id=item.lms_course_id,
                lms_system_type=item.lms_system_type,
            )
            db.add(course)
            db.flush()
            db.add(
                CourseDate(
                    course_id=course.id,
                    year=item.year,
                    quarter=item.quarter,
                    day_of_week=item.day_of_week,
                    period=item.period,
                    is_intensive_lct=item.is_intensive_lct,
                )
            )
            db.add(Enrollment(course_id=course.id, user_id=current_user.user_id))
            existing_map[key] = (course, CourseDate())
        count += 1

    # sync スコープ内にあって今回の取得結果に含まれないコースを削除
    sync_quarters = set(payload.sync_quarters)
    for key, (course_obj, cd_obj) in list(existing_map.items()):
        y, q = key[0], key[1]
        if y == payload.sync_year and q in sync_quarters and key not in incoming_keys:
            db.query(Enrollment).filter(
                Enrollment.course_id == course_obj.id,
                Enrollment.user_id == current_user.user_id,
            ).delete()
            db.query(CourseDate).filter(CourseDate.id == cd_obj.id).delete()
            db.query(Course).filter(Course.id == course_obj.id).delete()

    db.commit()
    return {"status": "ok", "count": count}


@router.post("/api/extension/import-assignments")
def import_assignments(
    payload: ImportAssignmentsPayload,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    ensure_profile(current_user.user_id, db)
    all_existing = (
        db.query(Task)
        .filter(
            Task.user_id == current_user.user_id,
            Task.type == "assignment",
        )
        .all()
    )
    by_contents_id = {a.task_contents_id: a for a in all_existing if a.task_contents_id}
    by_name = {(a.title, a.course_name): a for a in all_existing}

    count = 0
    for item in payload.assignments:
        existing_a = None
        if item.task_contents_id and item.task_contents_id in by_contents_id:
            existing_a = by_contents_id[item.task_contents_id]
        elif (item.task_name, item.course_name) in by_name:
            existing_a = by_name[(item.task_name, item.course_name)]

        if existing_a:
            existing_a.title = item.task_name
            existing_a.course_name = item.course_name
            existing_a.submitted_at = item.submitted_at
            existing_a.result = item.result
            existing_a.score = item.score
            if item.task_contents_id:
                existing_a.task_contents_id = item.task_contents_id
        else:
            db.add(
                Task(
                    user_id=current_user.user_id,
                    title=item.task_name,
                    task_contents_id=item.task_contents_id or "",
                    course_name=item.course_name,
                    submitted_at=item.submitted_at,
                    result=item.result or "",
                    score=item.score,
                    type="assignment",
                    source_type="lms",
                    source_provider="kanazawa_lms",
                )
            )
        count += 1

    db.commit()
    return {"status": "ok", "count": count}


@router.post("/api/extension/import-lms-tasks")
def import_lms_tasks(
    payload: ImportLmsTasksPayload,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    ensure_profile(current_user.user_id, db)
    all_existing = (
        db.query(Task)
        .filter(
            Task.user_id == current_user.user_id,
            Task.type == "assignment",
        )
        .all()
    )

    # Primary key: (lms_course_id, task_contents_id)
    by_course_content = {
        (a.lms_course_id, a.task_contents_id): a
        for a in all_existing
        if a.lms_course_id and a.task_contents_id
    }
    # Fallback key: (lms_course_id, source_url) for items without content_id
    by_course_source_url = {
        (a.lms_course_id, a.source_url): a
        for a in all_existing
        if a.lms_course_id and a.source_url and not a.task_contents_id
    }

    # lms_course_id → source_provider の対応表を enrolled コースから構築
    enrolled_courses = (
        db.query(Course)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .filter(
            Enrollment.user_id == current_user.user_id,
            Course.lms_course_id.isnot(None),
        )
        .all()
    )
    course_type_map: dict[str, str] = {
        c.lms_course_id: (c.lms_system_type or "kanazawa_lms") for c in enrolled_courses
    }

    received = len(payload.tasks)
    created = 0
    updated = 0
    done_preserved = 0
    hidden_restored = 0

    for item in payload.tasks:
        existing_a = None
        if item.course_id and item.content_id:
            existing_a = by_course_content.get((item.course_id, item.content_id))
        if existing_a is None and item.course_id and item.source_url:
            existing_a = by_course_source_url.get((item.course_id, item.source_url))

        has_end = item.available_until is not None
        lms_system = course_type_map.get(item.course_id or "", "kanazawa_lms")
        provider = "webclass" if lms_system == "webclass" else "kanazawa_lms"

        if existing_a:
            existing_a.title = item.title
            existing_a.kind = item.kind
            existing_a.course_name = item.course_name
            existing_a.lms_course_id = item.course_id
            existing_a.availability_start = item.available_from
            existing_a.availability_end = item.available_until
            existing_a.is_due_estimated = has_end
            existing_a.source_url = item.source_url
            existing_a.source_provider = provider
            existing_a.is_active_url = item.is_active_url
            if item.content_id:
                existing_a.task_contents_id = item.content_id
            if existing_a.is_done:
                done_preserved += 1
            if existing_a.is_hidden:
                hidden_restored += 1
            existing_a.is_hidden = False
            updated += 1
        else:
            db.add(
                Task(
                    user_id=current_user.user_id,
                    title=item.title,
                    task_contents_id=item.content_id or "",
                    course_name=item.course_name,
                    kind=item.kind,
                    lms_course_id=item.course_id,
                    source_url=item.source_url,
                    availability_start=item.available_from,
                    availability_end=item.available_until,
                    is_due_estimated=has_end,
                    is_active_url=item.is_active_url,
                    result="",
                    type="assignment",
                    source_type="lms",
                    source_provider=provider,
                )
            )
            created += 1

    db.commit()

    logger.info(
        "[import-lms-tasks] user=%s received=%d created=%d updated=%d "
        "done_preserved=%d hidden_restored=%d",
        current_user.user_id,
        received,
        created,
        updated,
        done_preserved,
        hidden_restored,
    )
    for item in payload.tasks:
        candidate = is_assignment_candidate(item.title, item.kind)
        logger.info(
            "[import-lms-tasks] item: kind=%r title=%r content_id=%r course_id=%r candidate=%s",
            item.kind,
            item.title,
            item.content_id,
            item.course_id,
            candidate,
        )
    return {"status": "ok", "count": received}
