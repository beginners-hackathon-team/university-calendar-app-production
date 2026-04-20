from pydantic import BaseModel, EmailStr


class CreateUser(BaseModel):
    name: str
    password: str
    email: EmailStr


class ReadUser(BaseModel):
    name: str


class LoginRequest(BaseModel):
    name: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
