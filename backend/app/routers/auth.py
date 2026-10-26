from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from ...database import get_db
from ..schemas.auth import LoginRequest, LoginResponse, UserProfile
from ..services.auth_service import AuthService, login_rate_limiter
from ..models.user import User
from ..core.deps import get_current_user

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
            password=payload.password
        )
        login_rate_limiter.record_success(rate_key)
        return response
    except ValueError as e:
        login_rate_limiter.record_failure(rate_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed due to internal error."
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
