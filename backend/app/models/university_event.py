from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer
from app.utils.uuid import uuid_str
from app.db.base import Base


class University_event(Base):
    __tablename__ = "university_event"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=uuid_str)
    year: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String)
    date: Mapped[str] = mapped_column(String)
    original_day: Mapped[str] = mapped_column(
        String, default=""
    )  # type='transfer'のときのみ''
