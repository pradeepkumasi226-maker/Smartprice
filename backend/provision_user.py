"""
SmartPrice Administrative User Provisioning & Credential Enrollment Tool.

Usage:
    python -m backend.provision_user --identifier user@smartprice.ai --password <password> [--role "Retail Pricing Manager"] [--name "Full Name"]
    python -m backend.provision_user --identifier user@smartprice.ai (prompts for password securely)
"""

import argparse
import getpass
import sys
import time
from backend.database import SessionLocal
from backend.app.models.user import User
from backend.app.core.security import hash_password

def provision_user(identifier: str, password: str, role: str = "Retail Pricing Manager", name: str = None) -> bool:
    identifier = identifier.strip().lower()
    if not identifier:
        print("[ERROR] Identifier (email or username) cannot be empty.")
        return False

    if len(password) < 8:
        print("[ERROR] Password must be at least 8 characters long for security.")
        return False

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.identifier == identifier).first()
        hashed = hash_password(password)

        if user:
            user.password_hash = hashed
            if role:
                user.role = role
            if name:
                user.name = name
            action = "updated credentials for"
        else:
            display_name = name or (identifier.split("@")[0].replace(".", " ").title() if "@" in identifier else identifier.title())
            user = User(
                id=f"usr-{int(time.time())}",
                name=display_name,
                identifier=identifier,
                role=role or "Retail Pricing Manager",
                password_hash=hashed
            )
            db.add(user)
            action = "created and provisioned"

        db.commit()
        db.refresh(user)
        print(f"[SUCCESS] Successfully {action} user: {user.name} ({user.identifier}) with role '{user.role}'.")
        return True
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Database error during provisioning: {e}")
        return False
    finally:
        db.close()

def main():
    parser = argparse.ArgumentParser(description="Provision or enroll SmartPrice users with verified credentials.")
    parser.add_argument("--identifier", "-i", required=True, help="User identifier (email, username, or phone)")
    parser.add_argument("--password", "-p", default=None, help="User password (will prompt securely if omitted)")
    parser.add_argument("--role", "-r", default="Retail Pricing Manager", help="User role (e.g. 'Retail Pricing Manager', 'Store Operations Director')")
    parser.add_argument("--name", "-n", default=None, help="User display name")

    args = parser.parse_args()

    password = args.password
    if not password:
        password = getpass.getpass(f"Enter password for '{args.identifier}': ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("[ERROR] Passwords do not match.")
            sys.exit(1)

    success = provision_user(
        identifier=args.identifier,
        password=password,
        role=args.role,
        name=args.name
    )

    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
