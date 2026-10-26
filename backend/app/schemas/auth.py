from pydantic import BaseModel, Field
from typing import Optional

class LoginRequest(BaseModel):
    identifier: str = Field(..., description="Email or Username")
    password: str = Field(..., description="User Password")
    role: Optional[str] = Field(None, description="Ignored for security; role is loaded strictly from database")

class UserProfile(BaseModel):
    id: str
    name: str
    identifier: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    store: str = "Main Flagship #104"
    avatar: Optional[str] = None

    class Config:
        from_attributes = True

class AuthSession(BaseModel):
    token: str
    user: UserProfile
    expires_at: int

class LoginResponse(BaseModel):
    success: bool
    session: AuthSession
    user: UserProfile
