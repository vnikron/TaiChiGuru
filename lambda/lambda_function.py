import json
import os
import re
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from urllib.parse import parse_qs


TO_EMAIL = os.environ.get("TO_EMAIL", "vnikron@gmail.com").strip()
FROM_EMAIL = os.environ.get("FROM_EMAIL", "support@taichiguru.com").strip()
FROM_NAME = os.environ.get("FROM_NAME", "Tai Chi Guru").strip()
SUBJECT_PREFIX = os.environ.get("SUBJECT_PREFIX", "[Tai Chi Guru]").strip()
SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "content-type": "application/json",
        },
        "body": json.dumps(body),
    }


def clean(value):
    return str(value or "").strip()


def valid_email(email):
    return re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email) is not None


def first(params, *names):
    for name in names:
        values = params.get(name)
        if values:
            return values[0]
    return ""


def parse_body(event):
    raw_body = event.get("body") or ""
    content_type = clean((event.get("headers") or {}).get("content-type") or (event.get("headers") or {}).get("Content-Type")).lower()

    if not raw_body:
        return {}

    if "application/x-www-form-urlencoded" in content_type:
        params = parse_qs(raw_body, keep_blank_values=True)
        return {
            "contactName": first(params, "contactName", "name"),
            "contactEmail": first(params, "contactEmail", "contact-email", "email"),
            "comments": first(params, "comments", "tai-chi-comments", "message"),
            "avatarName": first(params, "avatarName", "avatar-name"),
            "source": first(params, "source"),
            "website": first(params, "website"),
        }

    return json.loads(raw_body)


def send_email(subject, body, reply_to):
    if not SMTP_HOST or not SMTP_USERNAME or not SMTP_PASSWORD:
        raise RuntimeError("SMTP settings are incomplete.")

    message = EmailMessage()
    message["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    message["To"] = TO_EMAIL
    message["Reply-To"] = reply_to
    message["Subject"] = subject
    message.set_content(body, charset="utf-8")

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()
        smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp.send_message(message, from_addr=FROM_EMAIL, to_addrs=[TO_EMAIL])


def lambda_handler(event, context):
    method = ((event.get("requestContext") or {}).get("http") or {}).get("method") or event.get("httpMethod") or ""

    if method == "OPTIONS":
        return response(204, {})

    if method != "POST":
        return response(405, {"ok": False, "message": "Method Not Allowed"})

    try:
        data = parse_body(event)
    except Exception:
        print("Could not parse request body")
        return response(400, {"ok": False, "message": "Invalid request body"})

    if clean(data.get("website")):
        return response(200, {"ok": True})

    contact_email = clean(data.get("contactEmail"))
    contact_name = clean(data.get("contactName"))
    comments = clean(data.get("comments"))
    avatar_name = clean(data.get("avatarName"))
    is_contact_form = data.get("source") == "tai-chi-guru-footer-form"

    if not valid_email(contact_email):
        return response(400, {"ok": False, "message": "Please enter a valid contact email."})

    if not comments:
        return response(400, {"ok": False, "message": "Please add Tai Chi set comments."})

    body_lines = [
        "New Tai Chi Guru contact message" if is_contact_form else "New Tai Chi Guru set request",
        "",
    ]

    if contact_name:
        body_lines.append(f"Name: {contact_name}")

    if not is_contact_form:
        body_lines.append(f"selected avatar: {avatar_name or 'Not selected'}")

    body_lines.extend([
        f"Contact email: {contact_email}",
        "",
        "Message:" if is_contact_form else "Tai Chi set comments:",
        comments,
        "",
        f"Source: {data.get('source') or 'tai-chi-guru-request-form'}",
        f"Sent from: {(event.get('headers') or {}).get('host') or (event.get('headers') or {}).get('Host') or 'unknown host'}",
        f"Date: {datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S GMT')}",
    ])

    subject = f"{SUBJECT_PREFIX} {'New contact message' if is_contact_form else 'New Tai Chi set request'}"

    try:
        send_email(subject, "\n".join(body_lines), contact_email)
        print("SMTP accepted message", {"toEmail": TO_EMAIL, "source": data.get("source") or "tai-chi-guru-request-form"})
        return response(200, {"ok": True})
    except Exception as error:
        print("SMTP send failed", repr(error))
        return response(502, {"ok": False, "message": "Email could not be sent."})
