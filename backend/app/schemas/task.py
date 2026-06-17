from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class PersonalEventPublic(BaseModel):
    id: str
    title: str
    start: str
    end: Optional[str]
    all_day: bool
    color: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CreatePersonalEvent(BaseModel):
    title: str
    start: str
    end: Optional[str] = None
    all_day: bool = False
    color: Optional[str] = None


class UpdatePersonalEvent(BaseModel):
    title: str
    start: str
    end: Optional[str] = None
    all_day: bool = False
    color: Optional[str] = None


class AssignmentPublic(BaseModel):
    id: str
    task_name: str
    task_contents_id: str
    course_name: Optional[str]
    submitted_at: Optional[str]
    result: str
    score: Optional[str]
    kind: Optional[str]
    availability_start: Optional[str]
    availability_end: Optional[str]
    source_url: Optional[str]
    is_due_estimated: bool
    lms_course_id: Optional[str]
    is_done: bool
    done_at: Optional[datetime]
    created_at: datetime

    @field_validator('task_contents_id', 'result', mode='before')
    @classmethod
    def coerce_none_to_str(cls, v):
        return v if v is not None else ''

    class Config:
        from_attributes = True


class UpdateAssignmentDone(BaseModel):
    is_done: bool


class UpdateAssignmentTitle(BaseModel):
    task_name: str


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
    content_id: Optional[str] = None
    source_url: Optional[str] = None
    title: str
    kind: Optional[str] = None
    course_id: Optional[str] = None
    course_name: Optional[str] = None
    available_from: Optional[str] = None
    available_until: Optional[str] = None
    raw_text: Optional[str] = None


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
