from fastapi import FastAPI, Response, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from sqlalchemy.orm import Session
from typing import Annotated
import jwt
from jwt import PyJWKClient

from app.models.profile import Profile
from app.models.course import Course
from app.models.course_date import CourseDate
from app.models.enrollment import Enrollment
from app.models.university_event import University_event
from app.models.assignment import Assignment
from app.models.todo import Todo
from app.db.session import get_db
from app.services.schedule import build_class_dates
from app.schemas.course import CreateCourse, UpdateCourse
from app.schemas.auth import CreateProfile, ProfilePublic
from app.schemas.university_event import CreateUniEvent, UpdateUniEvent
from app.schemas.extension import ExtensionSyncPayload, ImportCoursesPayload
from app.schemas.task import AssignmentPublic, ImportAssignmentsPayload, TodoPublic, CreateTodo, UpdateTodo
from app.core.config import settings

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer_scheme = HTTPBearer()

_jwks_client = PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")


@app.get("/api/health")
def health():
    return {"status": "ok"}


def verify_supabase_jwt(credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)]) -> str:
    """SupabaseのJWTをJWKSで検証し、auth.users.id (sub) を返す。"""
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(credentials.credentials)
        payload = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            options={"verify_aud": False},
        )
        sub: str | None = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return sub
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    user_id: Annotated[str, Depends(verify_supabase_jwt)],
    db: Session = Depends(get_db),
) -> Profile:
    profile = db.query(Profile).filter(Profile.user_id == user_id).one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Profile not found")
    return profile


def get_admin_user(current_user: Annotated[Profile, Depends(get_current_user)]) -> Profile:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return current_user


@app.post("/api/profiles", status_code=201)
def create_profile(
    body: CreateProfile,
    user_id: Annotated[str, Depends(verify_supabase_jwt)],
    db: Session = Depends(get_db),
):
    existing = db.query(Profile).filter(Profile.user_id == user_id).one_or_none()
    if existing:
        return existing

    profile = Profile(user_id=user_id, display_name=body.display_name)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@app.get("/api/me")
def read_me(current_user: Annotated[Profile, Depends(get_current_user)]):
    return {
        "id": current_user.user_id,
        "display_name": current_user.display_name,
        "is_admin": current_user.is_admin,
    }


@app.get("/api/users", response_model=list[ProfilePublic])
def get_users(
    admin: Annotated[Profile, Depends(get_admin_user)],
    db: Session = Depends(get_db),
):
    return db.query(Profile).all()


@app.delete("/api/user/{user_id}")
def delete_user(
    user_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    if current_user.user_id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")

    profile = db.query(Profile).filter(Profile.user_id == user_id).one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(profile)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/course")
def create_course(
    create_course: CreateCourse,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    course = Course(
        name=create_course.name, room=create_course.room, teacher=create_course.teacher
    )
    db.add(course)
    db.commit()
    db.refresh(course)

    course_date = CourseDate(
        course_id=course.id,
        year=create_course.year,
        quarter=create_course.quarter,
        day_of_week=create_course.day_of_week,
        period=create_course.period,
    )
    db.add(course_date)
    db.commit()
    db.refresh(course_date)

    enroll = Enrollment(course_id=course.id, user_id=current_user.user_id)
    db.add(enroll)
    db.commit()

    return


@app.get("/api/calendar/{year_month}")
def get_calendar(
    year_month: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    year, month = map(int, year_month.split("-"))

    enrollments = (
        db.query(Enrollment).filter(Enrollment.user_id == current_user.user_id).all()
    )
    if not enrollments:
        return []

    course_ids = [e.course_id for e in enrollments]
    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    course_dates = (
        db.query(CourseDate).filter(CourseDate.course_id.in_(course_ids)).all()
    )

    course_map = {c.id: c for c in courses}

    result = []
    for cd in course_dates:
        course = course_map.get(cd.course_id)
        if not course:
            continue

        if cd.is_intensive_lct:
            continue

        all_dates = build_class_dates(cd.year, cd.quarter, cd.day_of_week)
        filtered_dates = [d for d in all_dates if d.year == year and d.month == month]
        if not filtered_dates:
            continue

        result.append(
            {
                "id": course.id,
                "name": course.name,
                "room": course.room,
                "teacher": course.teacher,
                "dates": filtered_dates,
                "period": cd.period,
            }
        )

    return result


@app.delete("/api/course/{course_id}")
def delete_course(
    course_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == current_user.user_id,
            Enrollment.course_id == course_id,
        )
        .one_or_none()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    course = db.query(Course).filter(Course.id == course_id).one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    db.delete(course)
    db.commit()
    return Response(status_code=204)


@app.delete("/api/courses")
def delete_all_courses(
    admin: Annotated[Profile, Depends(get_admin_user)],
    db: Session = Depends(get_db),
):
    courses = db.query(Course).all()
    for course in courses:
        db.delete(course)
    db.commit()
    return Response(status_code=204)


@app.get("/api/courses/{year_quarter}")
def get_courses(
    year_quarter: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    year, quarter = map(int, year_quarter.split("-"))

    enrollments = (
        db.query(Enrollment).filter(Enrollment.user_id == current_user.user_id).all()
    )
    if not enrollments:
        return []

    course_ids = [enrollment.course_id for enrollment in enrollments]
    courses = db.query(Course).filter(Course.id.in_(course_ids)).all()
    course_dates = (
        db.query(CourseDate)
        .filter(
            CourseDate.course_id.in_(course_ids),
            CourseDate.year == year,
            CourseDate.quarter == quarter,
        )
        .all()
    )

    course_map = {course.id: course for course in courses}
    result = []

    for course_date in course_dates:
        course = course_map.get(course_date.course_id)
        if not course:
            continue

        result.append(
            {
                "id": course.id,
                "name": course.name,
                "room": course.room,
                "teacher": course.teacher,
                "year": course_date.year,
                "quarter": course_date.quarter,
                "day_of_week": course_date.day_of_week,
                "period": course_date.period,
                "lms_course_id": course.lms_course_id,
                "lms_system_type": course.lms_system_type,
            }
        )

    return result


@app.put("/api/course/{course_id}")
def update_course(
    course_id: str,
    update_course: UpdateCourse,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == current_user.user_id,
            Enrollment.course_id == course_id,
        )
        .one_or_none()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    course = db.query(Course).filter(Course.id == enrollment.course_id).one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course.name = update_course.name
    course.room = update_course.room
    course.teacher = update_course.teacher

    db.commit()
    db.refresh(course)

    return {
        "id": course.id,
        "name": course.name,
        "room": course.room,
        "teacher": course.teacher,
    }


@app.get("/api/university-events/{year}")
def get_university_events(
    year: int,
    current_user: Annotated[Profile, Depends(get_current_user)],
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


@app.post("/api/university-events")
def create_university_event(
    payload: CreateUniEvent,
    admin: Annotated[Profile, Depends(get_admin_user)],
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


@app.put("/api/university-events/{uni_event_id}")
def update_university_event(
    uni_event_id: str,
    update_uni_event: UpdateUniEvent,
    admin: Annotated[Profile, Depends(get_admin_user)],
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


@app.delete("/api/university-events/{uni_event_id}")
def delete_university_event(
    uni_event_id: str,
    admin: Annotated[Profile, Depends(get_admin_user)],
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


@app.post("/api/extension/sync")
def extension_sync(
    payload: ExtensionSyncPayload,
    current_user: Annotated[Profile, Depends(get_current_user)],
):
    print(
        f"[extension/sync] user={current_user.user_id} type={payload.type} "
        f"url={payload.url} html_len={len(payload.html)}"
    )
    return {"status": "received", "type": payload.type}


@app.post("/api/extension/import-courses")
def import_courses(
    payload: ImportCoursesPayload,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    # 既存の登録済みコースを (year, quarter, day_of_week, period) → (course, course_date) で取得
    existing_map: dict[tuple, tuple] = {}
    enrolled_course_ids = {
        e.course_id
        for e in db.query(Enrollment).filter(Enrollment.user_id == current_user.user_id).all()
    }
    if enrolled_course_ids:
        for cd in db.query(CourseDate).filter(CourseDate.course_id.in_(enrolled_course_ids)).all():
            course_obj = db.query(Course).filter(Course.id == cd.course_id).one_or_none()
            if course_obj:
                existing_map[(cd.year, cd.quarter, cd.day_of_week, cd.period)] = (course_obj, cd)

    count = 0
    for item in payload.courses:
        key = (item.year, item.quarter, item.day_of_week, item.period)
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
            db.add(CourseDate(
                course_id=course.id,
                year=item.year,
                quarter=item.quarter,
                day_of_week=item.day_of_week,
                period=item.period,
                is_intensive_lct=item.is_intensive_lct,
            ))
            db.add(Enrollment(course_id=course.id, user_id=current_user.user_id))
            existing_map[key] = (course, CourseDate())
        count += 1

    db.commit()
    return {"status": "ok", "count": count}


@app.post("/api/extension/import-assignments")
def import_assignments(
    payload: ImportAssignmentsPayload,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    all_existing = db.query(Assignment).filter(Assignment.user_id == current_user.user_id).all()
    # task_contents_id が空でないものはそれをキーにする
    by_contents_id = {a.task_contents_id: a for a in all_existing if a.task_contents_id}
    # 課題名+コース名のペアでもマップ（task_contents_id が空のフォールバック）
    by_name = {(a.task_name, a.course_name): a for a in all_existing}

    count = 0
    for item in payload.assignments:
        existing_a = None
        if item.task_contents_id and item.task_contents_id in by_contents_id:
            existing_a = by_contents_id[item.task_contents_id]
        elif (item.task_name, item.course_name) in by_name:
            existing_a = by_name[(item.task_name, item.course_name)]

        if existing_a:
            existing_a.task_name = item.task_name
            existing_a.course_name = item.course_name
            existing_a.submitted_at = item.submitted_at
            existing_a.result = item.result
            existing_a.score = item.score
            if item.task_contents_id:
                existing_a.task_contents_id = item.task_contents_id
        else:
            db.add(Assignment(
                user_id=current_user.user_id,
                task_name=item.task_name,
                task_contents_id=item.task_contents_id,
                course_name=item.course_name,
                submitted_at=item.submitted_at,
                result=item.result,
                score=item.score,
            ))
        count += 1

    db.commit()
    return {"status": "ok", "count": count}


@app.get("/api/assignments", response_model=list[AssignmentPublic])
def get_assignments(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    return db.query(Assignment).filter(Assignment.user_id == current_user.user_id).all()


@app.put("/api/assignments/{assignment_id}/done")
def mark_assignment_done(
    assignment_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    a = db.query(Assignment).filter(
        Assignment.id == assignment_id,
        Assignment.user_id == current_user.user_id,
    ).one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    a.is_done = True
    db.commit()
    return {"status": "ok"}


@app.delete("/api/assignments/{assignment_id}")
def delete_assignment(
    assignment_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    a = db.query(Assignment).filter(
        Assignment.id == assignment_id,
        Assignment.user_id == current_user.user_id,
    ).one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(a)
    db.commit()
    return Response(status_code=204)


@app.get("/api/todos", response_model=list[TodoPublic])
def get_todos(
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    return db.query(Todo).filter(Todo.user_id == current_user.user_id).all()


@app.post("/api/todos", response_model=TodoPublic, status_code=201)
def create_todo(
    body: CreateTodo,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    todo = Todo(user_id=current_user.user_id, title=body.title)
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo


@app.put("/api/todos/{todo_id}", response_model=TodoPublic)
def update_todo(
    todo_id: str,
    body: UpdateTodo,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    todo = db.query(Todo).filter(
        Todo.id == todo_id,
        Todo.user_id == current_user.user_id,
    ).one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    if body.title is not None:
        todo.title = body.title
    if body.is_done is not None:
        todo.is_done = body.is_done
    db.commit()
    db.refresh(todo)
    return todo


@app.delete("/api/todos/{todo_id}")
def delete_todo(
    todo_id: str,
    current_user: Annotated[Profile, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    todo = db.query(Todo).filter(
        Todo.id == todo_id,
        Todo.user_id == current_user.user_id,
    ).one_or_none()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    db.delete(todo)
    db.commit()
    return Response(status_code=204)


# 静的ファイル配信（本番のみ）
STATIC_DIR = Path(__file__).parent.parent / "static"
if STATIC_DIR.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=STATIC_DIR / "assets"),
        name="assets",
    )

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(index)
        raise HTTPException(status_code=404)
