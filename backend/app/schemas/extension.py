from pydantic import BaseModel, Field
from typing import Literal, Optional


class ExtensionSyncPayload(BaseModel):
    type: Literal["regist-list", "lecture-detail", "lms-course", "my-reports"]
    url: str
    html: str


class ImportCourseItem(BaseModel):
    name: str
    teacher: str
    room: str = ''
    year: int
    quarter: int = Field(ge=1, le=4)
    day_of_week: Optional[Literal["月", "火", "水", "木", "金", "土"]] = None
    period: int = Field(ge=0, le=8)
    is_intensive_lct: bool = False
    lms_course_id: Optional[str] = None
    lms_system_type: Optional[str] = None


class ImportCoursesPayload(BaseModel):
    courses: list[ImportCourseItem]
