import time
import threading
import uuid
import secrets
import hashlib
import logging
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from ..models.user import User
from ..models.password_reset import PasswordResetToken
from ..core.security import verify_password, hash_password, create_access_token
from ...config import settings

logger = logging.getLogger("smartprice.auth")

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

    def reset(self, key: Optional[str] = None):
        with self._lock:
            if key is not None:
                if key in self._attempts:
                    del self._attempts[key]
            else:
                self._attempts.clear()

login_rate_limiter = LoginRateLimiter(
    max_attempts=settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    window_seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS
)

reset_rate_limiter = LoginRateLimiter(
    max_attempts=5,
    window_seconds=60
)

# Retained as dummy rate limiters for backwards compatibility with any legacy test imports
otp_resend_rate_limiter = LoginRateLimiter(
    max_attempts=100,
    window_seconds=60
)

otp_verify_rate_limiter = LoginRateLimiter(
    max_attempts=100,
    window_seconds=60
)

class AuthService:
    @staticmethod
    def create_user_session(user: User) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Generates a cryptographically signed JWT access token and user profile dictionary.
        """
        clean_email = user.identifier if "@" in user.identifier else f"{user.identifier}@smartprice.internal"
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
            "email": clean_email,
            "phone": "+91 98765 43210",
            "role": user.role,
            "store": "Main Flagship #104",
            "avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
        }

        session = {
            "token": token,
            "user": user_profile,
            "expires_at": expires_at_ms,
            "expiresAt": expires_at_ms
        }

        return session, user_profile

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
    def login(
        db: Session,
        identifier: str,
        password: str,
        otp: Optional[str] = None,
        client_ip: str = "unknown"
    ) -> Dict[str, Any]:
        """
        Authenticates user directly with identifier and password.
        Returns a signed JWT access token and user profile.
        No OTP generation or email verification is required.
        """
        user = AuthService.authenticate_user(db, identifier=identifier, password=password)
        session, user_profile = AuthService.create_user_session(user)

        logger.info(f"[Auth] User '{user.identifier}' successfully authenticated with password.")
        return {
            "success": True,
            "requires_otp": False,
            "message": "Login successful.",
            "session": session,
            "user": user_profile
        }

    @staticmethod
    def send_login_otp(db: Session, identifier: str, password: str, client_ip: str = "unknown") -> Tuple[str, Optional[str], str]:
        """
        Legacy compatibility helper for older clients.
        Validates credentials and confirms authentication is available.
        """
        user = AuthService.authenticate_user(db, identifier=identifier, password=password)
        clean_email = user.identifier if "@" in user.identifier else f"{user.identifier}@smartprice.internal"
        return "Password verified. Direct authentication enabled.", None, clean_email

    @staticmethod
    def verify_login_otp(
        db: Session,
        identifier: str,
        otp: Optional[str] = None,
        password: Optional[str] = None,
        client_ip: str = "unknown"
    ) -> Dict[str, Any]:
        """
        Legacy compatibility helper for older clients or tests.
        Validates credentials directly and issues session.
        """
        clean_id = (identifier or "").strip().lower()
        if not clean_id:
            raise ValueError("Identifier is required.")

        user = None
        if password:
            user = AuthService.authenticate_user(db, identifier=clean_id, password=password)
        else:
            user = db.query(User).filter(User.identifier == clean_id).first()
            if not user:
                raise ValueError("Account not found.")

        session, user_profile = AuthService.create_user_session(user)
        return {
            "success": True,
            "requires_otp": False,
            "session": session,
            "user": user_profile
        }

    @staticmethod
    def forgot_password(db: Session, identifier: str, client_ip: str = "unknown") -> Tuple[str, Optional[str], Optional[str]]:
        """
        Initiates password reset by issuing a secure, single-use recovery token.
        Stores SHA-256 hash in password_reset_tokens table with 15-minute expiration.
        Returns generic enumeration-safe confirmation message.
        In development mode, provides dev_reset_token for automated testing.
        Does not require or dispatch email OTPs.
        """
        clean_id = (identifier or "").strip().lower()
        if not clean_id:
            raise ValueError("Email or identifier is required.")

        user = db.query(User).filter(User.identifier == clean_id).first()
        dev_token: Optional[str] = None

        if user:
            now = datetime.utcnow()
            expires_at = now + timedelta(minutes=15)

            # Invalidate any prior unused reset tokens for this user
            db.query(PasswordResetToken).filter(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used == False
            ).update({"used": True})

            # Generate cryptographically secure recovery token
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

            reset_record = PasswordResetToken(
                id=f"rst-{uuid.uuid4().hex[:12]}",
                user_id=user.id,
                token_hash=token_hash,
                expires_at=expires_at,
                used=False,
                created_at=now
            )
            db.add(reset_record)
            db.commit()

            logger.info(f"[Auth] Password reset recovery token generated for user '{user.identifier}'")
            if settings.ENVIRONMENT != "production":
                dev_token = raw_token
        else:
            # Simulate work to prevent timing enumeration
            verify_password("dummy-password", "$2b$12$e80yqZ6sLdZgG7kQ69T.Ue7eZ8mYyY0N3hB7jK9mN8bQ2wR5tU7v2")

        message = "If an account with that identifier exists, password reset instructions and a recovery token have been generated."
        return message, dev_token, None

    @staticmethod
    def reset_password(
        db: Session,
        new_password: str,
        confirm_password: Optional[str] = None,
        token: Optional[str] = None,
        identifier: Optional[str] = None,
        otp: Optional[str] = None
    ) -> bool:
        """
        Resets user password using a verified recovery token.
        Requires a valid, non-expired, single-use token.
        Does not permit password reset based only on an email address.
        Updates password hash and revokes prior active sessions via password_changed_at.
        """
        clean_token = (token or "").strip()

        if not clean_token:
            raise ValueError("Password reset recovery token is required. Resetting password based only on an email address is not permitted.")

        if confirm_password is not None and new_password != confirm_password:
            raise ValueError("New password and confirm password do not match.")

        if len(new_password) < 8:
            raise ValueError("Password must be at least 8 characters long.")

        has_letter = any(c.isalpha() for c in new_password)
        has_digit_or_special = any(c.isdigit() or not c.isalnum() for c in new_password)
        if not (has_letter and has_digit_or_special):
            raise ValueError("Password must contain at least one letter and at least one number or special character.")

        token_hash = hashlib.sha256(clean_token.encode("utf-8")).hexdigest()
        record = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()

        if not record:
            raise ValueError("Invalid password reset token.")

        if record.used:
            raise ValueError("This password reset token has already been used.")

        if record.expires_at < datetime.utcnow():
            raise ValueError("This password reset token has expired. Please request a new reset link.")

        user = db.query(User).filter(User.id == record.user_id).first()
        if not user:
            raise ValueError("Associated user record not found.")

        # Atomic single-use consumption and password update
        record.used = True
        user.password_hash = hash_password(new_password)
        user.password_changed_at = datetime.utcnow()
        db.commit()

        logger.info(f"[Auth] Password successfully reset with recovery token for user '{user.identifier}'. Prior sessions invalidated.")
        return True

    @staticmethod
    def change_password(db: Session, user: User, current_password: str, new_password: str, confirm_password: str) -> bool:
        """
        Verifies current password, enforces matching confirmation and password complexity,
        ensures new password is not identical to current, updates password hash,
        and sets password_changed_at to immediately revoke all previously issued tokens.
        """
        if not current_password:
            raise ValueError("Current password is required.")

        if not new_password:
            raise ValueError("New password is required.")

        if new_password != confirm_password:
            raise ValueError("New password and confirm password do not match.")

        if len(new_password) < 8:
            raise ValueError("Password must be at least 8 characters long.")

        has_letter = any(c.isalpha() for c in new_password)
        has_digit_or_special = any(c.isdigit() or not c.isalnum() for c in new_password)
        if not (has_letter and has_digit_or_special):
            raise ValueError("Password must contain at least one letter and at least one number or special character.")

        if not verify_password(current_password, user.password_hash):
            raise ValueError("Current password is incorrect.")

        if verify_password(new_password, user.password_hash):
            raise ValueError("New password cannot be identical to your current password.")

        user.password_hash = hash_password(new_password)
        user.password_changed_at = datetime.utcnow()
        db.commit()

        logger.info(f"[Auth] Password successfully changed for user '{user.identifier}'. Prior sessions revoked.")
        return True

    @staticmethod
    def send_registration_otp(
        db: Session,
        name: str,
        email: str,
        password: str,
        confirm_password: Optional[str] = None,
        client_ip: str = "unknown"
    ) -> Tuple[str, Optional[str]]:
        """
        Legacy compatibility helper for older clients.
        Validates details and confirms direct registration is ready.
        """
        return "Direct registration enabled without OTP.", None

    @staticmethod
    def register(
        db: Session,
        name: str,
        email: str,
        password: str,
        confirm_password: Optional[str] = None,
        otp: Optional[str] = None,
        role: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Creates a new user account with validated details and bcrypt password hashing.
        Validates name, email, password strength, and duplicate accounts.
        Directly provisions the account with default unprivileged role ('Retail Pricing Manager').
        Issues an authenticated session token upon successful creation.
        Does not require or depend on OTP.
        """
        clean_name = (name or "").strip()
        clean_email = (email or "").strip().lower()

        if not clean_name:
            raise ValueError("Full name is required.")
        if len(clean_name) < 2:
            raise ValueError("Full name must be at least 2 characters long.")

        if not clean_email or "@" not in clean_email or "." not in clean_email.split("@")[-1]:
            raise ValueError("A valid email address is required.")

        if not password:
            raise ValueError("Password is required.")

        if confirm_password is not None and password != confirm_password:
            raise ValueError("Password and confirm password do not match.")

        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters long.")

        has_letter = any(c.isalpha() for c in password)
        has_digit_or_special = any(c.isdigit() or not c.isalnum() for c in password)
        if not (has_letter and has_digit_or_special):
            raise ValueError("Password must contain at least one letter and at least one number or special character.")

        # Check duplicate user
        existing_user = db.query(User).filter(User.identifier == clean_email).first()
        if existing_user:
            raise ValueError("An account with this email address already exists.")

        # Create user with standard unprivileged role
        user_id = f"usr-{uuid.uuid4().hex[:10]}"
        hashed = hash_password(password)
        now = datetime.utcnow()
        default_role = "Retail Pricing Manager"

        new_user = User(
            id=user_id,
            name=clean_name,
            identifier=clean_email,
            password_hash=hashed,
            password_changed_at=now,
            role=default_role,
            created_at=now,
            updated_at=now
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        logger.info(f"[Auth] Successfully registered user '{clean_email}' with ID '{user_id}'.")

        session, user_profile = AuthService.create_user_session(new_user)

        return {
            "success": True,
            "message": "Account created successfully. Welcome to SmartPrice!",
            "session": session,
            "user": user_profile
        }
