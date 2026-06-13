from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PersonalEventPublic(BaseModel):
    id: str
    title: str
    start: str
    end: Optional[str]
    all_day: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CreatePersonalEvent(BaseModel):
    title: str
    start: str
    end: Optional[str] = None
    all_day: bool = False


class AssignmentPublic(BaseModel):
    id: str
    task_name: str
    task_contents_id: str
    course_name: Optional[str]
    submitted_at: Optional[str]
    result: str
    score: Optional[str]
    kind: Optional[str]
    available_from: Optional[str]
    available_until: Optional[str]
    lms_course_id: Optional[str]
    is_done: bool
    done_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ImportAssignmentItem(BaseModel):
    task_name: str
    task_contents_id: str
    course_name: Optional[str] = None
    submitted_at: Optional[str] = None
    result: str
    score: Optional[str] = None


class ImportAssignmentsPayload(BaseModel):
    assignments: list[ImportAssignmentItem]


class ImportLmsTaskItem(BaseModel):
    lms_contents_id: str
    title: str
    kind: str
    course_name: Optional[str] = None
    lms_course_id: Optional[str] = None
    available_from: Optional[str] = None
    available_until: Optional[str] = None


class ImportLmsTasksPayload(BaseModel):
    tasks: list[ImportLmsTaskItem]


class TodoPublic(BaseModel):
    id: str
    title: str
    is_done: bool
    done_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class CreateTodo(BaseModel):
    title: str


class UpdateTodo(BaseModel):
    title: Optional[str] = None
    is_done: Optional[bool] = None
