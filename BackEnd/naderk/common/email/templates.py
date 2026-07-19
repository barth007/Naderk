"""
All transactional email templates live here.
Each function returns (subject, html_body, text_body).
Keep HTML simple — inline styles only, no external CSS.
"""

from django.conf import settings


def _brand_name() -> str:
    return getattr(settings, 'BRAND_NAME', 'Naderkela')


def _base_html(title: str, body_content: str) -> str:
    brand = _brand_name()
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
          <!-- Header -->
          <tr>
            <td style="background:#E03E3E;padding:24px 32px;">
              <span style="color:#ffffff;font-size:20px;font-weight:700;">{brand}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              {body_content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background:#f9f9f9;border-top:1px solid #eeeeee;">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
                © {brand}. You're receiving this because you have an account with us.<br/>
                If you did not request this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
""".strip()


# ── OTP / Verification ────────────────────────────────────────────────────────

def otp_verification(code: str, expires_minutes: int = 5) -> tuple[str, str, str]:
    brand = _brand_name()
    subject = f"Your {brand} Verification Code"

    body_content = f"""
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Verify your account</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
        Use the code below to complete your registration. It expires in {expires_minutes} minutes.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <span style="display:inline-block;padding:16px 40px;background:#f3f4f6;border-radius:8px;
                     font-size:36px;font-weight:700;letter-spacing:12px;color:#111827;">
          {code}
        </span>
      </div>
      <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
        Do not share this code with anyone.
      </p>
    """

    html_body = _base_html(subject, body_content)
    text_body = (
        f"Your {brand} verification code is: {code}\n"
        f"It expires in {expires_minutes} minutes.\n"
        f"Do not share this code with anyone."
    )
    return subject, html_body, text_body


# ── Password Reset ────────────────────────────────────────────────────────────

def password_reset(reset_url: str) -> tuple[str, str, str]:
    brand = _brand_name()
    subject = f"Reset your {brand} password"

    body_content = f"""
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Password reset request</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
        We received a request to reset your password. Click the button below.
        This link expires in 30 minutes.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="{reset_url}"
           style="display:inline-block;padding:14px 32px;background:#E03E3E;color:#ffffff;
                  text-decoration:none;border-radius:6px;font-size:14px;font-weight:700;">
          Reset Password
        </a>
      </div>
      <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
        If you didn't request a password reset, you can safely ignore this email.
      </p>
    """

    html_body = _base_html(subject, body_content)
    text_body = (
        f"Reset your {brand} password by visiting this link:\n{reset_url}\n"
        f"This link expires in 30 minutes."
    )
    return subject, html_body, text_body


# ── Appointment Confirmation ──────────────────────────────────────────────────

def appointment_confirmation(
    patient_name: str,
    doctor_name: str,
    date: str,
    time: str,
    appointment_type: str,
) -> tuple[str, str, str]:
    brand = _brand_name()
    subject = f"Appointment Confirmed — {date} at {time}"

    body_content = f"""
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Your appointment is confirmed</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Hi {patient_name},</p>
      <table width="100%" cellpadding="12" cellspacing="0"
             style="background:#f9fafb;border-radius:8px;margin-bottom:24px;">
        <tr>
          <td style="font-size:13px;color:#6b7280;width:40%;">Doctor</td>
          <td style="font-size:13px;color:#111827;font-weight:600;">{doctor_name}</td>
        </tr>
        <tr style="border-top:1px solid #e5e7eb;">
          <td style="font-size:13px;color:#6b7280;">Date</td>
          <td style="font-size:13px;color:#111827;font-weight:600;">{date}</td>
        </tr>
        <tr style="border-top:1px solid #e5e7eb;">
          <td style="font-size:13px;color:#6b7280;">Time</td>
          <td style="font-size:13px;color:#111827;font-weight:600;">{time}</td>
        </tr>
        <tr style="border-top:1px solid #e5e7eb;">
          <td style="font-size:13px;color:#6b7280;">Type</td>
          <td style="font-size:13px;color:#111827;font-weight:600;">{appointment_type}</td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        Please arrive 10 minutes early. Contact us if you need to reschedule.
      </p>
    """

    html_body = _base_html(subject, body_content)
    text_body = (
        f"Hi {patient_name},\n\n"
        f"Your appointment is confirmed:\n"
        f"  Doctor : {doctor_name}\n"
        f"  Date   : {date}\n"
        f"  Time   : {time}\n"
        f"  Type   : {appointment_type}\n\n"
        f"Please arrive 10 minutes early."
    )
    return subject, html_body, text_body


# ── Welcome ───────────────────────────────────────────────────────────────────

def welcome(first_name: str) -> tuple[str, str, str]:
    brand = _brand_name()
    subject = f"Welcome to {brand}!"

    body_content = f"""
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Welcome, {first_name}!</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
        Your account has been verified and you're all set.
        Log in any time to book appointments, access your medical records, and more.
      </p>
      <p style="margin:0;font-size:14px;color:#6b7280;">
        We're glad to have you with us.
      </p>
    """

    html_body = _base_html(subject, body_content)
    text_body = (
        f"Welcome to {brand}, {first_name}!\n\n"
        f"Your account has been verified. Log in any time to get started."
    )
    return subject, html_body, text_body
