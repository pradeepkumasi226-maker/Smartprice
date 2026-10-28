from pydantic import BaseModel, Field
from typing import Optional

class LoginRequest(BaseModel):
    identifier: str = Field(..., description="Email or Username")
    password: str = Field(..., description="User Password")
    role: Optional[str] = Field(None, description="Ignored for security; role is loaded strictly from database")
    otp: Optional[str] = Field(None, description="Deprecated OTP field, ignored")

class LoginVerifyOtpRequest(BaseModel):
    identifier: str = Field(..., description="User email or identifier")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")
    password: Optional[str] = Field(None, description="Optional user password")

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
    expiresAt: Optional[int] = None

class LoginResponse(BaseModel):
    success: bool
    requires_otp: bool = False
    message: Optional[str] = None
    email: Optional[str] = None
    identifier: Optional[str] = None
    expires_in_minutes: Optional[int] = None
    resend_cooldown: Optional[int] = None
    session: Optional[AuthSession] = None
    user: Optional[UserProfile] = None
    dev_otp: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    identifier: str = Field(..., description="User email or identifier")

class ForgotPasswordResponse(BaseModel):
    success: bool
    message: str
    expires_in_minutes: int = 15
    dev_reset_token: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Password reset recovery token (required)")
    identifier: Optional[str] = Field(None, description="Optional user email or identifier")
    otp: Optional[str] = Field(None, description="Deprecated OTP field")
    new_password: str = Field(..., min_length=8, description="New password (minimum 8 characters)")
    confirm_password: Optional[str] = Field(None, description="Confirmation of new password")

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password (minimum 8 characters)")
    confirm_password: str = Field(..., min_length=8, description="Confirm new password")

class AuthActionResponse(BaseModel):
    success: bool
    message: str

class OtpActionResponse(BaseModel):
    success: bool
    message: str
    expires_in_minutes: int = 5
    resend_cooldown: int = 60
    dev_otp: Optional[str] = None

class RegisterSendOtpRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="User full name")
    email: str = Field(..., min_length=5, max_length=120, description="Email address")
    password: str = Field(..., min_length=8, description="Password (minimum 8 characters)")
    confirm_password: Optional[str] = Field(None, description="Confirmation of password")

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="User full name")
    email: str = Field(..., min_length=5, max_length=120, description="Email address")
    password: str = Field(..., min_length=8, description="Password (minimum 8 characters)")
    confirm_password: Optional[str] = Field(None, description="Confirmation of password")
    otp: Optional[str] = Field(None, description="Deprecated OTP field")
    role: Optional[str] = Field(None, description="Ignored for security; all self-registered users are assigned standard unprivileged role")

class RegisterResponse(BaseModel):
    success: bool
    message: str
    session: AuthSession
    user: UserProfile
