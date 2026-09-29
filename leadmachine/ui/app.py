"""Streamlit web dashboard for Lead Machine (Procent Marketing).

World-Class Agency Showcase UI, ultra-fast cached data layer, real-time autonomous decision engine,
Netlify offer generation, live interactive offer preview, and automated personalized outreach.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components
from slugify import slugify
from sqlalchemy import or_
from sqlalchemy.orm import selectinload

from leadmachine.audit.web_auditor import WebAuditor
from leadmachine.config import get_settings
from leadmachine.core.dedup import is_duplicate, normalize_nip, normalize_phone_e164
from leadmachine.core.geo import validate_geo
from leadmachine.db.models import Audit, Contact, Lead, Message, Offer, utcnow
from leadmachine.db.session import get_db, init_db
from leadmachine.enrichment.registry_client import RegistryClient
from leadmachine.exporter.excel_exporter import export_leads_to_excel
from leadmachine.offers.generator import OfferContent, OfferGenerator, ProposedModule
from leadmachine.offers.html_renderer import render_offer_page
from leadmachine.offers.netlify_deployer import NetlifyDeployer
from leadmachine.outreach.email_composer import compose_outreach_email
from leadmachine.outreach.smtp_sender import SmtpSender
from leadmachine.pipeline.orchestrator import PipelineOrchestrator
from leadmachine.qualification.qualifier import LeadDecision, LeadQualifier

# Page setup
st.set_page_config(
    page_title="Lead Machine | Procent Marketing",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ----------------- ULTRA-FAST DATABASE INITIALIZATION & CACHING -----------------
@st.cache_resource
def ensure_db_ready():
    """Initializes DB schema once per server lifecycle (never runs on every click)."""
    init_db()
    return True

ensure_db_ready()


@st.cache_data(ttl=60, show_spinner=False)
def load_cached_leads_data() -> Tuple[List[Dict[str, Any]], Dict[int, Dict[str, Any]]]:
    """Loads all leads and their relations in 1 fast batched query with eager loading.
    
    Returns:
        tuple: (list of flat lead dicts for table/metrics, dict of full lead details by id)
    """
    with get_db() as session:
        leads = (
            session.query(Lead)
            .options(
                selectinload(Lead.offer),
                selectinload(Lead.messages),
                selectinload(Lead.audit),
                selectinload(Lead.contacts),
            )
            .filter(
                or_(Lead.city.is_(None), ~Lead.city.ilike("%wroc%")),
                or_(Lead.address.is_(None), ~Lead.address.ilike("%wroc%")),
                or_(Lead.rejection_reason.is_(None), ~Lead.rejection_reason.ilike("%wroc%")),
            )
            .order_by(Lead.score.desc(), Lead.id.asc())
            .all()
        )

        flat_leads = []
        lead_details = {}

        for lead in leads:
            score_data = lead.score_breakdown or {}
            has_offer = lead.offer is not None
            has_email = any(m.status == "sent" for m in lead.messages) if lead.messages else False
            
            offer_url = None
            offer_title = None
            offer_pricing = None
            offer_observation = None
            offer_modules = []
            offer_steps = []
            offer_evidence = []
            offer_published_at = None

            if has_offer and lead.offer:
                offer_url = getattr(lead.offer, "deploy_url", None) or getattr(lead.offer, "booking_url", None)
                offer_title = lead.offer.title
                offer_pricing = lead.offer.pricing_range
                offer_observation = lead.offer.hero_observation
                offer_modules = lead.offer.proposed_modules or []
                offer_steps = lead.offer.process_steps or []
                offer_evidence = lead.offer.observations_evidence or []
                if lead.offer.published_at:
                    offer_published_at = lead.offer.published_at.strftime("%Y-%m-%d %H:%M")

            sent_msg = None
            if lead.messages:
                for m in lead.messages:
                    if m.direction == "outbound" and m.channel == "email" and m.status == "sent":
                        sent_msg = {
                            "subject": m.subject,
                            "sent_at": m.sent_at.strftime("%Y-%m-%d %H:%M") if m.sent_at else "-",
                            "body_text": m.body_text,
                            "status": m.status,
                        }
                        break

            audit_info = None
            if lead.audit:
                audit_info = {
                    "ssl_valid": lead.audit.ssl_valid,
                    "is_responsive": lead.audit.is_responsive,
                    "cms_detected": lead.audit.cms_detected,
                    "has_ga4": lead.audit.has_ga4,
                    "has_online_booking": lead.audit.has_online_booking,
                    "has_contact_form": lead.audit.has_contact_form,
                    "meta_ads_active": lead.audit.meta_ads_active,
                }

            row = {
                "id": lead.id,
                "company_name": lead.company_name,
                "city": lead.city or "Legnica",
                "address": lead.address or "",
                "distance_km": lead.distance_km if lead.distance_km is not None else 0.0,
                "industry": lead.industry or "Nieokreślona",
                "status": lead.status,
                "score": lead.score or 0,
                "owner_confidence": lead.owner_confidence or "brak",
                "phone": lead.phone_normalized or "",
                "email": lead.email_primary or "",
                "website": lead.website or "",
                "nip": lead.nip or "",
                "krs": lead.krs or "",
                "rejection_reason": lead.rejection_reason or "",
                "has_offer": has_offer,
                "offer_url": offer_url,
                "has_email": has_email,
                "decision": score_data.get("decision", "unknown"),
                "confidence": score_data.get("confidence", "medium"),
                "automation_fit_reasons": score_data.get("automation_fit_reasons", []),
                "has_audit": lead.audit is not None,
                "created_at": lead.created_at.strftime("%Y-%m-%d") if lead.created_at else "",
            }
            flat_leads.append(row)

            lead_details[lead.id] = {
                **row,
                "offer_title": offer_title,
                "offer_pricing": offer_pricing,
                "offer_observation": offer_observation,
                "offer_modules": offer_modules,
                "offer_steps": offer_steps,
                "offer_evidence": offer_evidence,
                "offer_published_at": offer_published_at,
                "sent_message": sent_msg,
                "audit": audit_info,
            }

        return flat_leads, lead_details


# ----------------- WORLD-CLASS HIGH-CONTRAST AGENCY THEME -----------------
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');

    /* Global typography & High Contrast Canvas */
    html, body, [class*="st-"], .stApp {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif !important;
        background-color: #0A0E17 !important;
        color: #F8FAFC !important;
    }

    /* Headings */
    h1, h2, h3, h4, h5, h6 {
        color: #FFFFFF !important;
        font-weight: 800 !important;
        letter-spacing: -0.025em !important;
    }

    p, span, div, label {
        color: #E2E8F0;
    }

    code, pre {
        font-family: 'JetBrains Mono', monospace !important;
        background-color: #1E293B !important;
        color: #FFE600 !important;
        border-radius: 6px;
        padding: 2px 6px;
    }

    /* Procent Marketing Electric Yellow Accent */
    .pm-yellow {
        color: #FFE600 !important;
    }

    .hero-glow {
        color: #FFE600 !important;
        text-shadow: 0 0 25px rgba(255, 230, 0, 0.55);
    }

    /* Card Panels with High Contrast */
    .pm-card {
        background-color: #141C2E !important;
        border: 1px solid #28354D !important;
        border-radius: 12px !important;
        padding: 20px !important;
        margin-bottom: 16px !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
    }

    .pm-card-highlight {
        background: linear-gradient(145deg, #172238 0%, #111827 100%) !important;
        border: 1px solid rgba(255, 230, 0, 0.45) !important;
        box-shadow: 0 6px 24px rgba(255, 230, 0, 0.08) !important;
    }

    /* Modern Elevated Metric Cards */
    [data-testid="stMetric"] {
        background: #141C2E !important;
        border: 1px solid #28354D !important;
        border-radius: 12px !important;
        padding: 16px 18px !important;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3) !important;
    }

    [data-testid="stMetricLabel"] {
        color: #94A3B8 !important;
        font-size: 0.82rem !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.06em !important;
    }

    [data-testid="stMetricValue"] {
        color: #FFFFFF !important;
        font-weight: 900 !important;
        font-size: 2.2rem !important;
    }

    /* Status Badges with Vibrant Contrast */
    .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 13px;
        border-radius: 9999px;
        font-size: 0.76rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .badge-approved {
        background: #064E3B !important;
        color: #34D399 !important;
        border: 1px solid #059669 !important;
    }

    .badge-review {
        background: #78350F !important;
        color: #FBBF24 !important;
        border: 1px solid #D97706 !important;
    }

    .badge-rejected {
        background: #881337 !important;
        color: #FB7185 !important;
        border: 1px solid #E11D48 !important;
    }

    .badge-offer {
        background: #0C4A6E !important;
        color: #38BDF8 !important;
        border: 1px solid #0284C7 !important;
    }

    .badge-sent {
        background: #4C1D95 !important;
        color: #C084FC !important;
        border: 1px solid #7C3AED !important;
    }

    .badge-ai {
        background: #312E81 !important;
        color: #A5B4FC !important;
        border: 1px solid #4F46E5 !important;
    }

    /* Buttons: High Contrast & Punchy */
    div.stButton > button {
        background-color: #1E293B !important;
        color: #FFFFFF !important;
        border: 1px solid #334155 !important;
        border-radius: 8px !important;
        font-weight: 700 !important;
        padding: 8px 16px !important;
        transition: all 0.2s ease !important;
    }

    div.stButton > button:hover {
        background-color: #2D3D58 !important;
        border-color: #FFE600 !important;
        color: #FFE600 !important;
    }

    div.stButton > button[kind="primary"] {
        background-color: #FFE600 !important;
        color: #000000 !important;
        border: none !important;
        font-weight: 800 !important;
        box-shadow: 0 4px 14px rgba(255, 230, 0, 0.35) !important;
    }

    div.stButton > button[kind="primary"]:hover {
        background-color: #FFF04D !important;
        color: #000000 !important;
        box-shadow: 0 6px 20px rgba(255, 230, 0, 0.5) !important;
        transform: translateY(-1px);
    }

    /* Tabs Styling */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
        background-color: #101624 !important;
        padding: 6px;
        border-radius: 10px;
        border: 1px solid #1E293B;
    }

    .stTabs [data-baseweb="tab"] {
        color: #94A3B8 !important;
        font-weight: 700 !important;
        border-radius: 6px !important;
        padding: 8px 16px !important;
    }

    .stTabs [aria-selected="true"] {
        background-color: #1E293B !important;
        color: #FFE600 !important;
        border-bottom: 2px solid #FFE600 !important;
    }

    /* Inputs, Selects, Multiselects */
    [data-baseweb="select"] > div, input, textarea {
        background-color: #141C2E !important;
        color: #FFFFFF !important;
        border-color: #28354D !important;
    }

    /* Dataframe styling */
    [data-testid="stDataFrame"] {
        border-radius: 10px !important;
        overflow: hidden !important;
        border: 1px solid #28354D !important;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

settings = get_settings()
stop_file_exists = Path(settings.kill_switch_file).exists()

# ----------------- SIDEBAR: CONTROLS & INSTANT ACTIONS -----------------
st.sidebar.markdown(
    """
    <div style="padding-bottom: 12px; border-bottom: 1px solid #28354D; margin-bottom: 16px;">
        <span style="font-weight: 900; color: #FFE600; font-size: 1.05rem;">⚡ PROCENT MARKETING</span><br/>
        <span style="font-size: 0.78rem; color: #94A3B8;">Autonomiczny Silnik Lead Machine</span>
    </div>
    """,
    unsafe_allow_html=True,
)

if st.sidebar.button("🔄 Odśwież dane (Wymuś synchronizację)", use_container_width=True):
    st.cache_data.clear()
    st.rerun()

st.sidebar.markdown("### 🚀 Pełny Cykl Autonomiczny")
btn_full_pipeline = st.sidebar.button(
    "⚡ Uruchom Pełny Cykl B2B\n(Enrich → Audit → Qualify → Netlify → Email)",
    type="primary",
    use_container_width=True,
)

st.sidebar.markdown("### 🧩 Pojedyncze Etapy")
btn_enrich = st.sidebar.button("1. Sprawdź CEIDG / KRS", use_container_width=True)
btn_audit = st.sidebar.button("2. Przeprowadź audyt WWW", use_container_width=True)
btn_qualify = st.sidebar.button("3. Autonomiczna Kwalifikacja", use_container_width=True)
btn_offers = st.sidebar.button("4. Wygeneruj & Opublikuj Oferty", use_container_width=True)
btn_emails = st.sidebar.button("5. Wyślij E-maile Ofertowe", use_container_width=True)

st.sidebar.markdown("---")
btn_export = st.sidebar.button("📥 Pobierz arkusz leads.xlsx", use_container_width=True)

# ----------------- EXECUTE ACTIONS BEFORE RENDERING (SOLVES FREEZE / LATENCY) -----------------
if "flash_msg" not in st.session_state:
    st.session_state["flash_msg"] = None

if btn_full_pipeline:
    with st.spinner("⏳ Uruchamianie pełnego autonomicznego pipeline'u Lead Machine..."):
        orchestrator = PipelineOrchestrator()
        with get_db() as session:
            report = orchestrator.run_full_cycle(session, ignore_window=True)
        st.cache_data.clear()
        st.session_state["flash_msg"] = {
            "type": "success",
            "text": (
                f"✅ Zakończono pełny cykl! Wzbogacone: {report.enriched_count} | Zaudytowane: {report.audited_count} | "
                f"Zakwalifikowane: {report.auto_qualified_count} | Oferty Netlify: {report.offers_deployed_count} | Wysłane E-maile: {report.emails_sent_count}"
            ),
        }
        st.rerun()

if btn_enrich:
    with st.spinner("⏳ Pobieranie danych z rejestrów publicznych CEIDG / KRS..."):
        reg_client = RegistryClient()
        updated = 0
        with get_db() as session:
            leads_to_enrich = (
                session.query(Lead)
                .filter(Lead.status.in_(["new", "qualified", "needs_review"]))
                .all()
            )
            for lead in leads_to_enrich:
                res = reg_client.lookup(nip=lead.nip, krs=lead.krs, company_name=lead.company_name)
                if res and res.owner_name:
                    lead.owner_confidence = res.owner_confidence
                    if not lead.contacts:
                        c = Contact(lead=lead, first_name=res.owner_name, role=res.owner_role, is_primary=True, source=res.source)
                        session.add(c)
                    else:
                        lead.contacts[0].first_name = res.owner_name
                        lead.contacts[0].role = res.owner_role
                    updated += 1
            session.commit()
        st.cache_data.clear()
        st.session_state["flash_msg"] = {"type": "success", "text": f"✅ Zaktualizowano dane decydentów dla {updated} leadów!"}
        st.rerun()

if btn_audit:
    with st.spinner("⏳ Przeprowadzanie audytu technologiczno-marketingowego witryn..."):
        auditor = WebAuditor()
        audited_count = 0
        with get_db() as session:
            leads_to_audit = session.query(Lead).filter(Lead.website.isnot(None)).all()
            for lead in leads_to_audit:
                if not lead.audit:
                    audit_res = auditor.audit_url(lead.website)
                    a = Audit(
                        lead=lead,
                        ssl_valid=audit_res.ssl_valid,
                        is_responsive=audit_res.is_responsive,
                        cms_detected=audit_res.cms_detected,
                        copyright_year=audit_res.copyright_year,
                        has_ga4=audit_res.has_ga4,
                        has_gtm=audit_res.has_gtm,
                        has_meta_pixel=audit_res.has_meta_pixel,
                        has_contact_form=audit_res.has_contact_form,
                        has_online_booking=audit_res.has_online_booking,
                        has_live_chat=audit_res.has_live_chat,
                        social_links=audit_res.social_links,
                        emails_scraped=audit_res.emails_scraped,
                        meta_ads_active=audit_res.meta_ads_active,
                        raw_evidence=audit_res.evidence,
                    )
                    session.add(a)
                    lead.audit = a
                    audited_count += 1
            session.commit()
        st.cache_data.clear()
        st.session_state["flash_msg"] = {"type": "success", "text": f"✅ Przeprowadzono audyt WWW dla {audited_count} firm!"}
        st.rerun()

if btn_qualify:
    with st.spinner("⏳ Przeliczanie 3-poziomowej matrycy decyzyjnej AI..."):
        qualifier = LeadQualifier()
        with get_db() as session:
            leads_to_q = session.query(Lead).all()
            for lead in leads_to_q:
                q_res = qualifier.qualify_lead(lead, lead.audit)
                lead.score = q_res.total_score
                lead.status = q_res.suggested_status
                if q_res.decision == LeadDecision.AUTO_QUALIFIED:
                    lead.rejection_reason = None
                elif q_res.decision == LeadDecision.NEEDS_REVIEW:
                    lead.rejection_reason = q_res.review_reason
                else:
                    lead.rejection_reason = q_res.rejection_reason
                if q_res.breakdown:
                    lead.score_breakdown = {
                        **q_res.breakdown.model_dump(),
                        "decision": q_res.decision.value,
                        "confidence": q_res.confidence,
                        "automation_fit_reasons": q_res.automation_fit_reasons,
                    }
            session.commit()
        st.cache_data.clear()
        st.session_state["flash_msg"] = {"type": "success", "text": "✅ Zakończono automatyczną kwalifikację leadów!"}
        st.rerun()

if btn_offers:
    with st.spinner("⏳ Generowanie spersonalizowanych stron ofertowych..."):
        gen = OfferGenerator()
        deployer = NetlifyDeployer()
        count = 0
        with get_db() as session:
            leads_for_off = (
                session.query(Lead)
                .filter(Lead.status.in_(["qualified", "offer_draft", "offer_published"]))
                .all()
            )
            for lead in leads_for_off:
                offer_content = gen.generate(lead, lead.audit)
                safe_slug = slugify(f"{lead.company_name}-{lead.city or 'legnica'}")[:70]
                html = render_offer_page(offer_content, lead, safe_slug)
                dep_res = deployer.deploy(html, safe_slug)
                if not lead.offer:
                    off = Offer(
                        lead=lead,
                        slug=safe_slug,
                        title=offer_content.hero_headline,
                        hero_observation=offer_content.hero_observation,
                        observations_evidence=[o.model_dump() for o in offer_content.observations],
                        proposed_modules=[m.model_dump() for m in offer_content.proposed_modules],
                        pricing_range=offer_content.pricing_range,
                        process_steps=[s.model_dump() for s in offer_content.process_steps],
                        booking_url=dep_res.url,
                        deploy_url=dep_res.url,
                        netlify_deploy_id=dep_res.deploy_id,
                        status="published",
                        published_at=utcnow(),
                    )
                    session.add(off)
                else:
                    lead.offer.title = offer_content.hero_headline
                    lead.offer.hero_observation = offer_content.hero_observation
                    lead.offer.observations_evidence = [o.model_dump() for o in offer_content.observations]
                    lead.offer.proposed_modules = [m.model_dump() for m in offer_content.proposed_modules]
                    lead.offer.booking_url = dep_res.url
                    lead.offer.deploy_url = dep_res.url
                    lead.offer.status = "published"
                    lead.offer.published_at = utcnow()
                lead.status = "offer_published"
                count += 1
            session.commit()
        st.cache_data.clear()
        st.session_state["flash_msg"] = {"type": "success", "text": f"✅ Wygenerowano i opublikowano {count} stron ofertowych!"}
        st.rerun()

if btn_emails:
    with st.spinner("⏳ Przygotowywanie i bezpieczna wysyłka e-maili..."):
        sender = SmtpSender()
        sent_cnt = 0
        with get_db() as session:
            leads_for_em = session.query(Lead).filter(Lead.status == "offer_published").all()
            for lead in leads_for_em:
                if lead.offer:
                    draft = compose_outreach_email(
                        lead=lead,
                        offer=lead.offer,
                        offer_url=lead.offer.deploy_url or lead.offer.booking_url,
                    )
                    res = sender.send_email(draft, lead, session, ignore_window=True)
                    if res.success:
                        lead.status = "sent"
                        sent_cnt += 1
            session.commit()
        st.cache_data.clear()
        st.session_state["flash_msg"] = {"type": "success", "text": f"✅ Pomyślnie obsłużono wysyłkę e-maili ({sent_cnt} wysłanych)!"}
        st.rerun()


# ----------------- LOAD DATA (FAST CACHED) -----------------
flat_leads, lead_details = load_cached_leads_data()
df = pd.DataFrame(flat_leads) if flat_leads else pd.DataFrame()

if btn_export:
    if flat_leads:
        with get_db() as s:
            raw_leads = s.query(Lead).all()
            saved_path = export_leads_to_excel(raw_leads, Path("leads.xlsx"))
        st.sidebar.success(f"Pobrano {len(flat_leads)} leadów do {saved_path.name}")
    else:
        st.sidebar.warning("Brak leadów do eksportu.")


# ----------------- TOP BAR & SYSTEM STATUS -----------------
col_logo, col_ai, col_mode, col_kill = st.columns([3, 1.3, 1.2, 1.2])

with col_logo:
    st.markdown(
        """
        <div style="display: flex; align-items: center; gap: 14px;">
            <div style="background: #FFE600; color: #000; font-weight: 900; font-size: 1.4rem; padding: 6px 14px; border-radius: 9px; box-shadow: 0 0 20px rgba(255, 230, 0, 0.45);">%</div>
            <div>
                <h2 style="margin: 0; padding: 0; line-height: 1.1; font-size: 1.6rem;">PROCENT MARKETING <span class="hero-glow">LEAD MACHINE</span></h2>
                <span style="font-size: 0.82rem; color: #94A3B8;">Autonomiczny Silnik Sprzedaży B2B • Neon Cloud DB • Legnica + 30 km</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with col_ai:
    st.markdown(
        """
        <div style="text-align: right; padding-top: 4px;">
            <span class="badge badge-ai">⚡ AUTONOMOUS AI</span>
            <div style="font-size: 0.74rem; color: #94A3B8; margin-top: 3px;">Auto-Kwalifikacja • Oferta • Email</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with col_mode:
    if settings.live_mode:
        st.markdown(
            '<div style="text-align: right; padding-top: 4px;"><span class="badge badge-rejected">🔴 LIVE PRODUKCJA</span></div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<div style="text-align: right; padding-top: 4px;"><span class="badge badge-approved">🟢 TEST SANDBOX</span></div>',
            unsafe_allow_html=True,
        )
    st.markdown(
        f'<div style="text-align: right; font-size: 0.74rem; color: #94A3B8; margin-top: 3px;">Akceptacja: <b>{settings.approval_mode}</b></div>',
        unsafe_allow_html=True,
    )

with col_kill:
    if stop_file_exists:
        st.markdown(
            '<div style="text-align: right; padding-top: 4px;"><span class="badge badge-rejected">🚨 ZABLOKOWANY</span></div>',
            unsafe_allow_html=True,
        )
        if st.button("Odblokuj STOP", type="primary", use_container_width=True):
            Path(settings.kill_switch_file).unlink(missing_ok=True)
            st.rerun()
    else:
        st.markdown(
            '<div style="text-align: right; padding-top: 4px;"><span class="badge badge-approved">🛡️ BEZPIECZNIK OK</span></div>',
            unsafe_allow_html=True,
        )
        if st.button("Aktywuj STOP", use_container_width=True):
            Path(settings.kill_switch_file).touch()
            st.rerun()

# Display flash message if exists
if st.session_state["flash_msg"]:
    st.success(st.session_state["flash_msg"]["text"])
    st.session_state["flash_msg"] = None

st.divider()


# ----------------- MAIN NAVIGATION TABS -----------------
tab_dash, tab_crm, tab_matrix, tab_review, tab_import = st.tabs(
    [
        "📊 Pulpit Operacyjny & Lejek",
        "📋 Pipeline CRM & Karty Leadów",
        "🤖 Centrum Decyzji Autonomicznej",
        "⚖️ Kolejka do Weryfikacji (AI Uncertain)",
        "📤 Wgraj Własne Leady & Narzędzia",
    ]
)


# ================= TAB 1: EXECUTIVE DASHBOARD & FUNNEL =================
with tab_dash:
    if df.empty:
        st.info("Baza danych jest pusta. Dodaj lub zaimportuj leady w zakładce 'Wgraj Własne Leady & Narzędzia'.")
    else:
        col1, col2, col3, col4, col5, col6 = st.columns(6)
        total_leads = len(df)
        auto_approved = len(df[df["status"].isin(["qualified", "offer_published", "sent"])])
        needs_review = len(df[df["status"] == "needs_review"])
        offers_ready = len(df[df["has_offer"]])
        emails_sent = len(df[df["has_email"]])
        dental_leads = len(df[df["industry"].str.contains("dentyst|stomatolog|medycyn|lekar", case=False, na=False)])

        col1.metric("Wszystkie Leady", total_leads)
        col2.metric("Zakwalifikowane", auto_approved, f"{int(auto_approved / total_leads * 100)}%" if total_leads else "")
        col3.metric("Do Weryfikacji", needs_review, f"{int(needs_review / total_leads * 100)}%" if total_leads else "")
        col4.metric("Oferty Gotowe", offers_ready, "Strony WWW")
        col5.metric("Wysłane E-maile", emails_sent, "Outreach")
        col6.metric("Stomatologia", dental_leads, "Top Priorytet")

        st.markdown("<br/>", unsafe_allow_html=True)
        c_funnel1, c_funnel2 = st.columns([3, 2])

        with c_funnel1:
            st.markdown("#### 📈 Rozkład Stanów w Maszynie Leada")
            status_df = df["status"].value_counts().reset_index()
            status_df.columns = ["Status", "Liczba"]
            st.bar_chart(status_df.set_index("Status"), color="#FFE600", height=280)

        with c_funnel2:
            st.markdown("#### 🎯 Branże Zakwalifikowane (Wysoki Potencjał Automatyzacji)")
            q_industries = df[df["status"].isin(["qualified", "offer_published", "sent"])]["industry"].value_counts().reset_index()
            q_industries.columns = ["Branża", "Liczba Leadów"]
            st.dataframe(q_industries, use_container_width=True, hide_index=True)


# ================= TAB 2: PIPELINE CRM & LEAD DOSSIER =================
with tab_crm:
    if df.empty:
        st.info("Brak leadów w bazie danych.")
    else:
        f_search, f_status, f_city = st.columns([2, 1, 1])
        with f_search:
            search_query = st.text_input("🔍 Szukaj firmy po nazwie, branży lub telefonie:")
        with f_status:
            status_filter = st.multiselect(
                "Filtruj status:",
                options=df["status"].unique().tolist(),
                default=df["status"].unique().tolist(),
            )
        with f_city:
            city_options = ["Wszystkie"] + sorted([c for c in df["city"].dropna().unique().tolist() if c])
            city_filter = st.selectbox("Miasto (≤30km od Legnicy):", options=city_options)

        filtered = df[df["status"].isin(status_filter)]
        if city_filter != "Wszystkie":
            filtered = filtered[filtered["city"] == city_filter]
        if search_query:
            q = search_query.lower()
            filtered = filtered[
                filtered["company_name"].str.lower().str.contains(q)
                | filtered["industry"].str.lower().str.contains(q)
                | filtered["phone"].fillna("").str.contains(q)
            ]

        st.caption(f"Wyświetlanie **{len(filtered)}** z **{len(df)}** leadów:")

        st.dataframe(
            filtered[
                [
                    "id",
                    "company_name",
                    "city",
                    "distance_km",
                    "industry",
                    "status",
                    "score",
                    "has_offer",
                    "has_email",
                    "owner_confidence",
                    "phone",
                    "website",
                ]
            ],
            use_container_width=True,
            hide_index=True,
        )

        st.markdown("---")
        st.markdown("### 🔬 Karta Leada, Prezentacja Oferty & E-mail")
        
        selected_id = st.selectbox("Wybierz ID leada do zbadania szczegółów:", options=filtered["id"].tolist())

        if selected_id and selected_id in lead_details:
            lead_info = lead_details[selected_id]
            c_lead_info, c_score_box = st.columns([3, 2])

            with c_lead_info:
                st.markdown(f"## **{lead_info['company_name']}**")
                st.markdown(
                    f"""
                    📍 **Lokalizacja**: {lead_info['address'] or 'Brak'}, **{lead_info['city']}** ({lead_info['distance_km']:.1f} km od Rynku w Legnicy)<br/>
                    📞 **Telefon**: `{lead_info['phone'] or 'Brak'}` | ✉️ **Email**: `{lead_info['email'] or 'Brak'}`<br/>
                    🌐 **Strona WWW**: [{lead_info['website']}]({lead_info['website']})<br/>
                    🏛️ **NIP**: `{lead_info['nip'] or 'Brak'}` | **KRS**: `{lead_info['krs'] or 'Brak'}` | **Branża**: `{lead_info['industry']}`
                    """,
                    unsafe_allow_html=True,
                )

            with c_score_box:
                if lead_info["status"] in ["qualified", "offer_published", "sent"]:
                    st.markdown('<span class="badge badge-approved">🟢 ZAKWALIFIKOWANY</span>', unsafe_allow_html=True)
                elif lead_info["status"] == "needs_review":
                    st.markdown('<span class="badge badge-review">🟡 DO WERYFIKACJI</span>', unsafe_allow_html=True)
                else:
                    st.markdown('<span class="badge badge-rejected">🔴 ODRZUCONY</span>', unsafe_allow_html=True)

                st.progress(min(100, lead_info["score"]) / 100)
                st.markdown(
                    f"<div style='font-size: 2.2rem; font-weight: 900; color: #FFE600;'>{lead_info['score']} / 100 pkt</div>",
                    unsafe_allow_html=True,
                )
                st.markdown(f"Pewność decydenta: <b>`{lead_info['owner_confidence']}`</b>", unsafe_allow_html=True)

            # ----------------- OFFER SECTION & LIVE PREVIEW -----------------
            st.markdown("#### 🌐 Dedykowana Strona Oferty (Prezentacja WWW)")
            
            if lead_info["has_offer"]:
                offer_url = lead_info["offer_url"]
                is_web_url = offer_url and (offer_url.startswith("http://") or offer_url.startswith("https://"))
                
                st.markdown(
                    f"""
                    <div class="pm-card pm-card-highlight">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                            <div>
                                <span class="badge badge-offer">🌐 OFERTA GOTOWA DO PREZENTACJI</span>
                                <h3 style="margin: 8px 0 4px 0; color: #FFE600;">{lead_info['offer_title']}</h3>
                                <p style="color: #CBD5E1; font-size: 0.88rem; margin: 0;">Budżet: <b>{lead_info['offer_pricing']}</b> | Data: <b>{lead_info['offer_published_at'] or '-'}</b></p>
                            </div>
                        </div>
                        <div style="margin-top: 14px; font-size: 0.9rem; color: #F1F5F9; line-height: 1.5;">
                            <b>Obserwacja przewodnia:</b> {lead_info['offer_observation']}
                        </div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

                # Reconstruct HTML for live in-app preview
                modules = [ProposedModule(**m) if isinstance(m, dict) else m for m in lead_info["offer_modules"]]
                offer_content = OfferContent(
                    hero_headline=lead_info["offer_title"],
                    hero_observation=lead_info["offer_observation"],
                    observations=lead_info["offer_evidence"],
                    proposed_modules=modules,
                    pricing_range=lead_info["offer_pricing"],
                    process_steps=lead_info["offer_steps"],
                    cta_text="Umów bezpłatną konsultację",
                )

                dummy_lead = Lead(
                    id=lead_info["id"],
                    company_name=lead_info["company_name"],
                    city=lead_info["city"],
                    website=lead_info["website"],
                )
                safe_slug = slugify(f"{lead_info['company_name']}-{lead_info['city']}")[:70]
                rendered_html = render_offer_page(offer_content, dummy_lead, safe_slug)

                col_prev_btn, col_down_btn = st.columns([1, 1])
                with col_down_btn:
                    st.download_button(
                        label="📥 Pobierz plik HTML oferty",
                        data=rendered_html,
                        file_name=f"oferta-{safe_slug}.html",
                        mime="text/html",
                        use_container_width=True,
                    )
                with col_prev_btn:
                    if is_web_url:
                        st.markdown(
                            f'<a href="{offer_url}" target="_blank" style="background:#FFE600; color:#000; font-weight:800; padding:10px 18px; border-radius:8px; text-decoration:none; display:block; text-align:center;">👉 Otwórz na Netlify</a>',
                            unsafe_allow_html=True,
                        )

                with st.expander("👁️ Podgląd Wygenerowanej Strony Oferty na Żywo (Kliknij, aby rozwinąć)", expanded=False):
                    components.html(rendered_html, height=720, scrolling=True)

            else:
                st.info("Ta firma nie ma jeszcze wygenerowanej strony oferty.")
                if st.button(f"⚡ Wygeneruj stronę oferty dla {lead_info['company_name']}", type="primary"):
                    with st.spinner("Generowanie oferty przez model AI..."):
                        with get_db() as session:
                            db_lead = session.query(Lead).filter(Lead.id == selected_id).first()
                            if db_lead:
                                gen = OfferGenerator()
                                deployer = NetlifyDeployer()
                                off_content = gen.generate(db_lead, db_lead.audit)
                                safe_slug = slugify(f"{db_lead.company_name}-{db_lead.city or 'legnica'}")[:70]
                                html = render_offer_page(off_content, db_lead, safe_slug)
                                dep_res = deployer.deploy(html, safe_slug)

                                off = Offer(
                                    lead=db_lead,
                                    slug=safe_slug,
                                    title=off_content.hero_headline,
                                    hero_observation=off_content.hero_observation,
                                    observations_evidence=[o.model_dump() for o in off_content.observations],
                                    proposed_modules=[m.model_dump() for m in off_content.proposed_modules],
                                    pricing_range=off_content.pricing_range,
                                    process_steps=[s.model_dump() for s in off_content.process_steps],
                                    booking_url=dep_res.url,
                                    deploy_url=dep_res.url,
                                    netlify_deploy_id=dep_res.deploy_id,
                                    status="published",
                                    published_at=utcnow(),
                                )
                                session.add(off)
                                db_lead.status = "offer_published"
                                session.commit()
                        st.cache_data.clear()
                        st.session_state["flash_msg"] = {"type": "success", "text": "Pomyślnie wygenerowano stronę oferty!"}
                        st.rerun()

            # ----------------- EMAIL OUTREACH SECTION -----------------
            st.markdown("#### ✉️ Status Wysyłki E-mail")
            sent_msg = lead_info.get("sent_message")

            if sent_msg:
                st.markdown(
                    f"""
                    <div class="pm-card" style="border-left: 4px solid #C084FC !important;">
                        <span class="badge badge-sent">✉️ E-MAIL WYSŁANY ({sent_msg['status'].upper()})</span>
                        <h4 style="margin: 8px 0 4px 0; color: #FFFFFF;">{sent_msg['subject']}</h4>
                        <span style="font-size: 0.85rem; color: #94A3B8;">Odbiorca: <b>{lead_info['email'] or 'Adres firmowy'}</b> | Wysłano: <b>{sent_msg['sent_at']}</b></span>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
                with st.expander("📄 Treść wysłanej wiadomości"):
                    st.text(sent_msg["body_text"])
            else:
                st.warning("E-mail z linkiem do oferty nie został jeszcze wysłany do tego leada.")
                if lead_info["has_offer"]:
                    if st.button(f"✉️ Wyślij e-mail z ofertą do {lead_info['company_name']}", type="primary"):
                        with st.spinner("Wysyłka e-maila zgodnie z polityką RODO..."):
                            with get_db() as session:
                                db_lead = session.query(Lead).filter(Lead.id == selected_id).first()
                                if db_lead and db_lead.offer:
                                    sender = SmtpSender()
                                    offer_url = db_lead.offer.deploy_url or db_lead.offer.booking_url
                                    draft = compose_outreach_email(lead=db_lead, offer=db_lead.offer, offer_url=offer_url)
                                    res = sender.send_email(draft, db_lead, session, ignore_window=True)
                                    if res.success:
                                        db_lead.status = "sent"
                                        session.commit()
                                        st.cache_data.clear()
                                        st.session_state["flash_msg"] = {"type": "success", "text": f"Wysłano e-mail do: {res.recipient} (Sandbox: {res.was_test_mode})"}
                                        st.rerun()
                                    else:
                                        st.error(f"Błąd wysyłki: {res.error_message}")


# ================= TAB 3: AUTONOMOUS DECISION MATRIX =================
with tab_matrix:
    st.markdown("### 🤖 Autonomiczna Matryca Decyzyjna AI")
    st.caption("Lead Machine podejmuje samodzielne decyzje kwalifikacyjne, kierując do człowieka wyłącznie przypadki niejednoznaczne.")

    col_m1, col_m2, col_m3 = st.columns(3)
    with col_m1:
        st.markdown(
            """
            <div class="pm-card pm-card-highlight">
                <span class="badge badge-approved">🟢 AUTO-QUALIFIED</span>
                <h4 style="margin-top: 10px; color: #34D399;">Automatyczna Akceptacja</h4>
                <ul style="font-size: 0.88rem; color: #E2E8F0; line-height: 1.6; padding-left: 18px;">
                    <li><b>Branże priorytetowe:</b> Stomatologia, Medycyna, Kancelarie prawne, Biura rachunkowe, OZE/PV, B2B.</li>
                    <li><b>Próg scoringu:</b> Score ≥ 60 pkt (priorytet) lub ≥ 68 pkt (pozostałe).</li>
                    <li><b>Twarde sygnały potrzeby:</b> Brak rezerwacji online wizyt (Booksy/Calendly), brak formularza kontaktowego, brak Google Analytics 4.</li>
                </ul>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with col_m2:
        st.markdown(
            """
            <div class="pm-card" style="border-color: rgba(245, 158, 11, 0.4) !important;">
                <span class="badge badge-review">🟡 NEEDS REVIEW</span>
                <h4 style="margin-top: 10px; color: #FBBF24;">Weryfikacja Człowieka</h4>
                <ul style="font-size: 0.88rem; color: #E2E8F0; line-height: 1.6; padding-left: 18px;">
                    <li><b>Strefa graniczna:</b> Wynik w przedziale 48–67 pkt w branży ogólnej.</li>
                    <li><b>Brak jednoznacznego profilu:</b> Działalność nietypowa, nieznany decydent w KRS/CEIDG.</li>
                    <li><b>Zasada:</b> 1 kliknięcie właściciela w panelu natychmiast zatwierdza lub odrzuca leada.</li>
                </ul>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with col_m3:
        st.markdown(
            """
            <div class="pm-card" style="border-color: rgba(244, 63, 94, 0.4) !important;">
                <span class="badge badge-rejected">🔴 AUTO-DISQUALIFIED</span>
                <h4 style="margin-top: 10px; color: #FB7185;">Automatyczne Odrzucenie</h4>
                <ul style="font-size: 0.88rem; color: #E2E8F0; line-height: 1.6; padding-left: 18px;">
                    <li><b>Mikro-handel / „Sklep Pani Krysi”:</b> Warzywniaki, kioski, lumpeksy, lombardy, pasmanteria.</li>
                    <li><b>Trenerzy & fitness:</b> Trenerzy personalni, siłownie, sztuki walki, yoga.</li>
                    <li><b>Twarde reguły geo:</b> Wrocław (bezwzględne odrzucenie) lub odległość > 30 km od Rynku w Legnicy.</li>
                </ul>
            </div>
            """,
            unsafe_allow_html=True,
        )


# ================= TAB 4: HUMAN REVIEW QUEUE =================
with tab_review:
    st.markdown("### ⚖️ Kolejka do Weryfikacji (AI Uncertain Cases)")
    uncertain_leads = [l for l in flat_leads if l["status"] == "needs_review"]

    if not uncertain_leads:
        st.success("🎉 Brak oczekujących spraw! Silnik AI podjął samodzielne decyzje dla wszystkich leadów w bazie.")
    else:
        st.info(f"Oczekuje **{len(uncertain_leads)}** spraw wymagających decyzji człowieka:")
        for ul in uncertain_leads:
            with st.expander(f"Lead #{ul['id']}: {ul['company_name']} | {ul['city']} | Wynik: {ul['score']}/100", expanded=True):
                c_info, c_action = st.columns([3, 1])
                with c_info:
                    st.markdown(f"#### **{ul['company_name']}**")
                    st.write(f"Branża: **{ul['industry']}** | Miasto: **{ul['city']}** | Strona: [{ul['website']}]({ul['website']})")
                    if ul["rejection_reason"]:
                        st.warning(f"⚠️ **Powód skierowania do weryfikacji:** {ul['rejection_reason']}")
                with c_action:
                    if st.button("🟢 Zatwierdź Lead", key=f"rev_acc_{ul['id']}", type="primary", use_container_width=True):
                        with get_db() as session:
                            target = session.query(Lead).filter(Lead.id == ul["id"]).first()
                            if target:
                                target.status = "qualified"
                                target.rejection_reason = None
                                session.commit()
                        st.cache_data.clear()
                        st.session_state["flash_msg"] = {"type": "success", "text": f"Zatwierdzono #{ul['id']}!"}
                        st.rerun()

                    if st.button("🔴 Odrzuć Lead", key=f"rev_rej_{ul['id']}", use_container_width=True):
                        with get_db() as session:
                            target = session.query(Lead).filter(Lead.id == ul["id"]).first()
                            if target:
                                target.status = "disqualified"
                                target.rejection_reason = "Manualnie odrzucony przez człowieka w kolejce"
                                session.commit()
                        st.cache_data.clear()
                        st.session_state["flash_msg"] = {"type": "warning", "text": f"Odrzucono #{ul['id']}!"}
                        st.rerun()


# ================= TAB 5: IMPORT & DATA TOOLS =================
with tab_import:
    st.markdown("### 📤 Wgraj Własne Leady do Maszyny")
    st.caption("Możesz wgrać plik ze scrapera (CSV/JSON) lub wprowadzić nową firmę ręcznie.")

    c_upl, c_form = st.columns([1, 1])

    with c_upl:
        st.markdown("#### 📁 Wgraj Plik Scrapera (CSV / JSON)")
        uploaded_file = st.file_uploader("Wybierz plik z leadami:", type=["csv", "json"])
        if uploaded_file:
            save_path = Path("data") / uploaded_file.name
            save_path.parent.mkdir(parents=True, exist_ok=True)
            with open(save_path, "wb") as f:
                f.write(uploaded_file.getbuffer())
            st.success(f"Wgrano: `{save_path}`")

            if st.button("Importuj do Bazy i Wyklucz Wrocław", type="primary", use_container_width=True):
                from leadmachine.adapters.scraper_adapter import ScraperAdapter
                raw_items = ScraperAdapter.load_from_file(save_path)
                imported = 0
                wroclaw_dropped = 0

                with get_db() as session:
                    for raw in raw_items:
                        geo_res = validate_geo(city=raw.city, address=raw.address, latitude=raw.latitude, longitude=raw.longitude)
                        if "Wrocław" in (geo_res.rejection_reason or ""):
                            wroclaw_dropped += 1
                            continue

                        norm_nip = normalize_nip(raw.nip)
                        norm_phone = normalize_phone_e164(raw.phone)
                        is_dup, dup_r = is_duplicate(
                            session,
                            nip=norm_nip,
                            phone_normalized=norm_phone,
                            website=raw.website,
                            company_name=raw.company_name,
                            address=raw.address,
                        )

                        status, reason = (
                            ("disqualified", dup_r)
                            if is_dup
                            else (("disqualified", geo_res.rejection_reason) if not geo_res.is_allowed else ("new", None))
                        )
                        if not is_dup and geo_res.is_allowed:
                            imported += 1

                        lead = Lead(
                            company_name=raw.company_name,
                            nip=norm_nip,
                            website=raw.website,
                            phone_normalized=norm_phone,
                            email_primary=raw.email,
                            address=raw.address,
                            city=raw.city,
                            latitude=geo_res.latitude,
                            longitude=geo_res.longitude,
                            distance_km=geo_res.distance_km,
                            industry=raw.industry_category,
                            status=status,
                            rejection_reason=reason,
                        )
                        if not is_dup:
                            session.add(lead)
                    session.commit()

                st.cache_data.clear()
                st.session_state["flash_msg"] = {
                    "type": "success",
                    "text": f"Zakończono import! Dodano: {imported} leadów. Odrzucono z Wrocławia: {wroclaw_dropped}.",
                }
                st.rerun()

    with c_form:
        st.markdown("#### ✍️ Dodaj Pojedynczy Lead Ręcznie")
        with st.form("manual_lead_form"):
            man_name = st.text_input("Nazwa firmy *", value="Stomatologia Dr Kowalczyk")
            man_city = st.text_input("Miasto *", value="Legnica")
            man_addr = st.text_input("Adres", value="ul. Złotoryjska 24")
            man_phone = st.text_input("Telefon", value="+48 76 855 00 99")
            man_email = st.text_input("E-mail", value="kontakt@stomatologia-kowalczyk.pl")
            man_web = st.text_input("Strona WWW", value="https://stomatologia-kowalczyk.pl")
            man_ind = st.selectbox(
                "Branża",
                [
                    "Stomatologia / Gabinet lekarski",
                    "Kancelaria prawna / Adwokat",
                    "Biuro rachunkowe / Księgowość",
                    "Instalacje PV / Pompy ciepła / OZE",
                    "Usługi B2B / Automatyka",
                    "Inna branża",
                ],
            )
            submitted = st.form_submit_button("➕ Dodaj do Pipeline'u", type="primary", use_container_width=True)

            if submitted:
                geo_res = validate_geo(city=man_city, address=man_addr)
                if not geo_res.is_allowed:
                    st.error(f"Odrzucono przez filtr lokalizacji: {geo_res.rejection_reason}")
                else:
                    with get_db() as session:
                        norm_phone = normalize_phone_e164(man_phone)
                        new_lead = Lead(
                            company_name=man_name,
                            city=man_city,
                            address=man_addr,
                            phone_normalized=norm_phone,
                            email_primary=man_email,
                            website=man_web,
                            industry=man_ind,
                            distance_km=geo_res.distance_km,
                            status="new",
                            source_name="manual_ui",
                        )
                        session.add(new_lead)
                        session.commit()
                    st.cache_data.clear()
                    st.session_state["flash_msg"] = {"type": "success", "text": f"Dodano firmę '{man_name}' do bazy!"}
                    st.rerun()
