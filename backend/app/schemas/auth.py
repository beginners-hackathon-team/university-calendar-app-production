from pydantic import BaseModel


class CreateProfile(BaseModel):
    display_name: str


class ProfilePublic(BaseModel):
    user_id: str
    display_name: str
    is_admin: bool

    class Config:
        from_attributes = True
