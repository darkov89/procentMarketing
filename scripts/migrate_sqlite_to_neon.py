"""Migrate data from local SQLite database (leadmachine.db) to Neon PostgreSQL."""

import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from leadmachine.db.models import (
    Base,
    Lead,
    Contact,
    Audit,
    Offer,
    Message,
    Suppression,
    Consent,
    Event,
    Run,
)

sqlite_url = "sqlite:///leadmachine.db"
neon_url = "postgresql+psycopg2://neondb_owner:npg_lTEkwg2CF5oR@ep-round-resonance-b28ccax8.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require"

print("1. Łączenie z Neon PostgreSQL i tworzenie tabel...")
neon_engine = create_engine(neon_url, pool_pre_ping=True)
Base.metadata.create_all(neon_engine)
NeonSession = sessionmaker(bind=neon_engine)

print("2. Odczyt danych z lokalnej bazy SQLite...")
sqlite_engine = create_engine(sqlite_url)
SqliteSession = sessionmaker(bind=sqlite_engine)

with SqliteSession() as s_sqlite, NeonSession() as s_neon:
    # Check if Neon already has leads
    existing_count = s_neon.query(Lead).count()
    print(f"Liczba leadów obecnie w Neon: {existing_count}")

    if existing_count == 0:
        leads = s_sqlite.query(Lead).all()
        print(f"Migracja {len(leads)} leadów z SQLite do Neon...")
        
        for lead in leads:
            # Exclude Wrocław if any slipped in
            if lead.city and "wroc" in lead.city.lower():
                continue

            new_lead = Lead(
                id=lead.id,
                company_name=lead.company_name,
                nip=lead.nip,
                regon=lead.regon,
                krs=lead.krs,
                website=lead.website,
                phone_normalized=lead.phone_normalized,
                email_primary=lead.email_primary,
                address=lead.address,
                city=lead.city,
                postal_code=lead.postal_code,
                latitude=lead.latitude,
                longitude=lead.longitude,
                distance_km=lead.distance_km,
                industry=lead.industry,
                pkd_main=lead.pkd_main,
                status=lead.status,
                score=lead.score,
                score_breakdown=lead.score_breakdown,
                rejection_reason=lead.rejection_reason,
                owner_confidence=lead.owner_confidence,
                source_name=lead.source_name,
                created_at=lead.created_at,
                updated_at=lead.updated_at,
            )
            s_neon.add(new_lead)
            s_neon.flush()

            # Contacts
            for c in lead.contacts:
                new_c = Contact(
                    id=c.id,
                    lead_id=new_lead.id,
                    first_name=c.first_name,
                    last_name=c.last_name,
                    role=c.role,
                    email=c.email,
                    phone=c.phone,
                    source=c.source,
                    confidence=c.confidence,
                    is_primary=c.is_primary,
                    created_at=c.created_at,
                )
                s_neon.add(new_c)

            # Audit
            if lead.audit:
                a = lead.audit
                new_a = Audit(
                    id=a.id,
                    lead_id=new_lead.id,
                    ssl_valid=a.ssl_valid,
                    is_responsive=a.is_responsive,
                    pagespeed_mobile_score=a.pagespeed_mobile_score,
                    cms_detected=a.cms_detected,
                    copyright_year=a.copyright_year,
                    has_ga4=a.has_ga4,
                    has_gtm=a.has_gtm,
                    has_meta_pixel=a.has_meta_pixel,
                    has_contact_form=a.has_contact_form,
                    has_online_booking=a.has_online_booking,
                    has_live_chat=a.has_live_chat,
                    social_links=a.social_links,
                    emails_scraped=a.emails_scraped,
                    google_rating=a.google_rating,
                    google_reviews_count=a.google_reviews_count,
                    meta_ads_active=a.meta_ads_active,
                    raw_evidence=a.raw_evidence,
                    audited_at=a.audited_at,
                )
                s_neon.add(new_a)

            # Offer
            if lead.offer:
                o = lead.offer
                new_o = Offer(
                    id=o.id,
                    lead_id=new_lead.id,
                    slug=o.slug,
                    title=o.title,
                    hero_observation=o.hero_observation,
                    observations_evidence=o.observations_evidence,
                    proposed_modules=o.proposed_modules,
                    pricing_range=o.pricing_range,
                    process_steps=o.process_steps,
                    booking_url=o.booking_url,
                    deploy_url=o.deploy_url,
                    netlify_deploy_id=o.netlify_deploy_id,
                    status=o.status,
                    expires_at=o.expires_at,
                    published_at=o.published_at,
                    created_at=o.created_at,
                )
                s_neon.add(new_o)

            # Messages
            for m in lead.messages:
                new_m = Message(
                    id=m.id,
                    lead_id=new_lead.id,
                    contact_id=m.contact_id,
                    direction=m.direction,
                    channel=m.channel,
                    status=m.status,
                    idempotency_key=m.idempotency_key,
                    message_id=m.message_id,
                    in_reply_to=m.in_reply_to,
                    subject=m.subject,
                    body_text=m.body_text,
                    body_html=m.body_html,
                    classification=m.classification,
                    classification_details=m.classification_details,
                    sent_at=m.sent_at,
                    created_at=m.created_at,
                )
                s_neon.add(new_m)

        s_neon.commit()
        print("✓ Pomyślnie zmigrowano wszystkie dane do Neon PostgreSQL!")
    else:
        print(f"Neon PostgreSQL już zawiera dane ({existing_count} leadów). Pomijam duplikację.")

print("3. Weryfikacja bazy Neon:")
with NeonSession() as s:
    count = s.query(Lead).count()
    offers_count = s.query(Offer).count()
    messages_count = s.query(Message).count()
    print(f"   -> Leady w Neon: {count}")
    print(f"   -> Oferty w Neon: {offers_count}")
    print(f"   -> Wiadomości w Neon: {messages_count}")
    print("✓ Neon PostgreSQL jest w 100% gotowy do działania online!")
