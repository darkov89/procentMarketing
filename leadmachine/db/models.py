"""SQLAlchemy models for Lead Machine."""

from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_name = Column(String(255), nullable=False, index=True)
    nip = Column(String(20), unique=True, nullable=True, index=True)
    regon = Column(String(20), nullable=True, index=True)
    krs = Column(String(20), nullable=True, index=True)
    website = Column(String(512), nullable=True, index=True)
    phone_normalized = Column(String(50), nullable=True, index=True)
    email_primary = Column(String(255), nullable=True, index=True)
    address = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True, index=True)
    postal_code = Column(String(20), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    distance_km = Column(Float, nullable=True)
    industry = Column(String(100), nullable=True, index=True)
    pkd_main = Column(String(20), nullable=True)

    # State Machine: new, disqualified, qualified, audited, offer_draft, offer_approved,
    # offer_published, outreach_queued, sent, followup_sent, replied_interested,
    # replied_question, replied_negative, unsubscribed, bounced, meeting_booked,
    # closed_won, closed_lost
    status = Column(String(50), default="new", nullable=False, index=True)
    score = Column(Integer, default=0, nullable=False)
    score_breakdown = Column(JSON, nullable=True)
    rejection_reason = Column(String(255), nullable=True)
    owner_confidence = Column(String(50), nullable=True)  # high, medium, low, none
    source_name = Column(String(100), default="scraper", nullable=False)

    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    contacts = relationship("Contact", back_populates="lead", cascade="all, delete-orphan")
    audit = relationship(
        "Audit", back_populates="lead", uselist=False, cascade="all, delete-orphan"
    )
    offer = relationship(
        "Offer", back_populates="lead", uselist=False, cascade="all, delete-orphan"
    )
    messages = relationship("Message", back_populates="lead", cascade="all, delete-orphan")
    consents = relationship("Consent", back_populates="lead", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="lead", cascade="all, delete-orphan")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(
        Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    role = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(50), nullable=True)
    source = Column(String(100), default="scraper", nullable=False)
    confidence = Column(String(50), default="medium", nullable=False)
    is_primary = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=utcnow, nullable=False)

    lead = relationship("Lead", back_populates="contacts")


class Audit(Base):
    __tablename__ = "audits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(
        Integer, ForeignKey("leads.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    ssl_valid = Column(Boolean, nullable=True)
    is_responsive = Column(Boolean, nullable=True)
    pagespeed_mobile_score = Column(Integer, nullable=True)
    cms_detected = Column(String(100), nullable=True)
    copyright_year = Column(Integer, nullable=True)
    has_ga4 = Column(Boolean, nullable=True)
    has_gtm = Column(Boolean, nullable=True)
    has_meta_pixel = Column(Boolean, nullable=True)
    has_contact_form = Column(Boolean, nullable=True)
    has_online_booking = Column(Boolean, nullable=True)
    has_live_chat = Column(Boolean, nullable=True)
    social_links = Column(JSON, nullable=True)
    emails_scraped = Column(JSON, nullable=True)
    google_rating = Column(Float, nullable=True)
    google_reviews_count = Column(Integer, nullable=True)
    meta_ads_active = Column(Boolean, nullable=True)
    raw_evidence = Column(JSON, nullable=True)

    audited_at = Column(DateTime, default=utcnow, nullable=False)

    lead = relationship("Lead", back_populates="audit")


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(
        Integer, ForeignKey("leads.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    slug = Column(String(100), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    hero_observation = Column(Text, nullable=False)
    observations_evidence = Column(JSON, nullable=True)
    proposed_modules = Column(JSON, nullable=False)
    pricing_range = Column(String(100), nullable=True)
    process_steps = Column(JSON, nullable=True)
    booking_url = Column(String(512), nullable=False)
    netlify_deploy_id = Column(String(100), nullable=True)
    status = Column(
        String(50), default="draft", nullable=False
    )  # draft, approved, published, expired

    expires_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    lead = relationship("Lead", back_populates="offer")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(
        Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    direction = Column(String(20), nullable=False)  # outbound, inbound
    channel = Column(String(20), nullable=False)  # email, sms, whatsapp
    status = Column(
        String(50), default="draft", nullable=False
    )  # draft, approved, queued, sent, delivered, bounced, failed
    idempotency_key = Column(String(64), unique=True, nullable=True, index=True)
    message_id = Column(String(255), nullable=True, index=True)
    in_reply_to = Column(String(255), nullable=True, index=True)
    subject = Column(String(255), nullable=True)
    body_text = Column(Text, nullable=True)
    body_html = Column(Text, nullable=True)
    classification = Column(String(50), nullable=True)
    classification_details = Column(JSON, nullable=True)

    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    lead = relationship("Lead", back_populates="messages")


class Suppression(Base):
    __tablename__ = "suppression"

    id = Column(Integer, primary_key=True, autoincrement=True)
    hashed_email = Column(String(64), unique=True, nullable=True, index=True)
    hashed_phone = Column(String(64), unique=True, nullable=True, index=True)
    hashed_nip = Column(String(64), unique=True, nullable=True, index=True)
    hashed_domain = Column(String(64), unique=True, nullable=True, index=True)
    raw_identifier = Column(String(255), nullable=True)
    reason = Column(String(100), default="opt_out", nullable=False)

    created_at = Column(DateTime, default=utcnow, nullable=False)


class Consent(Base):
    __tablename__ = "consents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=True, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    channel = Column(String(20), nullable=False)  # email, sms, whatsapp
    granted = Column(Boolean, default=False, nullable=False)
    source = Column(String(100), nullable=False)
    evidence_text = Column(Text, nullable=False)

    granted_at = Column(DateTime, default=utcnow, nullable=False)

    lead = relationship("Lead", back_populates="consents")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    payload = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=utcnow, nullable=False)

    lead = relationship("Lead", back_populates="events")


class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    command_name = Column(String(100), nullable=False)
    status = Column(String(50), default="running", nullable=False)
    items_processed = Column(Integer, default=0, nullable=False)
    items_failed = Column(Integer, default=0, nullable=False)
    metrics = Column(JSON, nullable=True)

    started_at = Column(DateTime, default=utcnow, nullable=False)
    finished_at = Column(DateTime, nullable=True)
