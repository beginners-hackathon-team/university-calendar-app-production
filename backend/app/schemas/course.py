from pydantic import BaseModel, Field
from typing import Literal


class CreateCourse(BaseModel):
    name: str
    room: str
    teacher: str
    year: int
    quarter: int = Field(ge=1, le=4)
    day_of_week: Literal["月", "火", "水", "木", "金", "土", "日"]
    period: int = Field(ge=1, le=6)


class UpdateCourse(BaseModel):
    name: str
    room: str
    teacher: str
