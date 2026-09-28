"""ChannelGate: strict enforcement of channel permissions and explicit consent."""

from typing import Optional

from sqlalchemy.orm import Session

from leadmachine.db.models import Consent


class ConsentRequiredException(PermissionError):
    """Raised when an outreach channel (e.g. SMS, WhatsApp) lacks explicit consent."""
    pass


class ChannelBlockedException(PermissionError):
    """Raised when a channel is prohibited or improperly configured."""
    pass


class ChannelGate:
    """Enforces consent and legal restrictions for outreach channels."""

    ALLOWED_CHANNELS = {"email", "sms", "whatsapp"}

    @classmethod
    def verify_permission(
        cls,
        session: Session,
        lead_id: int,
        channel: str,
        contact_id: Optional[int] = None,
    ) -> bool:
        """Verifies if the given channel is permitted for the lead.

        Rules:
        - email: Allowed by default for public B2B contact under legitimate interest (Art. 6(1)(f) GDPR).
        - sms / whatsapp: STRICT REQUIREMENT - must have an active consent record with granted=True
          and non-empty evidence_text in the consents table.
        """
        normalized_channel = channel.lower().strip()
        if normalized_channel not in cls.ALLOWED_CHANNELS:
            raise ChannelBlockedException(f"Unsupported channel: '{channel}'")

        if normalized_channel == "email":
            return True

        # For SMS and WhatsApp, strictly check the consents table
        query = session.query(Consent).filter(
            Consent.lead_id == lead_id,
            Consent.channel == normalized_channel,
            Consent.granted.is_(True),
        )
        if contact_id:
            query = query.filter((Consent.contact_id == contact_id) | (Consent.contact_id.is_(None)))

        consent_record = query.first()

        if not consent_record or not consent_record.evidence_text:
            raise ConsentRequiredException(
                f"STRICT CHANNEL GATE: Cannot send via channel '{normalized_channel}' to Lead #{lead_id}. "
                f"No active, evidenced consent record found in 'consents' table."
            )

        return True
