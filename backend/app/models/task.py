from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from app.utils.uuid import uuid_str
from app.db.base import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    user_id: Mapped[str] = mapped_column(PGUUID(as_uuid=False), nullable=False)

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # 'todo' | 'assignment'
    type: Mapped[str] = mapped_column(String, nullable=False)
    # 'manual' | 'lms' | 'ai' | 'calendar'
    source_type: Mapped[str] = mapped_column(String, nullable=False)
    # 'user' | 'kanazawa_lms' | 'webclass' | 'google_calendar'
    source_provider: Mapped[str] = mapped_column(String, nullable=False)

    is_done: Mapped[bool] = mapped_column(Boolean, default=False)
    done_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Assignment-specific fields
    course_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    lms_course_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    task_contents_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    source_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    kind: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    availability_start: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    availability_end: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    submitted_at: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    result: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    score: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_due_estimated: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active_url: Mapped[bool] = mapped_column(Boolean, default=False)
    board_status: Mapped[str] = mapped_column(String, nullable=False, default='assignment')

    @property
    def task_name(self) -> str:
        """AssignmentPublic スキーマとの後方互換用プロパティ"""
        return self.title
