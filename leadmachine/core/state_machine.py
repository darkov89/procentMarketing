"""Lead state machine and transition validation."""

from typing import Dict, Set


class InvalidStateTransitionError(ValueError):
    """Raised when an illegal lead state transition is attempted."""
    pass


# Strict allowed state transitions map
ALLOWED_TRANSITIONS: Dict[str, Set[str]] = {
    "new": {"qualified", "disqualified"},
    "qualified": {"audited", "disqualified"},
    "audited": {"offer_draft", "disqualified"},
    "offer_draft": {"offer_approved", "disqualified"},
    "offer_approved": {"offer_published", "disqualified"},
    "offer_published": {"outreach_queued", "disqualified"},
    "outreach_queued": {"sent", "disqualified"},
    "sent": {
        "followup_sent",
        "replied_interested",
        "replied_question",
        "replied_negative",
        "unsubscribed",
        "bounced",
    },
    "followup_sent": {
        "replied_interested",
        "replied_question",
        "replied_negative",
        "unsubscribed",
        "bounced",
    },
    "replied_interested": {"meeting_booked", "closed_won", "closed_lost", "unsubscribed"},
    "replied_question": {"meeting_booked", "closed_won", "closed_lost", "unsubscribed"},
    "meeting_booked": {"closed_won", "closed_lost", "unsubscribed"},
    "replied_negative": set(),
    "unsubscribed": set(),
    "bounced": set(),
    "disqualified": set(),
    "closed_won": set(),
    "closed_lost": set(),
}


def transition_lead_state(current_state: str, new_state: str) -> str:
    """Validates and applies state transition, raising InvalidStateTransitionError if illegal."""
    if current_state == new_state:
        return current_state

    allowed_targets = ALLOWED_TRANSITIONS.get(current_state, set())
    if new_state not in allowed_targets:
        raise InvalidStateTransitionError(
            f"Illegal state transition from '{current_state}' to '{new_state}'. "
            f"Allowed transitions: {sorted(list(allowed_targets))}"
        )
    return new_state
