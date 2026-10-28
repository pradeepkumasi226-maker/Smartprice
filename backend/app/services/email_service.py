import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Callable, Dict, Any, List
from ...config import settings

logger = logging.getLogger("smartprice.email")

class EmailDeliveryError(Exception):
    """Raised when email delivery via SMTP fails."""
    pass

class EmailService:
    _mock_sender: Optional[Callable[[str, str, str, str], None]] = None
    _sent_messages: List[Dict[str, Any]] = []

    @classmethod
    def set_mock_sender(cls, handler: Optional[Callable[[str, str, str, str], None]] = None):
        """Allows test suites to mock SMTP dispatch and inspect dispatched messages."""
        cls._mock_sender = handler

    @classmethod
    def get_sent_messages(cls) -> List[Dict[str, Any]]:
        return list(cls._sent_messages)

    @classmethod
    def clear_sent_messages(cls):
        cls._sent_messages.clear()

    @classmethod
    def send_otp_email(cls, to_email: str, otp: str, purpose: str = "registration") -> bool:
        """
        Sends a 6-digit OTP verification email via Gmail SMTP (smtp.gmail.com:587 with STARTTLS).
        Never logs the OTP or credentials. Raises EmailDeliveryError on delivery failure.
        """
        clean_email = (to_email or "").strip().lower()
        if not clean_email:
            raise ValueError("Recipient email is required.")

        # Determine email subject & contextual title based on purpose
        if purpose == "registration":
            subject = f"SmartPrice - Your Email Verification Code: {otp}"
            action_title = "Account Verification Code"
            action_desc = "Please enter this verification code to complete your enterprise SmartPrice account registration."
        elif purpose == "login":
            subject = f"SmartPrice - Sign-In Security Verification Code: {otp}"
            action_title = "Sign-In Verification Code"
            action_desc = "A sign-in attempt was detected for your SmartPrice account. Enter this code to verify your identity and access your dashboard."
        elif purpose == "password_reset":
            subject = f"SmartPrice - Password Reset Verification Code: {otp}"
            action_title = "Password Reset Code"
            action_desc = "We received a request to reset your SmartPrice account password. Use this code to verify your identity."
        else:
            subject = f"SmartPrice - Verification Code: {otp}"
            action_title = "Security Verification Code"
            action_desc = "Please enter this verification code to verify your action."

        # Plaintext version
        plain_text = f"""SmartPrice Explainable AI Retail Intelligence
{action_title}
----------------------------------------
{action_desc}

Verification Code: {otp}

This code will expire in {settings.OTP_EXPIRY_MINUTES} minutes.
For security, never share this code with anyone. SmartPrice staff will never ask for your code.

If you did not request this verification, please safely ignore this email.
----------------------------------------
SmartPrice AI Retail Intelligence | Enterprise Pricing & Forecasting Engine
"""

        # Modern HTML Email with Dark Navy & Violet Accents
        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070B14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F8FAFC;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #070B14; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #0F172A; border-radius: 16px; border: 1px solid rgba(99, 102, 241, 0.28); box-shadow: 0 20px 40px rgba(0,0,0,0.6); overflow: hidden;">
          
          <!-- Header Branding -->
          <tr>
            <td style="padding: 28px 32px 20px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.12) 100%); border-bottom: 1px solid rgba(148, 163, 184, 0.12);">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: #FFFFFF;">
                      Smart<span style="color: #6366F1;">Price</span>
                    </span>
                    <div style="font-size: 11px; font-weight: 700; color: #38BDF8; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 4px;">
                      Explainable AI Retail Intelligence
                    </div>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 20px; font-size: 11px; font-weight: 700; color: #818CF8;">
                      OTP VERIFICATION
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.01em;">
                {action_title}
              </h2>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #94A3B8;">
                {action_desc}
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="padding: 22px; background: rgba(30, 41, 59, 0.7); border: 1px dashed rgba(99, 102, 241, 0.45); border-radius: 12px;">
                    <div style="font-size: 11px; font-weight: 700; color: #A78BFA; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
                      Your Single-Use Verification Code
                    </div>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #38BDF8; padding: 4px 0;">
                      {otp}
                    </div>
                    <div style="font-size: 12px; color: #10B981; font-weight: 600; margin-top: 8px;">
                      &#x23F1; Valid for {settings.OTP_EXPIRY_MINUTES} minutes
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <div style="padding: 14px 16px; background-color: rgba(239, 68, 68, 0.08); border-left: 3px solid #EF4444; border-radius: 6px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #FCA5A5;">
                  <strong>Security Reminder:</strong> Never share this verification code with anyone. SmartPrice staff will never ask for your OTP. If you did not initiate this request, someone may be trying to access your account.
                </p>
              </div>

              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748B;">
                If you did not request this email, no action is required and you can safely disregard this message.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: rgba(7, 11, 20, 0.6); border-top: 1px solid rgba(148, 163, 184, 0.1); text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748B;">
                &copy; 2026 SmartPrice AI Retail Intelligence. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

        # Intercept via test mock if registered
        if cls._mock_sender is not None:
            cls._sent_messages.append({
                "to_email": clean_email,
                "otp": otp,
                "purpose": purpose,
                "subject": subject
            })
            cls._mock_sender(clean_email, otp, purpose, subject)
            return True

        # Dynamically load SMTP configuration from absolute .env path
        smtp_cfg = settings.get_smtp_config()
        smtp_host = smtp_cfg["host"]
        smtp_port = smtp_cfg["port"]
        smtp_user = smtp_cfg["username"]
        smtp_pwd = smtp_cfg["password"]
        from_email = smtp_cfg["from_email"] or "no-reply@smartprice.ai"

        if not smtp_user or not smtp_pwd:
            logger.warning("[EmailService] SMTP credentials not configured. Cannot dispatch real email.")
            raise EmailDeliveryError(
                f"Gmail SMTP credentials are not configured in {smtp_cfg.get('loaded_from')}. "
                "Please configure real SMTP_USERNAME and SMTP_APP_PASSWORD."
            )

        # Assemble MIME message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"SmartPrice Security <{from_email}>"
        msg["To"] = clean_email

        part1 = MIMEText(plain_text, "plain", "utf-8")
        part2 = MIMEText(html_content, "html", "utf-8")
        msg.attach(part1)
        msg.attach(part2)

        try:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(smtp_user, smtp_pwd)
                server.sendmail(from_email, [clean_email], msg.as_string())
            
            logger.info(f"[EmailService] Successfully sent OTP email to '{clean_email}' (purpose: {purpose})")
            return True
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"[EmailService] Gmail SMTP authentication failed for '{smtp_user}': {e}")
            raise EmailDeliveryError(
                "Gmail SMTP authentication failed. Please verify that: "
                "1) 2-Step Verification is enabled on your Google account. "
                "2) SMTP_APP_PASSWORD is an active 16-character Google App Password (not your normal Google account password)."
            )
        except smtplib.SMTPServerDisconnected as e:
            logger.error(f"[EmailService] Gmail SMTP server disconnected during authentication for '{smtp_user}': {e}")
            raise EmailDeliveryError(
                f"Gmail SMTP server closed connection unexpectedly for '{smtp_user}'. "
                "This occurs when Google rejects placeholder credentials (e.g. youractualaddress@gmail.com). "
                "Please supply your real Gmail address and 16-character Google App Password in backend/.env."
            )
        except Exception as e:
            logger.error(f"[EmailService] Failed to send email to '{clean_email}': {type(e).__name__} - {e}")
            raise EmailDeliveryError(f"Failed to deliver verification email via Gmail SMTP: {e}")
