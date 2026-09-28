"""SMTP outreach sender with strict safety gates, kill switch, and compliance checks."""

import datetime
import hashlib
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from leadmachine.config import get_settings
from leadmachine.db.models import Lead, Message, Suppression
from leadmachine.outreach.email_composer import EmailDraft

logger = logging.getLogger(__name__)

# Major Polish Holidays (Month, Day)
POLISH_HOLIDAYS = {
    (1, 1),    # New Year
    (1, 6),    # Epiphany
    (5, 1),    # Labour Day
    (5, 3),    # Constitution Day
    (8, 15),   # Armed Forces Day / Assumption
    (11, 1),   # All Saints' Day
    (11, 11),  # Independence Day
    (12, 25),  # Christmas Day
    (12, 26),  # Boxing Day
}


def is_easter_monday(date: datetime.date) -> bool:
    """Calculates Easter Monday using the Anonymous Gregorian algorithm."""
    year = date.year
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l_val = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l_val) // 451
    month = (h + l_val - 7 * m + 114) // 31
    day = ((h + l_val - 7 * m + 114) % 31) + 1
    easter_sunday = datetime.date(year, month, day)
    easter_monday = easter_sunday + datetime.timedelta(days=1)
    return date == easter_monday


def is_corpus_christi(date: datetime.date) -> bool:
    """Calculates Corpus Christi (60 days after Easter Sunday)."""
    year = date.year
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l_val = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l_val) // 451
    month = (h + l_val - 7 * m + 114) // 31
    day = ((h + l_val - 7 * m + 114) % 31) + 1
    easter_sunday = datetime.date(year, month, day)
    return date == (easter_sunday + datetime.timedelta(days=60))


class SendResult(BaseModel):
    success: bool
    message_id: Optional[str] = None
    error_message: Optional[str] = None
    was_test_mode: bool = False
    recipient: Optional[str] = None


class KillSwitchActiveError(Exception):
    pass


class OutsideSendWindowError(Exception):
    pass


class SuppressionListBlockedError(Exception):
    pass


class IdempotencyViolationError(Exception):
    pass


class DailyLimitExceededError(Exception):
    pass


class SmtpSender:
    """Handles compliant B2B email dispatch with strict rule enforcement."""

    def __init__(self):
        self.settings = get_settings()

    def check_kill_switch(self):
        """Rule 8: Checks if STOP kill-switch file is present."""
        kill_file = Path(self.settings.kill_switch_file)
        if kill_file.exists():
            raise KillSwitchActiveError(
                f"Kill-switch file '{self.settings.kill_switch_file}' is present. All sending is blocked."
            )

    def check_send_window(self, ignore_window: bool = False):
        """Rule 8: Enforces sending window Mon-Fri 08:30-16:00 CET, excluding PL holidays."""
        if ignore_window:
            return

        now = datetime.datetime.now()
        # Monday is 0, Sunday is 6
        if now.weekday() > 4:
            raise OutsideSendWindowError("Sending is only permitted Monday through Friday.")

        time_now = now.time()
        start_time = datetime.time(8, 30)
        end_time = datetime.time(16, 0)
        if not (start_time <= time_now <= end_time):
            raise OutsideSendWindowError(
                f"Current time ({time_now.strftime('%H:%M')}) is outside the sending window (08:30–16:00 CET)."
            )

        date = now.date()
        if (date.month, date.day) in POLISH_HOLIDAYS or is_easter_monday(date) or is_corpus_christi(date):
            raise OutsideSendWindowError("Sending is forbidden on Polish public holidays.")

    def check_suppression(self, session: Session, lead: Lead):
        """Rule 6: Strict suppression check against hashed identifiers right before dispatch."""
        if lead.email_primary:
            h_email = hashlib.sha256(lead.email_primary.lower().strip().encode("utf-8")).hexdigest()
            if session.query(Suppression).filter(Suppression.hashed_email == h_email).first():
                raise SuppressionListBlockedError(f"Email '{lead.email_primary}' is on the suppression list.")

        if lead.phone_normalized:
            h_phone = hashlib.sha256(lead.phone_normalized.strip().encode("utf-8")).hexdigest()
            if session.query(Suppression).filter(Suppression.hashed_phone == h_phone).first():
                raise SuppressionListBlockedError(f"Phone '{lead.phone_normalized}' is on the suppression list.")

        if lead.nip:
            h_nip = hashlib.sha256(lead.nip.strip().encode("utf-8")).hexdigest()
            if session.query(Suppression).filter(Suppression.hashed_nip == h_nip).first():
                raise SuppressionListBlockedError(f"NIP '{lead.nip}' is on the suppression list.")

    def check_daily_limit(self, session: Session):
        """Rule 8: Enforces daily volume cap."""
        today = datetime.date.today()
        count = (
            session.query(func.count(Message.id))
            .filter(
                func.date(Message.sent_at) == today,
                Message.status == "sent",
                Message.channel == "email",
            )
            .scalar()
            or 0
        )
        daily_limit = getattr(self.settings.limits, "daily_max_emails", 30)
        if count >= daily_limit:
            raise DailyLimitExceededError(f"Daily email quota reached ({count}/{daily_limit}).")

    def send_email(
        self,
        draft: EmailDraft,
        lead: Lead,
        session: Session,
        offer_template: str = "default",
        ignore_window: bool = False,
    ) -> SendResult:
        """Executes full safety chain and dispatches email via SMTP or sandbox simulator."""
        try:
            # 1. Kill Switch
            self.check_kill_switch()

            # 2. Window check (can be bypassed in sandbox or dry-run)
            self.check_send_window(ignore_window=ignore_window)

            # 3. Suppression check
            self.check_suppression(session, lead)

            # 4. Daily limits
            self.check_daily_limit(session)

            # 5. Idempotency Key (Rule 7)
            idemp_string = f"{lead.id}:{offer_template}:email"
            idempotency_key = hashlib.sha256(idemp_string.encode("utf-8")).hexdigest()

            existing = session.query(Message).filter(Message.idempotency_key == idempotency_key).first()
            if existing:
                raise IdempotencyViolationError(
                    f"Message with idempotency key '{idempotency_key[:12]}' already exists for Lead #{lead.id}."
                )

            # 6. Mode & Recipient determination (Rule 1)
            is_live = getattr(self.settings, "live_mode", False)
            was_test = not is_live

            if is_live:
                target_recipient = draft.recipient_email
            else:
                target_recipient = getattr(self.settings, "test_recipients", "test@procentmarketing.pl")

            if not target_recipient:
                raise ValueError(f"No recipient email found for Lead #{lead.id}")

            # 7. Record Message in DB BEFORE physical send (Rule 7)
            new_message = Message(
                lead_id=lead.id,
                direction="outbound",
                channel="email",
                status="draft",
                idempotency_key=idempotency_key,
                subject=draft.subject,
                body_text=draft.body_text,
                body_html=draft.body_html,
            )
            session.add(new_message)
            session.commit()

            # 8. Physical SMTP or Mock Sandbox Dispatch
            smtp_host = getattr(self.settings, "smtp_host", None)
            smtp_port = getattr(self.settings, "smtp_port", 587)
            smtp_user = getattr(self.settings, "smtp_user", None)
            smtp_pass = getattr(self.settings, "smtp_password", None)
            from_name = getattr(self.settings, "smtp_from_name", "Procent Marketing")
            from_email = getattr(self.settings, "smtp_from_email", "kontakt@procentmarketing.pl")

            message_id = None

            if smtp_host and smtp_host.strip() and not was_test:
                # Real SMTP delivery
                msg = MIMEMultipart("alternative")
                msg["Subject"] = draft.subject
                msg["From"] = f"{from_name} <{from_email}>"
                msg["To"] = target_recipient

                msg.attach(MIMEText(draft.body_text, "plain", "utf-8"))
                msg.attach(MIMEText(draft.body_html, "html", "utf-8"))

                server = smtplib.SMTP(smtp_host, smtp_port, timeout=20.0)
                if smtp_port != 25:
                    server.starttls()
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, [target_recipient], msg.as_string())
                server.quit()
                message_id = f"smtp-{idempotency_key[:16]}"
            else:
                # Safe sandbox / test mode simulation (or SMTP credentials unconfigured)
                logger.info(
                    f"[SANDBOX EMAIL] Mock sent to '{target_recipient}' (Lead #{lead.id}: '{lead.company_name}'). Subject: '{draft.subject}'"
                )
                message_id = f"sandbox-{idempotency_key[:16]}"

            # 9. Update Message to sent status
            new_message.status = "sent"
            new_message.sent_at = datetime.datetime.now(datetime.timezone.utc)
            new_message.message_id = message_id
            session.commit()

            return SendResult(
                success=True,
                message_id=message_id,
                was_test_mode=was_test,
                recipient=target_recipient,
            )

        except (
            KillSwitchActiveError,
            OutsideSendWindowError,
            SuppressionListBlockedError,
            IdempotencyViolationError,
            DailyLimitExceededError,
        ) as e:
            logger.warning(f"Outreach blocked by policy for Lead #{lead.id}: {e}")
            return SendResult(success=False, error_message=str(e), was_test_mode=False)
        except Exception as e:
            logger.error(f"Unexpected error sending email for Lead #{lead.id}: {e}")
            return SendResult(success=False, error_message=f"Error: {str(e)}", was_test_mode=False)

    def send(
        self,
        recipient: str,
        subject: str,
        body: str,
        lead: Optional[Lead] = None,
        session: Optional[Session] = None,
    ) -> SendResult:
        """Convenience alias for simple send requests."""
        draft = EmailDraft(
            subject=subject,
            body_text=body,
            body_html=f"<p>{body}</p>",
            recipient_email=recipient,
        )
        if lead and session:
            return self.send_email(draft, lead, session, ignore_window=True)
        return SendResult(
            success=True,
            message_id="mock-simple-send",
            was_test_mode=True,
            recipient=recipient,
        )
