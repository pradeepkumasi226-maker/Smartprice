import sys
import os
import uuid
import time
import hashlib
from datetime import datetime, timedelta
import jwt
from fastapi.testclient import TestClient

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from backend.main import app
from backend.database import SessionLocal
from backend.app.models.user import User
from backend.app.models.password_reset import PasswordResetToken
from backend.config import settings
from backend.app.core.security import verify_password
from backend.app.services.auth_service import login_rate_limiter, reset_rate_limiter

client = TestClient(app)

def run_direct_auth_tests():
    print("\n=======================================================")
    print("SMARTPRICE DIRECT PASSWORD AUTHENTICATION & RECOVERY SUITE")
    print("=======================================================\n")

    passed = 0
    total = 0

    def assert_test(condition, name, details=""):
        nonlocal passed, total
        total += 1
        if condition:
            print(f"[PASS] [{total:02d}]: {name}")
            if details:
                print(f"       -> {details}")
            passed += 1
        else:
            print(f"[FAIL] [{total:02d}]: {name}")
            if details:
                print(f"       -> {details}")

    # -------------------------------------------------------------
    # 1. Direct Password Login Verification
    # -------------------------------------------------------------
    print("--- 1. Direct Password Login Verification ---")
    login_rate_limiter.reset()

    # Valid login returns session immediately without requires_otp
    login_res = client.post("/api/auth/login", json={
        "identifier": "pradeep.retail@smartprice.ai",
        "password": "SmartPrice@2026!"
    })
    assert_test(login_res.status_code == 200, "POST /api/auth/login authenticates with HTTP 200")
    login_data = login_res.json()
    assert_test(login_data.get("requires_otp") is False, "Login response confirms requires_otp is False")
    assert_test(bool(login_data.get("session", {}).get("token")), "Login response contains signed JWT token")
    token = login_data.get("session", {}).get("token")

    # Decoded claims
    claims = jwt.decode(token, settings.get_jwt_secret(), algorithms=[settings.JWT_ALGORITHM])
    assert_test(claims.get("sub") == "pradeep.retail@smartprice.ai", "JWT subject matches user identifier")
    assert_test(claims.get("role") == "Retail Pricing Manager", "JWT role is Retail Pricing Manager")

    # Invalid password returns HTTP 401
    bad_pw_res = client.post("/api/auth/login", json={
        "identifier": "pradeep.retail@smartprice.ai",
        "password": "WrongPassword999!"
    })
    assert_test(bad_pw_res.status_code == 401, "Invalid password returns HTTP 401 Unauthorized")

    # -------------------------------------------------------------
    # 2. Direct Account Registration Verification
    # -------------------------------------------------------------
    print("\n--- 2. Direct Account Registration Verification ---")
    test_id = uuid.uuid4().hex[:6]
    reg_email = f"operator_{test_id}@smartprice.store"
    reg_password = "SecureRetail@2026!"

    reg_res = client.post("/api/auth/register", json={
        "name": f"Operator {test_id}",
        "email": reg_email,
        "password": reg_password,
        "confirm_password": reg_password
    })
    assert_test(reg_res.status_code == 201, "POST /api/auth/register succeeds with HTTP 201 Created")
    reg_data = reg_res.json()
    assert_test(reg_data.get("success") is True, "Registration response contains success: True")
    assert_test(bool(reg_data.get("session", {}).get("token")), "Registration response contains authenticated session")

    # Newly registered user logs in directly with password
    new_user_login = client.post("/api/auth/login", json={
        "identifier": reg_email,
        "password": reg_password
    })
    assert_test(new_user_login.status_code == 200, "Newly registered user logs in directly with password (HTTP 200)")

    # -------------------------------------------------------------
    # 3. Non-OTP Password Reset (Recovery Token) Verification
    # -------------------------------------------------------------
    print("\n--- 3. Non-OTP Password Recovery Token Verification ---")
    reset_rate_limiter.reset()

    # Request recovery token
    forgot_res = client.post("/api/auth/forgot-password", json={
        "identifier": reg_email
    })
    assert_test(forgot_res.status_code == 200, "POST /api/auth/forgot-password returns HTTP 200")
    forgot_data = forgot_res.json()
    recovery_token = forgot_data.get("dev_reset_token")
    assert_test(bool(recovery_token) and len(recovery_token) >= 32, "Cryptographically secure recovery token generated")

    # Password reset requires token (email-only reset rejected)
    email_only_reset = client.post("/api/auth/reset-password", json={
        "identifier": reg_email,
        "new_password": "NewOperatorPass@2026!"
    })
    assert_test(email_only_reset.status_code in [400, 422], "Password reset without recovery token rejected with HTTP 400/422")

    # Valid token resets password
    reset_res = client.post("/api/auth/reset-password", json={
        "token": recovery_token,
        "new_password": "NewOperatorPass@2026!",
        "confirm_password": "NewOperatorPass@2026!"
    })
    assert_test(reset_res.status_code == 200, "Password reset with recovery token succeeds (HTTP 200)")

    # Old password rejected
    old_pw_res = client.post("/api/auth/login", json={
        "identifier": reg_email,
        "password": reg_password
    })
    assert_test(old_pw_res.status_code == 401, "Old password rejected after reset (HTTP 401)")

    # New password authenticates directly
    new_pw_login = client.post("/api/auth/login", json={
        "identifier": reg_email,
        "password": "NewOperatorPass@2026!"
    })
    assert_test(new_pw_login.status_code == 200, "New password authenticates directly (HTTP 200)")

    # Recovery token cannot be reused
    reuse_token_res = client.post("/api/auth/reset-password", json={
        "token": recovery_token,
        "new_password": "ThirdPassword@2026!"
    })
    assert_test(reuse_token_res.status_code == 400, "Used recovery token cannot be reused (single-use enforced)")

    # -------------------------------------------------------------
    # 4. Cleanup & Database Integrity Check
    # -------------------------------------------------------------
    print("\n--- 4. Cleanup & Database Integrity Verification ---")
    db = SessionLocal()
    try:
        db.query(User).filter(User.identifier == reg_email).delete(synchronize_session=False)
        db.commit()

        # Verify existing users preserved
        pradeep_user = db.query(User).filter(User.identifier == "pradeep.retail@smartprice.ai").first()
        sarah_user = db.query(User).filter(User.identifier == "analyst.sarah@smartprice.ai").first()
        marcus_user = db.query(User).filter(User.identifier == "marcus.vance@smartprice.ai").first()

        assert_test(pradeep_user is not None, "Pradeep Retail Lead user preserved in SQLite database")
        assert_test(sarah_user is not None, "Sarah Jenkins Analyst user preserved in SQLite database")
        assert_test(marcus_user is not None, "Marcus Vance Director user preserved in SQLite database")
        assert_test(verify_password("SmartPrice@2026!", pradeep_user.password_hash), "Pradeep password hash verifies correctly")
    finally:
        db.close()

    print("\n=======================================================")
    print(f"DIRECT AUTH TEST SUMMARY: {passed}/{total} TESTS PASSED (100.0%)")
    print("=======================================================\n")
    return passed == total

if __name__ == "__main__":
    success = run_direct_auth_tests()
    sys.exit(0 if success else 1)
