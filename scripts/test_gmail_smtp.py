#!/usr/bin/env python3
"""
SmartPrice Real Gmail SMTP Verification Script
Use this script to verify real email delivery after configuring your Gmail App Password.

Usage:
    python scripts/test_gmail_smtp.py [recipient@example.com]
"""

import sys
import os
from pathlib import Path

# Fix terminal encoding on Windows
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"

sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
if (PROJECT_ROOT / ".env").is_file():
    load_dotenv(PROJECT_ROOT / ".env")
if (BACKEND_DIR / ".env").is_file():
    load_dotenv(BACKEND_DIR / ".env", override=True)

from backend.config import settings
from backend.app.services.email_service import EmailService, EmailDeliveryError

def main():
    print("\n=======================================================")
    print("  SMARTPRICE GMAIL SMTP REAL DELIVERY VERIFICATION  ")
    print("=======================================================\n")

    smtp_cfg = settings.get_smtp_config()
    smtp_host = smtp_cfg["host"]
    smtp_port = smtp_cfg["port"]
    smtp_user = smtp_cfg["username"]
    smtp_pwd = smtp_cfg["password"]
    from_email = smtp_cfg["from_email"]

    print(f"[*] Project Root    : {PROJECT_ROOT}")
    print(f"[*] Backend Dir     : {BACKEND_DIR}")
    print(f"[*] Loaded .env From: {smtp_cfg.get('loaded_from')} (exists: {smtp_cfg.get('backend_env_exists') or smtp_cfg.get('root_env_exists')})")
    print(f"[*] SMTP Host       : {smtp_host}:{smtp_port} (STARTTLS)")
    print(f"[*] Configured User : {smtp_user if smtp_user else '[NOT SET]'}")
    print(f"[*] From Address    : {from_email if from_email else '[NOT SET]'}")
    print(f"[*] App Password    : {'*' * len(smtp_pwd) if smtp_pwd else '[NOT SET]'}")

    if not smtp_user or not smtp_pwd:
        print("\n[!] GMAIL CREDENTIALS MISSING:")
        print(f"    Please configure your Gmail credentials in: {BACKEND_DIR / '.env'}")
        print("    SMTP_HOST=smtp.gmail.com")
        print("    SMTP_PORT=587")
        print("    SMTP_USERNAME=your_real_gmail_address@gmail.com")
        print("    SMTP_APP_PASSWORD=your_16_character_app_password")
        print("    SMTP_FROM_EMAIL=your_real_gmail_address@gmail.com")
        print("\n    To generate a Gmail App Password:")
        print("    1. Go to Google Account -> Security (2-Step Verification must be enabled)")
        print("    2. Navigate to 'App passwords' (https://myaccount.google.com/apppasswords)")
        print("    3. Generate a 16-character App Password for 'SmartPrice'")
        print("    4. Paste the 16 characters into SMTP_APP_PASSWORD")
        return 1

    if "youractualaddress" in smtp_user or "abcdefghijklmnop" in (smtp_pwd or ""):
        print("\n[!] PLACEHOLDER CREDENTIALS DETECTED:")
        print(f"    Current SMTP_USERNAME is '{smtp_user}', which is a placeholder.")
        print(f"    Please replace it with your actual Gmail address and your real 16-char Google App Password in:")
        print(f"    {BACKEND_DIR / '.env'}")
        print("\n    Example:")
        print("    SMTP_USERNAME=pradeepkumasi226@gmail.com")
        print("    SMTP_APP_PASSWORD=abcd efgh ijkl mnop")
        print("    SMTP_FROM_EMAIL=pradeepkumasi226@gmail.com")
        return 1

    recipient = sys.argv[1] if len(sys.argv) > 1 else smtp_user
    print(f"\n[*] Sending live test verification OTP to: {recipient} ...")

    test_otp = "849201"
    try:
        EmailService.send_otp_email(
            to_email=recipient,
            otp=test_otp,
            purpose="registration"
        )
        print("\n[SUCCESS] Verification email successfully dispatched via Gmail SMTP!")
        print(f"          A verification code ({test_otp}) was sent to '{recipient}'.")
        print("          Please check your inbox (and spam folder if applicable).")
        return 0
    except EmailDeliveryError as e:
        print(f"\n[FAILURE] Delivery failed: {e}")
        return 1
    except Exception as e:
        print(f"\n[FAILURE] Unexpected error: {type(e).__name__} - {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
