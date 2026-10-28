import sys
import os
import uuid
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
from backend.config import settings
from backend.app.core.security import verify_password

client = TestClient(app)

def run_registration_tests():
    print("\n==================================================")
    print("SMARTPRICE REGISTRATION VERIFICATION SUITE")
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

    test_uid = uuid.uuid4().hex[:6]
    test_email = f"retail.user_{test_uid}@smartprice.test"
    test_password = "SecureRetail@2026!"
    test_name = f"Test Retailer {test_uid}"

    # 1. Valid registration directly returns HTTP 201 Created without OTP
    res = client.post("/api/auth/register", json={
        "name": test_name,
        "email": test_email,
        "password": test_password,
        "confirm_password": test_password
    })
    assert_test(res.status_code == 201, "Valid registration returns HTTP 201 Created", f"Status: {res.status_code}")
    data = res.json()
    assert_test(data.get("success") is True, "Response contains success: True")
    assert_test(bool(data.get("session", {}).get("token")), "Response contains valid JWT access token in session")
    assert_test(data.get("user", {}).get("identifier") == test_email, "Response contains correct user profile identifier")

    # 2. Token cryptographic validation
    token = data["session"]["token"]
    decoded = jwt.decode(token, settings.get_jwt_secret(), algorithms=[settings.JWT_ALGORITHM])
    assert_test(decoded.get("sub") == test_email, "JWT subject matches registered email")
    assert_test(decoded.get("role") == "Retail Pricing Manager", "JWT role is default unprivileged role")

    # 3. Database verification: password is safe bcrypt hash, never plaintext
    db = SessionLocal()
    try:
        user_in_db = db.query(User).filter(User.identifier == test_email).first()
        assert_test(user_in_db is not None, "User record is persisted in SQLite database")
        assert_test(user_in_db.password_hash != test_password, "Plaintext password is NEVER stored in database")
        assert_test(user_in_db.password_hash.startswith("$2b$") or user_in_db.password_hash.startswith("$2a$"), "Password hash uses standard bcrypt format")
        assert_test(verify_password(test_password, user_in_db.password_hash), "Stored hash correctly verifies password using bcrypt")
        assert_test(user_in_db.role == "Retail Pricing Manager", "User role in database is standard unprivileged role")
    finally:
        db.close()

    # 4. Privilege escalation prevention: client cannot register with privileged role
    escalation_email = f"hacker_{test_uid}@smartprice.test"

    res_esc = client.post("/api/auth/register", json={
        "name": "Attacker",
        "email": escalation_email,
        "password": test_password,
        "confirm_password": test_password,
        "role": "Store Operations Director"  # Attempt to escalate
    })
    assert_test(res_esc.status_code == 201, "Registration succeeds without error")
    esc_data = res_esc.json()
    assert_test(
        esc_data.get("user", {}).get("role") == "Retail Pricing Manager",
        "Client-specified privileged role is ignored; strictly assigned Retail Pricing Manager",
        f"Assigned: {esc_data.get('user', {}).get('role')}"
    )

    # 5. Duplicate email rejection
    res_dup = client.post("/api/auth/register", json={
        "name": "Duplicate User",
        "email": test_email,
        "password": test_password,
        "confirm_password": test_password
    })
    assert_test(res_dup.status_code in [400, 409], "Duplicate email registration rejected with HTTP 400/409")

    # 6. Password complexity rejection: too short (<8 chars)
    res_short = client.post("/api/auth/register", json={
        "name": "Short Pwd",
        "email": f"short_{test_uid}@smartprice.test",
        "password": "pass1",
        "confirm_password": "pass1"
    })
    assert_test(res_short.status_code == 422 or res_short.status_code == 400, "Password under 8 characters rejected with HTTP 400/422")

    # 7. Password complexity rejection: missing letters or numbers/specials
    res_no_num = client.post("/api/auth/register", json={
        "name": "No Number",
        "email": f"nonum_{test_uid}@smartprice.test",
        "password": "onlylettershere",
        "confirm_password": "onlylettershere"
    })
    assert_test(res_no_num.status_code == 400, "Password without digits/special chars rejected with HTTP 400")

    # 8. Mismatched confirm password rejection
    res_mismatch = client.post("/api/auth/register", json={
        "name": "Mismatch User",
        "email": f"mismatch_{test_uid}@smartprice.test",
        "password": "ValidPassword@2026",
        "confirm_password": "DifferentPassword@2026"
    })
    assert_test(res_mismatch.status_code == 400, "Mismatched confirm password rejected with HTTP 400")

    # 9. Invalid email address rejection
    res_bad_email = client.post("/api/auth/register", json={
        "name": "Bad Email",
        "email": "not-an-email",
        "password": "ValidPassword@2026",
        "confirm_password": "ValidPassword@2026"
    })
    assert_test(res_bad_email.status_code == 400 or res_bad_email.status_code == 422, "Malformed email address rejected")

    # 10. Newly registered user logs in directly via POST /api/auth/login without OTP
    login_res = client.post("/api/auth/login", json={
        "identifier": test_email,
        "password": test_password
    })
    assert_test(login_res.status_code == 200, "Newly registered user logs in successfully without OTP (HTTP 200)")
    login_data = login_res.json()
    assert_test(login_data.get("requires_otp") is False, "Login response confirms requires_otp is False")
    assert_test(login_data.get("user", {}).get("name") == test_name, "Login profile reflects registered user name")

    # Cleanup test users
    db = SessionLocal()
    try:
        db.query(User).filter(User.identifier.in_([test_email, escalation_email])).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()

    print("\n==================================================")
    print(f"REGISTRATION TEST SUMMARY: {passed}/{total} TESTS PASSED ({passed/total*100:.1f}%)")
    print("==================================================\n")
    return passed == total

if __name__ == "__main__":
    success = run_registration_tests()
    sys.exit(0 if success else 1)
