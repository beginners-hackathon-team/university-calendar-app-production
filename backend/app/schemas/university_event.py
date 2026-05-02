from pydantic import BaseModel
from typing import Literal


class CreateUniEvent(BaseModel):
    year: int
    name: str
    type: Literal["exam", "interval", "transfer", "other", "holiday"]
    date: str
    original_day: str = ""


class ReadUniEvent(CreateUniEvent):
    id: str


class UpdateUniEvent(CreateUniEvent):
    pass
