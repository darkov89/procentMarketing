"""Tests for Lead state machine transitions."""

import pytest

from leadmachine.core.state_machine import (
    InvalidStateTransitionError,
    transition_lead_state,
)


def test_valid_transitions():
    assert transition_lead_state("new", "qualified") == "qualified"
    assert transition_lead_state("qualified", "audited") == "audited"
    assert transition_lead_state("audited", "offer_draft") == "offer_draft"
    assert transition_lead_state("offer_draft", "offer_approved") == "offer_approved"
    assert transition_lead_state("offer_approved", "offer_published") == "offer_published"
    assert transition_lead_state("offer_published", "outreach_queued") == "outreach_queued"
    assert transition_lead_state("outreach_queued", "sent") == "sent"
    assert transition_lead_state("sent", "replied_interested") == "replied_interested"
    assert transition_lead_state("replied_interested", "meeting_booked") == "meeting_booked"
    assert transition_lead_state("meeting_booked", "closed_won") == "closed_won"


def test_needs_review_transitions():
    assert transition_lead_state("new", "needs_review") == "needs_review"
    assert transition_lead_state("needs_review", "qualified") == "qualified"
    assert transition_lead_state("needs_review", "disqualified") == "disqualified"


def test_direct_disqualification():
    assert transition_lead_state("new", "disqualified") == "disqualified"
    assert transition_lead_state("qualified", "disqualified") == "disqualified"
    assert transition_lead_state("audited", "disqualified") == "disqualified"


def test_invalid_transitions():
    with pytest.raises(InvalidStateTransitionError):
        # Cannot jump from new straight to sent
        transition_lead_state("new", "sent")

    with pytest.raises(InvalidStateTransitionError):
        # Cannot jump from disqualified back to qualified
        transition_lead_state("disqualified", "qualified")

    with pytest.raises(InvalidStateTransitionError):
        # Cannot jump from unsubscribed to sent
        transition_lead_state("unsubscribed", "sent")
