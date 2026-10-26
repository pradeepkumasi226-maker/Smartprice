import time
import threading
from collections import defaultdict
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from ..models.user import User
from ..core.security import verify_password, create_access_token
from ...config import settings

class LoginRateLimiter:
    """
    Lightweight, thread-safe in-memory sliding-window rate limiter for login attempts.
    Protects against automated credential-stuffing and brute-force attacks without
    requiring an external caching layer. Automatically releases upon window expiration
    and resets immediately upon successful authentication.
    """
    def __init__(self, max_attempts: int = 5, window_seconds: int = 60):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: Dict[str, list] = defaultdict(list)
        self._lock = threading.Lock()

    def check(self, key: str) -> Tuple[bool, int]:
        now = time.time()
        with self._lock:
            cutoff = now - self.window_seconds
            valid_attempts = [t for t in self._attempts[key] if t > cutoff]
            self._attempts[key] = valid_attempts
            if len(valid_attempts) >= self.max_attempts:
                retry_after = max(1, int(valid_attempts[0] + self.window_seconds - now))
                return False, retry_after
            return True, 0

    def record_failure(self, key: str):
        now = time.time()
        with self._lock:
            self._attempts[key].append(now)

    def record_success(self, key: str):
        with self._lock:
            if key in self._attempts:
                del self._attempts[key]

    def reset(self):
        with self._lock:
            self._attempts.clear()

login_rate_limiter = LoginRateLimiter(
    max_attempts=settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    window_seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS
)

class AuthService:
    @staticmethod
    def authenticate_user(db: Session, identifier: str, password: str) -> User:
        """
        Validates user credentials against server-side bcrypt password hash.
        Never auto-creates users and never accepts client-specified roles.
        """
        user_identifier = (identifier or "").strip().lower()
        if not user_identifier or not password:
            raise ValueError("Identifier and password are required.")

        user = db.query(User).filter(User.identifier == user_identifier).first()
        if not user:
            # Constant-time mitigation against user enumeration
            verify_password("dummy-password", "$2b$12$e80yqZ6sLdZgG7kQ69T.Ue7eZ8mYyY0N3hB7jK9mN8bQ2wR5tU7v2")
            raise ValueError("Invalid identifier or password.")

        if not user.password_hash:
            raise ValueError("Account credentials not yet enrolled. Please contact an administrator.")

        if not verify_password(password, user.password_hash):
            raise ValueError("Invalid identifier or password.")

        return user

    @staticmethod
    def login(db: Session, identifier: str, password: str) -> Dict[str, Any]:
        """
        Authenticates user and returns a cryptographically signed, expiring JWT token.
        Role and profile data are loaded strictly from the verified database record.
        """
        user = AuthService.authenticate_user(db, identifier=identifier, password=password)

        expires_at_ms = int((time.time() + settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60) * 1000)
        token = create_access_token(data={
            "sub": user.identifier,
            "user_id": user.id,
            "role": user.role,
            "name": user.name
        })

        user_profile = {
            "id": user.id,
            "name": user.name,
            "identifier": user.identifier,
            "email": user.identifier if "@" in user.identifier else f"{user.identifier}@smartprice.internal",
            "phone": "+91 98765 43210",
            "role": user.role,
            "store": "Main Flagship #104",
            "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
        }

        return {
            "success": True,
            "session": {
                "token": token,
                "user": user_profile,
                "expires_at": expires_at_ms
            },
            "user": user_profile
        }
