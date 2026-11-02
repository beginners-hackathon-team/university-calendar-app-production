from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from app.utils.uuid import uuid_str
from app.db.base import Base


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        Index("ix_enrollments_user_id_course_id", "user_id", "course_id"),
        # ON DELETE CASCADE が子行を探すのに使う（PostgreSQLはFK側に自動で張らない）
        Index("ix_enrollments_course_id", "course_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    course_id: Mapped[str] = mapped_column(
        String, ForeignKey("courses.id", ondelete="CASCADE")
    )
    user_id: Mapped[str] = mapped_column(PGUUID(as_uuid=False))
