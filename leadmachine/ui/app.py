"""Streamlit web dashboard for Lead Machine (Procent Marketing).

World-Class Agency Showcase UI, Cloudflare Tunnel ready, real-time autonomous decision engine,
Netlify offer generation, and automated personalized outreach.
"""

from pathlib import Path

import pandas as pd
import streamlit as st
from slugify import slugify
from sqlalchemy import or_

from leadmachine.audit.web_auditor import WebAuditor
from leadmachine.config import get_settings
from leadmachine.core.dedup import is_duplicate, normalize_nip, normalize_phone_e164
from leadmachine.core.geo import validate_geo
from leadmachine.db.models import Audit, Contact, Lead, Message, Offer, utcnow
from leadmachine.db.session import get_db, init_db
from leadmachine.enrichment.registry_client import RegistryClient
from leadmachine.exporter.excel_exporter import export_leads_to_excel
from leadmachine.offers.generator import OfferGenerator
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

# Custom World-Class Agency Styling (Procent Marketing Cyber-Dark Theme)
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Manrope:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800;900&display=swap');

    html, body, [class*="css"] {
        font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    h1, h2, h3, h4, h5, h6, .brand-font {
        font-family: 'Plus Jakarta Sans', sans-serif !important;
        letter-spacing: -0.025em;
    }

    code, .font-mono {
        font-family: 'JetBrains Mono', monospace !important;
    }

    /* Backgrounds & Canvas */
    .stApp {
        background: radial-gradient(circle at 15% 10%, #151821 0%, #0A0C10 60%, #060709 100%);
        color: #F3F4F6;
    }

    /* Glow Elements */
    .hero-glow {
        color: #FFE600;
        text-shadow: 0 0 20px rgba(255, 230, 0, 0.45);
    }

    .pulse-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #10B981;
        box-shadow: 0 0 10px #10B981;
        animation: pulseAnimation 2s infinite;
        margin-right: 6px;
    }

    @keyframes pulseAnimation {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    /* World-Class Metric Cards */
    [data-testid="stMetric"] {
        background: linear-gradient(135deg, rgba(26, 30, 42, 0.7) 0%, rgba(15, 17, 24, 0.85) 100%);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 16px 20px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    [data-testid="stMetric"]:hover {
        border-color: rgba(255, 230, 0, 0.4);
        transform: translateY(-3px);
        box-shadow: 0 14px 34px rgba(255, 230, 0, 0.12);
    }

    [data-testid="stMetricLabel"] {
        color: #9CA3AF !important;
        font-size: 0.78rem !important;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }

    [data-testid="stMetricValue"] {
        color: #FFFFFF !important;
        font-family: 'Plus Jakarta Sans', sans-serif !important;
        font-weight: 800 !important;
        font-size: 2.1rem !important;
    }

    /* Custom Badges */
    .pm-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 9999px;
        font-size: 0.73rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
    }

    .badge-auto-approved {
        background: rgba(16, 185, 129, 0.15);
        color: #10B981;
        border: 1px solid rgba(16, 185, 129, 0.35);
    }

    .badge-offer-published {
        background: rgba(14, 165, 233, 0.18);
        color: #38BDF8;
        border: 1px solid rgba(14, 165, 233, 0.4);
    }

    .badge-sent {
        background: rgba(168, 85, 247, 0.18);
        color: #C084FC;
        border: 1px solid rgba(168, 85, 247, 0.4);
    }

    .badge-needs-review {
        background: rgba(245, 158, 11, 0.18);
        color: #F59E0B;
        border: 1px solid rgba(245, 158, 11, 0.4);
    }

    .badge-auto-rejected {
        background: rgba(244, 63, 94, 0.15);
        color: #F43F5E;
        border: 1px solid rgba(244, 63, 94, 0.35);
    }

    .badge-live {
        background: rgba(239, 68, 68, 0.2);
        color: #EF4444;
        border: 1px solid rgba(239, 68, 68, 0.4);
    }

    .badge-sandbox {
        background: rgba(16, 185, 129, 0.15);
        color: #34D399;
        border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .badge-ai {
        background: rgba(139, 92, 246, 0.18);
        color: #A78BFA;
        border: 1px solid rgba(139, 92, 246, 0.35);
    }

    /* Cards and Glass Panels */
    .pm-card {
        background: rgba(20, 24, 34, 0.65);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 22px;
        margin-bottom: 20px;
    }

    .pm-card-highlight {
        background: linear-gradient(145deg, rgba(255, 230, 0, 0.04) 0%, rgba(20, 24, 34, 0.7) 100%);
        border: 1px solid rgba(255, 230, 0, 0.25);
    }

    /* Dataframe styling */
    [data-testid="stDataFrame"] {
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.07);
    }
    </style>
    """,
    unsafe_allow_html=True,
)


def load_leads_data():
    """Loads active leads from database, strictly excluding Wrocław and handling NULLs safely."""
    init_db()
    with get_db() as session:
        leads = (
            session.query(Lead)
            .filter(
                or_(Lead.city.is_(None), ~Lead.city.ilike("%wroc%")),
                or_(Lead.address.is_(None), ~Lead.address.ilike("%wroc%")),
                or_(Lead.rejection_reason.is_(None), ~Lead.rejection_reason.ilike("%wroc%")),
            )
            .order_by(Lead.score.desc(), Lead.id.asc())
            .all()
        )
        data = []
        for lead in leads:
            score_data = lead.score_breakdown or {}
            has_offer = lead.offer is not None
            has_email = any(m.status == "sent" for m in lead.messages) if lead.messages else False
            offer_url = (
                getattr(lead.offer, "deploy_url", None) or getattr(lead.offer, "booking_url", None)
                if has_offer
                else None
            )

            data.append(
                {
                    "id": lead.id,
                    "company_name": lead.company_name,
                    "city": lead.city,
                    "distance_km": lead.distance_km,
                    "industry": lead.industry or "Nieokreślona",
                    "status": lead.status,
                    "score": lead.score,
                    "owner_confidence": lead.owner_confidence or "brak",
                    "phone": lead.phone_normalized,
                    "email": lead.email_primary,
                    "website": lead.website,
                    "rejection_reason": lead.rejection_reason,
                    "has_offer": has_offer,
                    "offer_url": offer_url,
                    "has_email": has_email,
                    "decision": score_data.get("decision", "unknown"),
                    "confidence": score_data.get("confidence", "medium"),
                    "automation_fit_reasons": score_data.get("automation_fit_reasons", []),
                    "has_audit": lead.audit is not None,
                    "created_at": lead.created_at,
                }
            )
        return data, leads


settings = get_settings()
stop_file_exists = Path(settings.kill_switch_file).exists()

# ----------------- TOP BAR & STATUS HEADER -----------------
col_logo, col_ai, col_mode, col_kill = st.columns([3, 1.4, 1.2, 1.2])

with col_logo:
    st.markdown(
        """
        <div style="display: flex; align-items: center; gap: 14px;">
            <div style="background: #FFE600; color: #000; font-weight: 900; font-size: 1.4rem; padding: 6px 14px; border-radius: 9px; box-shadow: 0 0 16px rgba(255, 230, 0, 0.4);">%</div>
            <div>
                <h2 style="margin: 0; padding: 0; line-height: 1.1;" class="brand-font">PROCENT MARKETING <span class="hero-glow">LEAD MACHINE</span></h2>
                <span style="font-size: 0.8rem; color: #9CA3AF;">Autonomiczny Silnik Sprzedaży B2B • Netlify • E-mail • Legnica + 30 km</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with col_ai:
    st.markdown(
        """
        <div style="text-align: right; padding-top: 4px;">
            <span class="pm-badge badge-ai"><span class="pulse-dot"></span>AUTONOMOUS AI: ON</span>
            <div style="font-size: 0.72rem; color: #8F97A3; margin-top: 3px;">Auto-Akceptacja • Netlify • Email</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with col_mode:
    if settings.live_mode:
        st.markdown(
            '<div style="text-align: right; padding-top: 4px;"><span class="pm-badge badge-live">🔴 LIVE PRODUKCJA</span></div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<div style="text-align: right; padding-top: 4px;"><span class="pm-badge badge-sandbox">🟢 SANDBOX TEST</span></div>',
            unsafe_allow_html=True,
        )
    st.markdown(
        f'<div style="text-align: right; font-size: 0.72rem; color: #8F97A3; margin-top: 3px;">Tryb: <b>{settings.approval_mode}</b></div>',
        unsafe_allow_html=True,
    )

with col_kill:
    if stop_file_exists:
        st.markdown(
            '<div style="text-align: right; padding-top: 4px;"><span class="pm-badge badge-auto-rejected">🚨 ZABLOKOWANY</span></div>',
            unsafe_allow_html=True,
        )
        if st.button("Odblokuj System", type="primary", use_container_width=True):
            Path(settings.kill_switch_file).unlink(missing_ok=True)
            st.rerun()
    else:
        st.markdown(
            '<div style="text-align: right; padding-top: 4px;"><span class="pm-badge badge-auto-approved">🛡️ BEZPIECZNIK OK</span></div>',
            unsafe_allow_html=True,
        )
        if st.button("Aktywuj STOP", use_container_width=True):
            Path(settings.kill_switch_file).touch()
            st.rerun()

st.divider()

# Load Data
leads_dict, raw_leads_objects = load_leads_data()
df = pd.DataFrame(leads_dict) if leads_dict else pd.DataFrame()

# ----------------- SIDEBAR CONTROLS -----------------
st.sidebar.markdown(
    """
    <div style="padding-bottom: 12px; border-bottom: 1px solid #282C37; margin-bottom: 16px;">
        <span style="font-weight: 800; color: #FFE600; font-size: 0.95rem; font-family: 'Plus Jakarta Sans', sans-serif;">CENTRUM AUTONOMICZNE</span><br/>
        <span style="font-size: 0.76rem; color: #8F97A3;">Zarządzanie pełnym cyklem B2B</span>
    </div>
    """,
    unsafe_allow_html=True,
)

if st.sidebar.button("🔄 Odśwież dane z bazy", use_container_width=True):
    st.rerun()

st.sidebar.markdown("### 🚀 Główna Automatyzacja")
btn_full_pipeline = st.sidebar.button(
    "⚡ Uruchom Pełny Cykl Autonomiczny\n(Enrich → Audit → Qualify → Netlify → Email)",
    type="primary",
    use_container_width=True,
)

st.sidebar.markdown("### 🧩 Pojedyncze Kroki")
btn_enrich = st.sidebar.button("1. Sprawdź CEIDG / KRS", use_container_width=True)
btn_audit = st.sidebar.button("2. Przeprowadź audyt WWW", use_container_width=True)
btn_qualify = st.sidebar.button("3. Autonomiczna Kwalifikacja", use_container_width=True)
btn_offers = st.sidebar.button("4. Wygeneruj & Opublikuj Oferty (Netlify)", use_container_width=True)
btn_emails = st.sidebar.button("5. Wyślij E-maile Ofertowe", use_container_width=True)

st.sidebar.markdown("---")
if st.sidebar.button("📥 Pobierz arkusz leads.xlsx", use_container_width=True):
    if raw_leads_objects:
        saved_path = export_leads_to_excel(raw_leads_objects, Path("leads.xlsx"))
        st.sidebar.success(f"Wyeksportowano {len(raw_leads_objects)} leadów do {saved_path.name}")
    else:
        st.sidebar.warning("Brak leadów w bazie.")

st.sidebar.markdown(
    """
    <div style="background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.3); border-radius: 8px; padding: 12px; margin-top: 14px;">
        <span style="color: #38BDF8; font-weight: 700; font-size: 0.8rem;">🌐 Cloudflare Tunnel Status:</span><br/>
        <span style="font-size: 0.75rem; color: #94A3B8; line-height: 1.4;">
            Wystaw ten panel online poleceniem:<br/>
            <code style="color: #FFE600;">./run_cloudflare_tunnel.sh</code>
        </span>
    </div>
    """,
    unsafe_allow_html=True,
)

# ----------------- MAIN TABS -----------------
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
        st.info("Baza danych jest pusta. Wgraj własne leady w zakładce 'Wgraj Własne Leady & Narzędzia'.")
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
        col4.metric("Oferty Netlify", offers_ready, "Strony WWW")
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
        st.info("Brak leadów w bazie.")
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
        st.markdown("### 🔬 Karta Leada, Prezentacja Oferty Netlify & E-mail")
        selected_id = st.selectbox("Wybierz ID leada do zbadania szczegółów:", options=filtered["id"].tolist())

        if selected_id:
            with get_db() as session:
                lead_obj = session.query(Lead).filter(Lead.id == selected_id).first()
                if lead_obj:
                    c_lead_info, c_score_box = st.columns([3, 2])

                    with c_lead_info:
                        st.markdown(f"## **{lead_obj.company_name}**")
                        st.markdown(
                            f"""
                            📍 **Lokalizacja**: {lead_obj.address or 'Brak'}, **{lead_obj.city or 'Legnica'}** ({lead_obj.distance_km:.1f} km od Rynku w Legnicy)<br/>
                            📞 **Telefon**: `{lead_obj.phone_normalized or 'Brak'}` | ✉️ **Email**: `{lead_obj.email_primary or 'Brak'}`<br/>
                            🌐 **Strona WWW**: [{lead_obj.website}]({lead_obj.website})<br/>
                            🏛️ **NIP**: `{lead_obj.nip or 'Brak'}` | **KRS**: `{lead_obj.krs or 'Brak'}` | **Branża**: `{lead_obj.industry}`
                            """,
                            unsafe_allow_html=True,
                        )

                    with c_score_box:
                        if lead_obj.status in ["qualified", "offer_published", "sent"]:
                            st.markdown('<span class="pm-badge badge-auto-approved">🟢 ZAKWALIFIKOWANY</span>', unsafe_allow_html=True)
                        elif lead_obj.status == "needs_review":
                            st.markdown('<span class="pm-badge badge-needs-review">🟡 DO WERYFIKACJI</span>', unsafe_allow_html=True)
                        else:
                            st.markdown('<span class="pm-badge badge-auto-rejected">🔴 ODRZUCONY</span>', unsafe_allow_html=True)

                        st.progress(min(100, lead_obj.score) / 100)
                        st.markdown(
                            f"<div style='font-size: 2rem; font-weight: 800; color: #FFE600;'>{lead_obj.score} / 100 pkt</div>",
                            unsafe_allow_html=True,
                        )
                        st.markdown(f"Pewność decydenta: <b>`{lead_obj.owner_confidence or 'brak'}`</b>", unsafe_allow_html=True)

                    # ----------------- NETLIFY OFFER SECTION -----------------
                    st.markdown("#### 🌐 Dedykowana Strona Oferty (Netlify / WWW)")
                    if lead_obj.offer:
                        offer_url = lead_obj.offer.deploy_url or lead_obj.offer.booking_url
                        st.markdown(
                            f"""
                            <div class="pm-card pm-card-highlight">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <span class="pm-badge badge-offer-published">🌐 OFERTA OPUBLIKOWANA</span>
                                        <h3 style="margin: 8px 0 4px 0; color: #FFE600;">{lead_obj.offer.title}</h3>
                                        <p style="color: #94A3B8; font-size: 0.85rem; margin: 0;">Budżet: <b>{lead_obj.offer.pricing_range}</b> | Opublikowano: <b>{lead_obj.offer.published_at.strftime('%Y-%m-%d %H:%M') if lead_obj.offer.published_at else '-'}</b></p>
                                    </div>
                                    <div>
                                        <a href="{offer_url}" target="_blank" style="background-color: #FFE600; color: #000; padding: 10px 18px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">👉 Otwórz Ofertę Online</a>
                                    </div>
                                </div>
                                <div style="margin-top: 14px; font-size: 0.85rem; color: #CBD5E1;">
                                    <b>Obserwacja przewodnia:</b> {lead_obj.offer.hero_observation}
                                </div>
                            </div>
                            """,
                            unsafe_allow_html=True,
                        )
                    else:
                        st.info("Ta firma nie posiada jeszcze wygenerowanej strony oferty.")
                        if st.button(f"⚡ Wygeneruj stronę oferty na Netlify dla {lead_obj.company_name}", type="primary"):
                            with st.spinner("Generowanie spersonalizowanej oferty (Gemini AI) i publikacja na Netlify..."):
                                gen = OfferGenerator()
                                deployer = NetlifyDeployer()
                                offer_content = gen.generate(lead_obj, lead_obj.audit)
                                safe_slug = slugify(f"{lead_obj.company_name}-{lead_obj.city or 'legnica'}")[:70]
                                html = render_offer_page(offer_content, lead_obj, safe_slug)
                                dep_res = deployer.deploy(html, safe_slug)

                                off = Offer(
                                    lead=lead_obj,
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
                                lead_obj.status = "offer_published"
                                session.commit()
                                st.success("Pomyślnie wygenerowano i opublikowano ofertę!")
                                st.rerun()

                    # ----------------- EMAIL OUTREACH SECTION -----------------
                    st.markdown("#### ✉️ Status Wysyłki E-mail z Ofertą")
                    email_msg = (
                        session.query(Message)
                        .filter(Message.lead_id == lead_obj.id, Message.direction == "outbound", Message.channel == "email")
                        .order_by(Message.id.desc())
                        .first()
                    )
                    if email_msg:
                        st.markdown(
                            f"""
                            <div class="pm-card" style="border-left: 4px solid #C084FC;">
                                <span class="pm-badge badge-sent">✉️ E-MAIL WYSŁANY ({email_msg.status.upper()})</span>
                                <h4 style="margin: 8px 0 4px 0; color: #F1F5F9;">{email_msg.subject}</h4>
                                <span style="font-size: 0.8rem; color: #94A3B8;">Odbiorca: <b>{lead_obj.email_primary or 'Kontakt firmowy'}</b> | Data: <b>{email_msg.sent_at.strftime('%Y-%m-%d %H:%M') if email_msg.sent_at else '-'}</b></span>
                            </div>
                            """,
                            unsafe_allow_html=True,
                        )
                        with st.expander("📄 Podgląd wysłanej treści wiadomości"):
                            st.text(email_msg.body_text)
                    else:
                        st.warning("E-mail z linkiem do oferty nie został jeszcze wysłany do tego leada.")
                        if lead_obj.offer:
                            if st.button(f"✉️ Wyślij e-mail z ofertą do {lead_obj.company_name}", type="primary"):
                                sender = SmtpSender()
                                offer_url = lead_obj.offer.deploy_url or lead_obj.offer.booking_url
                                draft = compose_outreach_email(lead=lead_obj, offer=lead_obj.offer, offer_url=offer_url)
                                res = sender.send_email(draft, lead_obj, session, ignore_window=True)
                                if res.success:
                                    lead_obj.status = "sent"
                                    session.commit()
                                    st.success(f"Wysłano e-mail do: {res.recipient} (Tryb testowy: {res.was_test_mode})")
                                    st.rerun()
                                else:
                                    st.error(f"Nie udało się wysłać: {res.error_message}")


# ================= TAB 3: AUTONOMOUS DECISION MATRIX =================
with tab_matrix:
    st.markdown("### 🤖 Autonomiczna Matryca Decyzyjna AI")
    st.caption("Lead Machine podejmuje samodzielne decyzje kwalifikacyjne, kierując do człowieka wyłącznie przypadki graniczne.")

    col_m1, col_m2, col_m3 = st.columns(3)
    with col_m1:
        st.markdown(
            """
            <div class="pm-card pm-card-highlight">
                <span class="pm-badge badge-auto-approved">🟢 AUTO-QUALIFIED</span>
                <h4 style="margin-top: 10px; color: #10B981;">Automatyczna Akceptacja</h4>
                <ul style="font-size: 0.84rem; color: #D1D5DB; line-height: 1.5; padding-left: 18px;">
                    <li><b>Branże priorytetowe:</b> Stomatologia, Medycyna, Kancelarie prawne, Biura rachunkowe, OZE/PV, B2B.</li>
                    <li><b>Próg scoringu:</b> Score ≥ 60 pkt (priorytet) lub ≥ 68 pkt (pozostałe).</li>
                    <li><b>Twarde haki automatyzacji:</b> Brak rezerwacji online wizyt (Booksy/Calendly), brak formularza, brak analityki GA4.</li>
                </ul>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with col_m2:
        st.markdown(
            """
            <div class="pm-card" style="border-color: rgba(245, 158, 11, 0.3);">
                <span class="pm-badge badge-needs-review">🟡 NEEDS REVIEW</span>
                <h4 style="margin-top: 10px; color: #F59E0B;">Weryfikacja Człowieka</h4>
                <ul style="font-size: 0.84rem; color: #D1D5DB; line-height: 1.5; padding-left: 18px;">
                    <li><b>Przypadki graniczne:</b> Wynik w strefie 48–67 pkt w branży ogólnej.</li>
                    <li><b>Brak jednoznacznego profilu:</b> Działalność nietypowa, brak pewności co do decydenta.</li>
                    <li><b>Cel:</b> 1 kliknięcie właściciela w panelu rozstrzyga kwalifikację.</li>
                </ul>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with col_m3:
        st.markdown(
            """
            <div class="pm-card" style="border-color: rgba(244, 63, 94, 0.3);">
                <span class="pm-badge badge-auto-rejected">🔴 AUTO-DISQUALIFIED</span>
                <h4 style="margin-top: 10px; color: #F43F5E;">Automatyczne Odrzucenie</h4>
                <ul style="font-size: 0.84rem; color: #D1D5DB; line-height: 1.5; padding-left: 18px;">
                    <li><b>Mikro-handel / „Sklep Pani Krysi”:</b> Warzywniaki, kioski, lumpeksy, lombardy, pasmanteria.</li>
                    <li><b>Trenerzy & fitness:</b> Trenerzy personalni, siłownie, sztuki walki, yoga.</li>
                    <li><b>Geografia:</b> Wrocław (bezwzględnie) lub promień > 30 km od Legnicy.</li>
                </ul>
            </div>
            """,
            unsafe_allow_html=True,
        )


# ================= TAB 4: HUMAN REVIEW QUEUE =================
with tab_review:
    st.markdown("### ⚖️ Kolejka do Weryfikacji (AI Uncertain Cases)")
    with get_db() as session:
        uncertain_leads = session.query(Lead).filter(Lead.status == "needs_review").order_by(Lead.score.desc()).all()
        if not uncertain_leads:
            st.success("🎉 Brak oczekujących spraw! Silnik AI podjął samodzielne decyzje dla wszystkich leadów.")
        else:
            st.info(f"Oczekuje **{len(uncertain_leads)}** spraw wymagających decyzji człowieka:")
            for ul in uncertain_leads:
                with st.expander(f"Lead #{ul.id}: {ul.company_name} | {ul.city} | Score: {ul.score}/100", expanded=True):
                    c_info, c_action = st.columns([3, 1])
                    with c_info:
                        st.markdown(f"#### **{ul.company_name}**")
                        st.write(f"Branża: **{ul.industry}** | Miasto: **{ul.city}** | Strona: [{ul.website}]({ul.website})")
                        if ul.rejection_reason:
                            st.warning(f"⚠️ **Powód weryfikacji:** {ul.rejection_reason}")
                    with c_action:
                        if st.button("🟢 Zatwierdź Lead", key=f"rev_acc_{ul.id}", type="primary", use_container_width=True):
                            ul.status = "qualified"
                            ul.rejection_reason = None
                            session.commit()
                            st.success(f"Zatwierdzono #{ul.id}!")
                            st.rerun()
                        if st.button("🔴 Odrzuć Lead", key=f"rev_rej_{ul.id}", use_container_width=True):
                            ul.status = "disqualified"
                            ul.rejection_reason = "Manualnie odrzucony przez człowieka w kolejce"
                            session.commit()
                            st.warning(f"Odrzucono #{ul.id}!")
                            st.rerun()


# ================= TAB 5: IMPORT & DATA TOOLS =================
with tab_import:
    st.markdown("### 📤 Wgraj Własne Leady do Maszyny")
    st.caption("Możesz wgrać plik ze scrapera lub wprowadzić nową firmę bezpośrednio przez formularz.")

    c_upl, c_form = st.columns([1, 1])

    with c_upl:
        st.markdown("#### 📁 Wgraj Plik Scrapera (CSV / JSON)")
        uploaded_file = st.file_uploader("Wybierz plik z leadami:", type=["csv", "json"])
        if uploaded_file:
            save_path = Path("data") / uploaded_file.name
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
                        is_dup, dup_r = is_duplicate(session, nip=norm_nip, phone_normalized=norm_phone, website=raw.website, company_name=raw.company_name, address=raw.address)

                        status, reason = ("disqualified", dup_r) if is_dup else (("disqualified", geo_res.rejection_reason) if not geo_res.is_allowed else ("new", None))
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

                st.success(f"Zakończono import! Dodano: {imported} leadów. Odrzucono z Wrocławia: {wroclaw_dropped}.")
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
                    st.success(f"Dodano firmę '{man_name}' do bazy! Uruchom pipeline, aby wygenerować ofertę i wysłać maila.")
                    st.rerun()


# ================= TRIGGER ACTIONS =================
if btn_full_pipeline:
    st.info("🚀 Uruchamianie pełnego autonomicznego pipeline'u Lead Machine...")
    orchestrator = PipelineOrchestrator()
    with get_db() as session:
        report = orchestrator.run_full_cycle(session, ignore_window=True)

    st.success(
        f"✅ Zakończono pełny cykl! Wzbogacone: {report.enriched_count} | Zaudytowane: {report.audited_count} | "
        f"Zakwalifikowane: {report.auto_qualified_count} | Oferty Netlify: {report.offers_deployed_count} | Wysłane E-maile: {report.emails_sent_count}"
    )
    if report.errors:
        st.warning(f"Zarejestrowano {len(report.errors)} uwag/błędów (np. sandbox mode).")
    st.rerun()

if btn_enrich:
    reg_client = RegistryClient()
    updated = 0
    with get_db() as session:
        leads_to_enrich = session.query(Lead).filter(Lead.status.in_(["new", "qualified", "needs_review"])).all()
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
    st.success(f"Zaktualizowano dane dla {updated} leadów!")
    st.rerun()

if btn_audit:
    auditor = WebAuditor()
    audited_count = 0
    with get_db() as session:
        leads_to_audit = session.query(Lead).filter(Lead.website.isnot(None)).all()
        for lead in leads_to_audit:
            audit_res = auditor.audit_url(lead.website)
            if not lead.audit:
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
    st.success(f"Przeprowadzono audyt WWW dla {audited_count} witryn!")
    st.rerun()

if btn_qualify:
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
    st.success("Zakończono kwalifikację autonomiczną!")
    st.rerun()

if btn_offers:
    gen = OfferGenerator()
    deployer = NetlifyDeployer()
    count = 0
    with get_db() as session:
        leads_for_off = session.query(Lead).filter(Lead.status.in_(["qualified", "offer_draft", "offer_published"])).all()
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
                lead.offer.booking_url = dep_res.url
                lead.offer.deploy_url = dep_res.url
                lead.offer.status = "published"
            lead.status = "offer_published"
            count += 1
        session.commit()
    st.success(f"Wygenerowano i opublikowano {count} spersonalizowanych stron ofertowych na Netlify!")
    st.rerun()

if btn_emails:
    sender = SmtpSender()
    sent_cnt = 0
    with get_db() as session:
        leads_for_em = session.query(Lead).filter(Lead.status == "offer_published").all()
        for lead in leads_for_em:
            if lead.offer:
                draft = compose_outreach_email(lead=lead, offer=lead.offer, offer_url=lead.offer.deploy_url or lead.offer.booking_url)
                res = sender.send_email(draft, lead, session, ignore_window=True)
                if res.success:
                    lead.status = "sent"
                    sent_cnt += 1
        session.commit()
    st.success(f"Wysłano {sent_cnt} spersonalizowanych e-maili z linkiem do oferty!")
    st.rerun()
