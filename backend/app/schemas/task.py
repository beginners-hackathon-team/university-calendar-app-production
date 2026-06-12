from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AssignmentPublic(BaseModel):
    id: str
    task_name: str
    task_contents_id: str
    course_name: Optional[str]
    submitted_at: Optional[str]
    result: str
    score: Optional[str]
    is_done: bool
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


class TodoPublic(BaseModel):
    id: str
    title: str
    is_done: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CreateTodo(BaseModel):
    title: str


class UpdateTodo(BaseModel):
    title: Optional[str] = None
    is_done: Optional[bool] = None
