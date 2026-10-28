import sys
import os
import time
import hashlib
from datetime import datetime, timedelta

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.app.models import User, PasswordResetToken
from backend.app.services.email_service import EmailService
from backend.app.services.auth_service import otp_resend_rate_limiter

client = TestClient(app)

def run_password_management_tests():
    # Set up intercepted email collector for automated test suite
    def complete_login(identifier, password):
        return client.post("/api/auth/login", json={"identifier": identifier, "password": password})

    print("\n==================================================")
    print("SMARTPRICE PHASE 2 PASSWORD MANAGEMENT TEST SUITE")
    print("==================================================\n")

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

    # 1. Forgot password request for existing user returns generic enumeration-safe response
    req_res = client.post("/api/auth/forgot-password", json={
        "identifier": "pradeep.retail@smartprice.ai"
    })
    assert_test(req_res.status_code == 200, "Forgot password endpoint returns HTTP 200")
    req_data = req_res.json()
    assert_test(
        "If an account with that identifier exists" in req_data.get("message", ""),
        "Response contains generic enumeration-safe confirmation message"
    )

    # 2. In development mode, dev_reset_token is provided for secure local testing
    dev_token = req_data.get("dev_reset_token")
    assert_test(bool(dev_token) and len(dev_token) >= 32, "Development reset token generated with high entropy")

    # 3. Database stores ONLY the SHA-256 hash of the reset token (never plaintext)
    db = SessionLocal()
    token_hash = hashlib.sha256(dev_token.encode("utf-8")).hexdigest()
    db_record = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()
    assert_test(
        db_record is not None and db_record.token_hash == token_hash and db_record.used is False,
        "Database stores SHA-256 hash of token and records single-use active state",
        f"Stored Hash: {token_hash[:16]}..."
    )
    db.close()

    # 4. Unknown identifier returns identical generic message (anti-enumeration) without dev_token
    unknown_res = client.post("/api/auth/forgot-password", json={
        "identifier": "nonexistent.hacker@darkweb.io"
    })
    assert_test(unknown_res.status_code == 200, "Unknown identifier returns HTTP 200")
    unknown_data = unknown_res.json()
    assert_test(
        "If an account with that identifier exists" in unknown_data.get("message", "") and unknown_data.get("dev_reset_token") is None,
        "Unknown user receives identical confirmation message and NO dev token is generated"
    )

    # 4b. Reset password rejects attempts based only on email address without recovery token
    email_only_res = client.post("/api/auth/reset-password", json={
        "identifier": "pradeep.retail@smartprice.ai",
        "new_password": "NewSecretPassword2026!"
    })
    assert_test(
        email_only_res.status_code in [400, 422],
        "Password reset strictly requires recovery token; email-only reset is rejected (HTTP 400/422)"
    )

    # 5. Reset password rejects invalid / non-existent token with HTTP 400
    invalid_token_res = client.post("/api/auth/reset-password", json={
        "token": "completely-fabricated-fake-token-12345",
        "new_password": "NewSecretPassword2026!"
    })
    assert_test(invalid_token_res.status_code == 400, "Invalid reset token rejected with HTTP 400")

    # 6. Reset password rejects passwords shorter than 8 characters
    short_pw_res = client.post("/api/auth/reset-password", json={
        "token": dev_token,
        "new_password": "Short1!"
    })
    assert_test(short_pw_res.status_code == 422 or short_pw_res.status_code == 400, "Short password (<8 chars) is rejected")

    # 7. Reset password rejects mismatched confirm password
    mismatch_pw_res = client.post("/api/auth/reset-password", json={
        "token": dev_token,
        "new_password": "ValidPassword2026!",
        "confirm_password": "DifferentPassword2026!"
    })
    assert_test(mismatch_pw_res.status_code == 400, "Mismatched confirm password is rejected with HTTP 400")

    # 8. Reset password successfully updates password using valid token
    test_temp_password = "TempResetPassword2026!"
    success_rst_res = client.post("/api/auth/reset-password", json={
        "token": dev_token,
        "new_password": test_temp_password,
        "confirm_password": test_temp_password
    })
    assert_test(success_rst_res.status_code == 200, "Valid token resets password successfully (HTTP 200)")

    # 9. Token cannot be reused (single-use enforcement)
    reuse_res = client.post("/api/auth/reset-password", json={
        "token": dev_token,
        "new_password": "AnotherPassword2026!"
    })
    assert_test(
        reuse_res.status_code == 400 and "already been used" in reuse_res.json().get("detail", ""),
        "Used reset token is rejected with single-use policy enforcement"
    )

    # 10. Expired token rejection test
    db = SessionLocal()
    expired_token_raw = "expired-token-raw-test-123456789"
    expired_hash = hashlib.sha256(expired_token_raw.encode("utf-8")).hexdigest()
    exp_record = PasswordResetToken(
        id="rst-expired-test",
        user_id="usr-01",
        token_hash=expired_hash,
        expires_at=datetime.utcnow() - timedelta(minutes=5),
        used=False,
        created_at=datetime.utcnow() - timedelta(minutes=20)
    )
    db.add(exp_record)
    db.commit()
    db.close()

    expired_attempt_res = client.post("/api/auth/reset-password", json={
        "token": expired_token_raw,
        "new_password": "ValidExpiredAttempt2026!"
    })
    assert_test(
        expired_attempt_res.status_code == 400 and "expired" in expired_attempt_res.json().get("detail", ""),
        "Expired reset token rejected with HTTP 400"
    )

    # Clean up test expired record
    db = SessionLocal()
    db.query(PasswordResetToken).filter(PasswordResetToken.id == "rst-expired-test").delete()
    db.commit()
    db.close()

    # 11. Old password is now rejected
    old_login_res = client.post("/api/auth/login", json={
        "identifier": "pradeep.retail@smartprice.ai",
        "password": "SmartPrice@2026!"
    })
    assert_test(old_login_res.status_code == 401, "Old password cannot log in after reset (HTTP 401)")

    # 12. New password logs in successfully
    new_login_res = complete_login("pradeep.retail@smartprice.ai", test_temp_password)
    assert_test(new_login_res.status_code == 200, "New password logs in successfully (HTTP 200)")
    active_token = new_login_res.json().get("session", {}).get("token")
    auth_headers = {"Authorization": f"Bearer {active_token}"}

    # 13. Authenticated Change Password rejects unauthenticated requests (HTTP 401)
    unauth_chg_res = client.post("/api/auth/change-password", json={
        "current_password": test_temp_password,
        "new_password": "NextPassword2026!",
        "confirm_password": "NextPassword2026!"
    })
    assert_test(unauth_chg_res.status_code == 401, "Change password rejects unauthenticated request (HTTP 401)")

    # 14. Authenticated Change Password rejects incorrect current password
    wrong_current_res = client.post("/api/auth/change-password", json={
        "current_password": "IncorrectCurrentPassword!",
        "new_password": "NextPassword2026!",
        "confirm_password": "NextPassword2026!"
    }, headers=auth_headers)
    assert_test(
        wrong_current_res.status_code == 400 and "Current password is incorrect" in wrong_current_res.json().get("detail", ""),
        "Change password validates current password before updating"
    )

    # 15. Authenticated Change Password rejects identical new password
    same_pw_res = client.post("/api/auth/change-password", json={
        "current_password": test_temp_password,
        "new_password": test_temp_password,
        "confirm_password": test_temp_password
    }, headers=auth_headers)
    assert_test(
        same_pw_res.status_code == 400 and "cannot be identical" in same_pw_res.json().get("detail", ""),
        "Change password rejects identical new password"
    )

    # 16. Authenticated Change Password successfully restores baseline password
    time.sleep(1.2)  # Ensure timestamp moves forward for revocation verification
    restore_chg_res = client.post("/api/auth/change-password", json={
        "current_password": test_temp_password,
        "new_password": "SmartPrice@2026!",
        "confirm_password": "SmartPrice@2026!"
    }, headers=auth_headers)
    assert_test(restore_chg_res.status_code == 200, "Change password succeeds and restores baseline demo password")

    # 17. Session Revocation: Token issued BEFORE the password change is now rejected
    revoked_call_res = client.put(
        "/api/products/APP-1029",
        json={"dynamic_pricing": True},
        headers=auth_headers
    )
    assert_test(
        revoked_call_res.status_code == 401 and "revoked" in revoked_call_res.json().get("detail", ""),
        "Prior session token issued before password change is revoked with HTTP 401"
    )

    # 18. Newly authenticated token succeeds on protected routes
    clean_login_res = complete_login("pradeep.retail@smartprice.ai", "SmartPrice@2026!")
    fresh_token = clean_login_res.json().get("session", {}).get("token")
    fresh_headers = {"Authorization": f"Bearer {fresh_token}"}
    fresh_call_res = client.put(
        "/api/products/APP-1029",
        json={"dynamic_pricing": False},
        headers=fresh_headers
    )
    assert_test(fresh_call_res.status_code == 200, "Fresh token succeeds on protected product routes after password change")

    print(f"\n==================================================")
    print(f"PHASE 2 TEST SUMMARY: {passed}/{total} TESTS PASSED ({(passed/total)*100:.1f}%)")
    print(f"==================================================\n")
    return passed == total

if __name__ == "__main__":
    success = run_password_management_tests()
    sys.exit(0 if success else 1)
