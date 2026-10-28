from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional, List, Callable
from datetime import timezone
import jwt

from ...database import get_db
from ..models.user import User
from .security import decode_access_token

security_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Reusable FastAPI authentication dependency.
    Extracts Bearer token, verifies signature and expiration,
    and loads the authenticated user from the trusted database record.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials

    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except (jwt.InvalidTokenError, Exception):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or malformed authentication token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_id = payload.get("user_id")
    identifier = payload.get("sub")

    if not user_id and not identifier:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing user identification.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = None
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
    if not user and identifier:
        user = db.query(User).filter(User.identifier == identifier).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorized user record not found in system.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Session revocation check: invalidate token if password was updated after issuance
    if getattr(user, "password_changed_at", None):
        token_iat = payload.get("iat")
        if token_iat:
            dt = user.password_changed_at
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            changed_timestamp = int(dt.timestamp())
            if token_iat < changed_timestamp:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session has been revoked due to a password change. Please log in again.",
                    headers={"WWW-Authenticate": "Bearer"}
                )

    return user

def require_role(allowed_roles: List[str]) -> Callable:
    """
    Role-based access control dependency factory.
    Verifies that the authenticated user possesses an authorized role.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. User role '{current_user.role}' lacks permission for this action."
            )
        return current_user
    return role_checker
