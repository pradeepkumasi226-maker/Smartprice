from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from ...database import get_db
from ..schemas.auth import (
    LoginRequest,
    LoginVerifyOtpRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    RegisterSendOtpRequest,
    OtpActionResponse,
    UserProfile,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ChangePasswordRequest,
    AuthActionResponse
)
from ..services.auth_service import AuthService, login_rate_limiter, reset_rate_limiter
from ..models.user import User
from ..core.deps import get_current_user
from ...config import settings

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    normalized_id = (payload.identifier or "").strip().lower()
    rate_key = f"{client_ip}:{normalized_id}"

    is_allowed, retry_after = login_rate_limiter.check(rate_key)
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)}
        )

    try:
        response = AuthService.login(
            db=db,
            identifier=payload.identifier,
            password=payload.password,
            otp=payload.otp,
            client_ip=client_ip
        )
        login_rate_limiter.record_success(rate_key)
        return response
    except ValueError as e:
        err_msg = str(e)
        if "invalid identifier or password" in err_msg.lower() or "not yet enrolled" in err_msg.lower():
            login_rate_limiter.record_failure(rate_key)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=err_msg,
                headers={"WWW-Authenticate": "Bearer"}
            )
        if "too many" in err_msg.lower() or "wait" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=err_msg
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed due to internal error."
        )

@router.post("/login/send-otp", response_model=LoginResponse)
def login_send_otp(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Legacy compatibility route: returns direct login status."""
    client_ip = request.client.host if request.client else "unknown"
    try:
        return AuthService.login(
            db=db,
            identifier=payload.identifier,
            password=payload.password,
            client_ip=client_ip
        )
    except ValueError as e:
        err_msg = str(e)
        if "invalid identifier or password" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

@router.post("/login/verify-otp", response_model=LoginResponse)
def login_verify_otp(payload: LoginVerifyOtpRequest, request: Request, db: Session = Depends(get_db)):
    """Legacy compatibility route: returns verified session."""
    client_ip = request.client.host if request.client else "unknown"
    try:
        return AuthService.verify_login_otp(
            db=db,
            identifier=payload.identifier,
            otp=payload.otp,
            password=payload.password,
            client_ip=client_ip
        )
    except ValueError as e:
        err_msg = str(e)
        if "invalid identifier or password" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    try:
        response = AuthService.register(
            db=db,
            name=payload.name,
            email=payload.email,
            password=payload.password,
            confirm_password=payload.confirm_password,
            role=payload.role
        )
        return response
    except ValueError as e:
        err_msg = str(e)
        if "already exists" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=err_msg
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed due to internal error: {e}"
        )

@router.post("/register/send-otp", response_model=OtpActionResponse)
def register_send_otp(payload: RegisterSendOtpRequest, request: Request, db: Session = Depends(get_db)):
    """Legacy compatibility route: confirms direct registration readiness."""
    return {
        "success": True,
        "message": "Direct password-based registration is active without OTP.",
        "expires_in_minutes": 15,
        "resend_cooldown": 0,
        "dev_otp": "000000"
    }

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@router.post("/forgot-password/send-otp", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    normalized_id = (payload.identifier or "").strip().lower()
    rate_key = f"{client_ip}:forgot:{normalized_id}"

    is_allowed, retry_after = reset_rate_limiter.check(rate_key)
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many password reset requests. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)}
        )

    try:
        message, dev_token, _ = AuthService.forgot_password(db, identifier=payload.identifier, client_ip=client_ip)
        return {
            "success": True,
            "message": message,
            "expires_in_minutes": 15,
            "dev_reset_token": dev_token
        }
    except ValueError as e:
        err_msg = str(e)
        if "wait" in err_msg.lower() or "too many" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=err_msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to process password reset request at this time."
        )

@router.post("/reset-password", response_model=AuthActionResponse)
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{client_ip}:reset_attempt"

    is_allowed, retry_after = reset_rate_limiter.check(rate_key)
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many reset attempts. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)}
        )

    try:
        AuthService.reset_password(
            db,
            token=payload.token,
            identifier=payload.identifier,
            otp=payload.otp,
            new_password=payload.new_password,
            confirm_password=payload.confirm_password
        )
        return {
            "success": True,
            "message": "Password has been successfully reset. You may now log in with your new credentials."
        }
    except ValueError as e:
        reset_rate_limiter.record_failure(rate_key)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset failed due to internal error."
        )

@router.post("/change-password", response_model=AuthActionResponse)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        AuthService.change_password(
            db,
            user=current_user,
            current_password=payload.current_password,
            new_password=payload.new_password,
            confirm_password=payload.confirm_password
        )
        return {
            "success": True,
            "message": "Password changed successfully. All other active sessions have been revoked."
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update password."
        )

@router.post("/logout")
def logout():
    return {"success": True, "message": "Logged out successfully"}

@router.get("/me", response_model=UserProfile)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "identifier": current_user.identifier,
        "email": current_user.identifier if "@" in current_user.identifier else f"{current_user.identifier}@smartprice.internal",
        "role": current_user.role,
        "store": "Main Flagship #104",
        "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
    }
