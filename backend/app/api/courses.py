import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, ensure_profile, get_admin_user, get_current_user
from app.db.session import get_db
from app.models.course import Course
from app.models.course_date import CourseDate
from app.models.enrollment import Enrollment
from app.schemas.course import CreateCourse, UpdateCourse
from app.services.course_display import format_room_for_display

logger = logging.getLogger("uvicorn.error")

router = APIRouter()


@router.post("/api/course")
def create_course(
    create_course: CreateCourse,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    ensure_profile(current_user.user_id, db)
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


@router.delete("/api/course/{course_id}")
def delete_course(
    course_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
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


@router.delete("/api/courses")
def delete_all_courses(
    admin: Annotated[CurrentUser, Depends(get_admin_user)],
    db: Session = Depends(get_db),
):
    courses = db.query(Course).all()
    for course in courses:
        db.delete(course)
    db.commit()
    return Response(status_code=204)


@router.get("/api/courses/{year_quarter}")
def get_courses(
    year_quarter: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    year, quarter = map(int, year_quarter.split("-"))

    enrollments = (
        db.query(Enrollment).filter(Enrollment.user_id == current_user.user_id).all()
    )
    if not enrollments:
        logger.info(
            "[get-courses] user=%s year=%d quarter=%d enrollments=0 → []",
            current_user.user_id,
            year,
            quarter,
        )
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
                "room": format_room_for_display(course.room),
                "teacher": course.teacher,
                "year": course_date.year,
                "quarter": course_date.quarter,
                "day_of_week": course_date.day_of_week,
                "period": course_date.period,
                "is_intensive_lct": course_date.is_intensive_lct,
                "lms_course_id": course.lms_course_id,
                "lms_system_type": course.lms_system_type,
            }
        )

    logger.info(
        "[get-courses] user=%s year=%d quarter=%d enrollments=%d course_dates=%d returned=%d",
        current_user.user_id,
        year,
        quarter,
        len(enrollments),
        len(course_dates),
        len(result),
    )
    for r in result:
        logger.info(
            "[get-courses]   name=%r day_of_week=%r period=%r is_intensive=%r",
            r["name"],
            r["day_of_week"],
            r["period"],
            r["is_intensive_lct"],
        )
    return result


@router.put("/api/course/{course_id}")
def update_course(
    course_id: str,
    update_course: UpdateCourse,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
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
