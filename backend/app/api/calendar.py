from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user
from app.db.session import get_db
from app.models.course import Course
from app.models.course_date import CourseDate
from app.models.enrollment import Enrollment
from app.services.schedule import build_class_dates

router = APIRouter()


@router.get("/api/calendar/{year_month}")
def get_calendar(
    year_month: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
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
