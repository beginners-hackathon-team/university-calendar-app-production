from fastapi import FastAPI, Response, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Annotated
from app.models.user import User  # uuid_str
from app.models.course import Course
from app.models.course_date import CourseDate
from app.models.enrollment import Enrollment
from app.models.university_event import University_event
from app.db.session import get_db
from app.services.schedule import build_class_dates
from app.schemas.course import CreateCourse, UpdateCourse
from app.schemas.auth import CreateUser, UserPublic
from app.schemas.university_event import CreateUniEvent, UpdateUniEvent
from app.utils.password import hash_password, verify_password
from app.utils.token import create_access_token, decode_access_token

app = FastAPI()


@app.get("/api/health")
def health():
    return {"status": "ok"}


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)], db: Session = Depends(get_db)
) -> User:
    user_id = decode_access_token(token)

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return user


def get_admin_user(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return current_user


@app.post("/api/user")
def create_user(user: CreateUser, db: Session = Depends(get_db)):
    new_user = User(
        name=user.name, email=user.email, password_hash=hash_password(user.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.get("/api/users", response_model=list[UserPublic])
def get_users(
    admin: Annotated[User, Depends(get_admin_user)],
    db: Session = Depends(get_db),
):
    return db.query(User).all()


@app.get("/api/user/{id}", response_model=UserPublic)
def get_user(
    id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == id).one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


@app.delete("/api/user/{id}")
def delete_user(
    id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    if current_user.id != id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")

    user = db.query(User).filter(User.id == id).one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/course")
def create_course(
    create_course: CreateCourse,
    current_user: Annotated[User, Depends(get_current_user)],
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

    enroll = Enrollment(course_id=course.id, user_id=current_user.id)
    db.add(enroll)
    db.commit()

    return


@app.get("/api/calendar/{year_month}")
def get_calendar(
    year_month: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    # URL例: /api/calendar/2026-4 （年度-月）
    year, month = map(int, year_month.split("-"))

    enrollments = (
        db.query(Enrollment).filter(Enrollment.user_id == current_user.id).all()
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

        # クォーター全体の開催日を生成し、指定月だけ残す
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
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == current_user.id,
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
    admin: Annotated[User, Depends(get_admin_user)],
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
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    year, quarter = map(int, year_quarter.split("-"))

    enrollments = (
        db.query(Enrollment).filter(Enrollment.user_id == current_user.id).all()
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
            }
        )

    return result


@app.put("/api/course/{course_id}")
def update_course(
    course_id: str,
    update_course: UpdateCourse,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.user_id == current_user.id,
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
    current_user: Annotated[User, Depends(get_current_user)],
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


"""
ログイン機能
"""


@app.post("/api/login")
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.name == form_data.username).one_or_none()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(subject=user.id)
    return {"access_token": token, "token_type": "bearer"}


# 自分の情報を返す
@app.get("/api/me")
def read_me(current_user: Annotated[User, Depends(get_current_user)]):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "is_admin": current_user.is_admin,
    }


# 大学イベント追加（管理者のみ）
@app.post("/api/university-events")
def create_university_event(
    payload: CreateUniEvent,
    year: int,
    admin: Annotated[User, Depends(get_admin_user)],
    db: Session = Depends(get_db),
):
    event = University_event(
        year=year,
        name=payload.name,
        type=payload.type,
        date=payload.date,
        original_day=payload.original_day,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


# 大学イベント編集（管理者のみ）
@app.put("/api/university-events/{uni_event_id}")
def update_university_event(
    uni_event_id: str,
    update_uni_event: UpdateUniEvent,
    admin: Annotated[User, Depends(get_admin_user)],
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


# 大学イベント削除（管理者のみ）
@app.delete("/api/university-events/{uni_event_id}")
def delete_university_event(
    uni_event_id: str,
    admin: Annotated[User, Depends(get_admin_user)],
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
