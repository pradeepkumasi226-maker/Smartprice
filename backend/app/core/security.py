import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from ...config import settings

def hash_password(password: str) -> str:
    """
    Hashes a password using bcrypt with automatic salt generation.
    Never stores or logs plaintext passwords.
    """
    if not password:
        raise ValueError("Password cannot be empty.")
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    """
    Verifies a plain password against the stored bcrypt hash.
    Safe against timing attacks; handles missing/null hashes cleanly.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Issues a cryptographically signed, expiring JWT access token.
    Claims: sub (identifier), user_id, role, name, iat, exp.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    })
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.get_jwt_secret(),
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt

def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decodes and validates a JWT access token signature and expiration.
    Raises jwt.ExpiredSignatureError, jwt.InvalidTokenError on invalid tokens.
    """
    return jwt.decode(
        token,
        settings.get_jwt_secret(),
        algorithms=[settings.JWT_ALGORITHM]
    )
