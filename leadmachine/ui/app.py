"""Streamlit web dashboard for Lead Machine (Procent Marketing).

World-Class Agency Showcase UI, Cloudflare Tunnel ready, real-time autonomous decision engine.
"""

from pathlib import Path

import pandas as pd
import streamlit as st

from leadmachine.audit.web_auditor import WebAuditor
from leadmachine.config import get_settings
from leadmachine.db.models import Audit, Contact, Lead
from leadmachine.db.session import get_db, init_db
from leadmachine.enrichment.registry_client import RegistryClient
from leadmachine.exporter.excel_exporter import export_leads_to_excel
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
        padding: 18px 22px;
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
        font-size: 0.8rem !important;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }

    [data-testid="stMetricValue"] {
        color: #FFFFFF !important;
        font-family: 'Plus Jakarta Sans', sans-serif !important;
        font-weight: 800 !important;
        font-size: 2.2rem !important;
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

    /* Feature tags */
    .tech-pill {
        display: inline-block;
        padding: 3px 9px;
        border-radius: 6px;
        font-size: 0.73rem;
        background: #1C212E;
        color: #D1D5DB;
        border: 1px solid #2B3244;
        margin-right: 6px;
        margin-bottom: 6px;
    }

    .tech-pill-active {
        background: rgba(16, 185, 129, 0.15);
        color: #34D399;
        border: 1px solid rgba(16, 185, 129, 0.35);
        font-weight: 600;
    }

    .tech-pill-alert {
        background: rgba(245, 158, 11, 0.15);
        color: #FBBF24;
        border: 1px solid rgba(245, 158, 11, 0.35);
        font-weight: 600;
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
    """Loads active leads from database, strictly excluding Wrocław."""
    init_db()
    with get_db() as session:
        leads = (
            session.query(Lead)
            .filter(
                ~Lead.city.ilike("%wroc%"),
                ~Lead.address.ilike("%wroc%"),
                ~Lead.rejection_reason.ilike("%wroc%"),
            )
            .order_by(Lead.score.desc(), Lead.id.asc())
            .all()
        )
        data = []
        for lead in leads:
            score_data = lead.score_breakdown or {}
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
                <span style="font-size: 0.8rem; color: #9CA3AF;">Autonomiczny Silnik B2B Legnica + 30 km • Wrocław bezwzględnie wykluczony</span>
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
            <div style="font-size: 0.72rem; color: #8F97A3; margin-top: 3px;">Auto-Akceptacja & Odrzucanie</div>
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
        <span style="font-weight: 800; color: #FFE600; font-size: 0.95rem; font-family: 'Plus Jakarta Sans', sans-serif;">PANEL DOWODZENIA</span><br/>
        <span style="font-size: 0.76rem; color: #8F97A3;">Zarządzanie pipeline'em i silnikiem AI</span>
    </div>
    """,
    unsafe_allow_html=True,
)

if st.sidebar.button("🔄 Odśwież dane z bazy", use_container_width=True):
    st.rerun()

if st.sidebar.button("📥 Pobierz arkusz leads.xlsx", use_container_width=True):
    if raw_leads_objects:
        saved_path = export_leads_to_excel(raw_leads_objects, Path("leads.xlsx"))
        st.sidebar.success(f"Wyeksportowano {len(raw_leads_objects)} leadów do {saved_path.name}")
    else:
        st.sidebar.warning("Brak leadów w bazie.")

st.sidebar.markdown("### ⚡ Pętla Automatyzacji")
btn_full_pipeline = st.sidebar.button(
    "🚀 Pełny Cykl Autonomiczny (Rejestry + Audyt + Scoring)", type="primary", use_container_width=True
)
btn_enrich = st.sidebar.button("1. Weryfikacja CEIDG / KRS", use_container_width=True)
btn_audit = st.sidebar.button("2. Mini-audyt stron WWW", use_container_width=True)
btn_qualify = st.sidebar.button("3. Autonomiczna Kwalifikacja & Matrix", use_container_width=True)

st.sidebar.markdown("---")
st.sidebar.markdown(
    """
    <div style="background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.3); border-radius: 8px; padding: 12px;">
        <span style="color: #38BDF8; font-weight: 700; font-size: 0.8rem;">🌐 Cloudflare Tunnel Status:</span><br/>
        <span style="font-size: 0.75rem; color: #94A3B8; line-height: 1.4;">
            Wystaw ten panel natychmiast do internetu:<br/>
            <code style="color: #FFE600;">./run_cloudflare_tunnel.sh</code>
        </span>
    </div>
    """,
    unsafe_allow_html=True,
)

# ----------------- MAIN TABS -----------------
tab_dash, tab_matrix, tab_review, tab_explorer, tab_import = st.tabs(
    [
        "📊 Pulpit Operacyjny & Lejek",
        "🤖 Centrum Decyzji Autonomicznej",
        "⚖️ Kolejka do Weryfikacji (AI Uncertain)",
        "📋 Pipeline CRM & Karta Leada",
        "📤 Import & Narzędzia Danych",
    ]
)

# ================= TAB 1: EXECUTIVE DASHBOARD & FUNNEL =================
with tab_dash:
    if df.empty:
        st.info("Baza danych jest pusta. Zaimportuj plik scrapera w zakładce 'Import & Narzędzia Danych'.")
    else:
        # Key Metrics Row
        col1, col2, col3, col4, col5 = st.columns(5)
        total_leads = len(df)
        auto_approved = len(df[df["status"] == "qualified"])
        needs_review = len(df[df["status"] == "needs_review"])
        auto_rejected = len(df[df["status"] == "disqualified"])
        dental_leads = len(df[df["industry"].str.contains("dentyst|stomatolog|medycyn|lekar", case=False, na=False)])
        avg_score = int(df[df["status"] == "qualified"]["score"].mean()) if auto_approved > 0 else 0

        col1.metric("Wszystkie Leady", total_leads)
        col2.metric(
            "Auto-Zaakceptowane",
            auto_approved,
            f"{int(auto_approved / total_leads * 100)}% bazy" if total_leads else "",
        )
        col3.metric(
            "Wymaga Akceptacji",
            needs_review,
            f"{int(needs_review / total_leads * 100)}% niepewne" if total_leads else "0%",
        )
        col4.metric(
            "Auto-Odrzucone",
            auto_rejected,
            f"{int(auto_rejected / total_leads * 100)}%" if total_leads else "",
        )
        col5.metric("Stomatologia / Medycyna", dental_leads, "Top Priorytet")

        st.markdown("<br/>", unsafe_allow_html=True)

        c_funnel1, c_funnel2 = st.columns([3, 2])

        with c_funnel1:
            st.markdown("#### 📈 Rozkład Stanów w Maszynie Leada")
            status_df = df["status"].value_counts().reset_index()
            status_df.columns = ["Status", "Liczba"]
            st.bar_chart(status_df.set_index("Status"), color="#FFE600", height=280)

        with c_funnel2:
            st.markdown("#### 🎯 Branże Zakwalifikowane (Wysoki Potencjał Automatyzacji)")
            q_industries = df[df["status"] == "qualified"]["industry"].value_counts().reset_index()
            q_industries.columns = ["Branża", "Liczba Leadów"]
            st.dataframe(q_industries, use_container_width=True, hide_index=True)

        if auto_rejected > 0:
            st.markdown("#### 🛑 Zarejestrowane Przyczyny Autonomicznego Odrzucenia")
            rej_df = (
                df[df["status"] == "disqualified"]["rejection_reason"].value_counts().reset_index()
            )
            rej_df.columns = ["Powód Odrzucenia (Brak Automatyzacji / Limit Geo)", "Liczba"]
            st.dataframe(rej_df, use_container_width=True, hide_index=True)


# ================= TAB 2: AUTONOMOUS DECISION MATRIX & SIMULATOR =================
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
                    <li><b>Kanał:</b> Zweryfikowany telefon lub e-mail firmowy.</li>
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
                    <li><b>Brak witryny www:</b> Firma posiada telefon/rejestr, ale brak danych audytowych.</li>
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
                    <li><b>Mikro-handel / „Sklep Pani Krysi”:</b> Warzywniaki, kioski, lumpeksy, lombardy, pasmanteria (zerowy budżet B2B).</li>
                    <li><b>Trenerzy & fitness:</b> Trenerzy personalni, siłownie, sztuki walki, yoga (zgodnie z wytycznymi).</li>
                    <li><b>Geografia:</b> Wrocław (bezwzględnie) lub promień > 30 km od Legnicy.</li>
                    <li><b>Niski score:</b> Poniżej 48 pkt (brak szans na ROI).</li>
                </ul>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown("---")
    st.markdown("#### 🧪 Interaktywny Symulator Decyzji AI (Live Sandbox)")
    st.caption("Przetestuj dowolną firmę na żywo, aby zobaczyć, jak zareaguje silnik decyzyjny.")

    sim_c1, sim_c2, sim_c3 = st.columns(3)
    with sim_c1:
        sim_name = st.text_input("Nazwa firmy do testu:", value="Klinika Stomatologii Dr Nowak")
        sim_city = st.text_input("Miasto:", value="Legnica")
    with sim_c2:
        sim_industry = st.selectbox(
            "Branża:",
            options=[
                "Stomatologia / Gabinet dentystyczny",
                "Biuro rachunkowe / Księgowość",
                "Kancelaria prawna / Adwokat",
                "Instalacje Fotowoltaika / Pompy ciepła",
                "Trener personalny / Fitness",
                "Sklep spożywczy / Handel detaliczny",
                "Inne usługi B2B",
            ],
        )
        sim_dist = st.number_input("Odległość od Rynku w Legnicy (km):", min_value=0.0, max_value=80.0, value=2.5)
    with sim_c3:
        sim_has_booking = st.checkbox("Posiada rezerwację online wizyt (np. Booksy)", value=False)
        sim_has_form = st.checkbox("Posiada nowoczesny formularz WWW", value=False)
        sim_reviews = st.number_input("Liczba opinii w Google Maps:", min_value=0, max_value=500, value=65)

    if st.button("⚡ Uruchom symulację decyzyjną", type="primary"):
        sim_lead = Lead(
            company_name=sim_name,
            industry=sim_industry,
            city=sim_city,
            distance_km=sim_dist,
            phone_normalized="+48768000000",
            email_primary="biuro@symulacja.pl",
            owner_confidence="high",
        )
        sim_audit = Audit(
            ssl_valid=True,
            is_responsive=True,
            has_online_booking=sim_has_booking,
            has_contact_form=sim_has_form,
            google_reviews_count=sim_reviews,
            copyright_year=2021,
        )
        q_engine = LeadQualifier()
        sim_res = q_engine.qualify_lead(sim_lead, sim_audit)

        st.markdown("<br/>", unsafe_allow_html=True)
        res_col1, res_col2 = st.columns([1, 2])
        with res_col1:
            if sim_res.decision == LeadDecision.AUTO_QUALIFIED:
                st.markdown('<span class="pm-badge badge-auto-approved" style="font-size: 1rem;">🟢 AUTO-QUALIFIED</span>', unsafe_allow_html=True)
            elif sim_res.decision == LeadDecision.NEEDS_REVIEW:
                st.markdown('<span class="pm-badge badge-needs-review" style="font-size: 1rem;">🟡 NEEDS REVIEW</span>', unsafe_allow_html=True)
            else:
                st.markdown('<span class="pm-badge badge-auto-rejected" style="font-size: 1rem;">🔴 AUTO-DISQUALIFIED</span>', unsafe_allow_html=True)
            st.metric("Wyliczony Total Score", f"{sim_res.total_score}/100")
            st.caption(f"Pewność algorytmu: **{sim_res.confidence.upper()}**")

        with res_col2:
            st.markdown("##### 🔍 Uzasadnienie i Kąty Automatyzacji:")
            if sim_res.rejection_reason:
                st.error(f"Powód odrzucenia: {sim_res.rejection_reason}")
            if sim_res.review_reason:
                st.warning(f"Powód weryfikacji: {sim_res.review_reason}")
            if sim_res.automation_fit_reasons:
                for angle in sim_res.automation_fit_reasons:
                    st.markdown(f"• **{angle}**")


# ================= TAB 3: HUMAN REVIEW QUEUE =================
with tab_review:
    st.markdown("### ⚖️ Kolejka do Weryfikacji (AI Uncertain Cases)")
    st.caption("Przypadki niejednoznaczne, gdzie algorytm nie podjął automatycznej decyzji ze 100% pewnością.")

    with get_db() as session:
        uncertain_leads = (
            session.query(Lead)
            .filter(Lead.status.in_(["needs_review", "offer_draft"]))
            .order_by(Lead.score.desc())
            .all()
        )

        if not uncertain_leads:
            st.success("🎉 Brak oczekujących spraw! Silnik AI zakwalifikował lub odrzucił wszystkie bieżące leady.")
        else:
            st.info(f"Oczekuje **{len(uncertain_leads)}** spraw wymagających Twojego spojrzenia.")

            for ul in uncertain_leads:
                with st.expander(
                    f"Lead #{ul.id}: {ul.company_name} | {ul.city} | Score: {ul.score}/100",
                    expanded=True,
                ):
                    c_info, c_action = st.columns([3, 1])

                    with c_info:
                        st.markdown(f"#### **{ul.company_name}**")
                        st.markdown(
                            f"""
                            📍 **Miasto**: {ul.city} ({ul.distance_km:.1f} km od Legnicy) | 🏢 **Branża**: `{ul.industry}`<br/>
                            📞 **Telefon**: `{ul.phone_normalized or 'Brak'}` | ✉️ **Email**: `{ul.email_primary or 'Brak'}`<br/>
                            🌐 **WWW**: [{ul.website}]({ul.website})
                            """,
                            unsafe_allow_html=True,
                        )
                        if ul.rejection_reason:
                            st.warning(f"⚠️ **Dlaczego AI pyta człowieka?**: {ul.rejection_reason}")

                    with c_action:
                        st.markdown("<br/>", unsafe_allow_html=True)
                        if st.button("🟢 Zatwierdź Lead", key=f"rev_acc_{ul.id}", type="primary", use_container_width=True):
                            ul.status = "qualified"
                            ul.rejection_reason = None
                            session.commit()
                            st.success(f"Zatwierdzono #{ul.id}!")
                            st.rerun()

                        if st.button("🔴 Odrzuć Lead", key=f"rev_rej_{ul.id}", use_container_width=True):
                            ul.status = "disqualified"
                            ul.rejection_reason = "Manualnie odrzucony przez człowieka w kolejce niepewnych"
                            session.commit()
                            st.warning(f"Odrzucono #{ul.id}!")
                            st.rerun()


# ================= TAB 4: PIPELINE CRM & LEAD DOSSIER =================
with tab_explorer:
    if df.empty:
        st.info("Brak leadów do wyświetlenia.")
    else:
        # Filter Row
        f_search, f_status, f_city = st.columns([2, 1, 1])
        with f_search:
            search_query = st.text_input("🔍 Szukaj firmy po nazwie, branży lub telefonie:")
        with f_status:
            status_filter = st.multiselect(
                "Status leada:",
                options=df["status"].unique().tolist(),
                default=df["status"].unique().tolist(),
            )
        with f_city:
            city_options = ["Wszystkie"] + sorted(
                [c for c in df["city"].dropna().unique().tolist() if c]
            )
            city_filter = st.selectbox("Miasto (≤30km od Legnicy):", options=city_options)

        # Filter DF
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
                    "owner_confidence",
                    "phone",
                    "website",
                ]
            ],
            use_container_width=True,
            hide_index=True,
        )

        st.markdown("---")
        st.markdown("### 🔬 Karta Leada & Twarde Dowody Audytowe")
        selected_id = st.selectbox(
            "Wybierz ID leada do zbadania szczegółów:", options=filtered["id"].tolist()
        )

        if selected_id:
            with get_db() as session:
                lead_obj = session.query(Lead).filter(Lead.id == selected_id).first()
                if lead_obj:
                    c_lead_info, c_score_box = st.columns([3, 2])

                    with c_lead_info:
                        st.markdown(f"## **{lead_obj.company_name}**")
                        st.markdown(
                            f"""
                            📍 **Lokalizacja**: {lead_obj.address or "Brak"}, **{lead_obj.city or "Legnica"}** ({lead_obj.distance_km:.1f} km od Rynku w Legnicy)<br/>
                            📞 **Telefon**: `{lead_obj.phone_normalized or "Brak"}` | ✉️ **Email**: `{lead_obj.email_primary or "Brak"}`<br/>
                            🌐 **Strona WWW**: [{lead_obj.website}]({lead_obj.website})<br/>
                            🏛️ **NIP**: `{lead_obj.nip or "Brak"}` | **KRS**: `{lead_obj.krs or "Brak"}` | **Branża**: `{lead_obj.industry}`
                            """,
                            unsafe_allow_html=True,
                        )

                    with c_score_box:
                        if lead_obj.status == "qualified":
                            st.markdown('<span class="pm-badge badge-auto-approved">🟢 AUTO-QUALIFIED</span>', unsafe_allow_html=True)
                        elif lead_obj.status == "needs_review":
                            st.markdown('<span class="pm-badge badge-needs-review">🟡 NEEDS REVIEW</span>', unsafe_allow_html=True)
                        else:
                            st.markdown('<span class="pm-badge badge-auto-rejected">🔴 DISQUALIFIED</span>', unsafe_allow_html=True)

                        st.progress(min(100, lead_obj.score) / 100)
                        st.markdown(
                            f"<div style='font-size: 2rem; font-weight: 800; color: #FFE600;'>{lead_obj.score} / 100 pkt</div>",
                            unsafe_allow_html=True,
                        )
                        st.markdown(f"Pewność decydenta: <b>`{lead_obj.owner_confidence or 'brak'}`</b>", unsafe_allow_html=True)
                        if lead_obj.contacts:
                            st.write(
                                f"Główny kontakt: **{lead_obj.contacts[0].first_name or ''}** ({lead_obj.contacts[0].role or 'Decydent'})"
                            )

                    # Automation Angles
                    score_info = lead_obj.score_breakdown or {}
                    angles = score_info.get("automation_fit_reasons", [])
                    if angles:
                        st.markdown("#### 🎯 Zidentyfikowane Kąty Sprzedażowe Automatyzacji:")
                        for a_idx, ang in enumerate(angles, start=1):
                            st.markdown(f"**{a_idx}.** {ang}")

                    # Detailed Audit Signals & Grounded Evidence
                    if lead_obj.audit:
                        st.markdown("#### 📊 Obserwacje z Audytu Marketingowego (Zasada Twardych Dowodów)")

                        col_s1, col_s2, col_s3, col_s4 = st.columns(4)
                        col_s1.metric(
                            "Certyfikat SSL",
                            "TAK (HTTPS)" if lead_obj.audit.ssl_valid else "BRAK / BŁĄD",
                        )
                        col_s2.metric(
                            "Responsywność Mobile", "TAK" if lead_obj.audit.is_responsive else "NIE"
                        )
                        col_s3.metric("System CMS", lead_obj.audit.cms_detected or "Nieznany")
                        col_s4.metric(
                            "Opinie Google",
                            f"{lead_obj.audit.google_rating or 0}★ ({lead_obj.audit.google_reviews_count or 0})",
                        )

                        col_t1, col_t2, col_t3, col_t4 = st.columns(4)
                        col_t1.metric(
                            "Google Analytics 4", "WYKRYTO" if lead_obj.audit.has_ga4 else "BRAK"
                        )
                        col_t2.metric(
                            "Meta Pixel", "AKTYWNY" if lead_obj.audit.has_meta_pixel else "BRAK"
                        )
                        col_t3.metric(
                            "Formularz WWW", "JEST" if lead_obj.audit.has_contact_form else "BRAK"
                        )
                        col_t4.metric(
                            "Rezerwacja Online",
                            "JEST" if lead_obj.audit.has_online_booking else "BRAK",
                        )

                        if lead_obj.audit.raw_evidence:
                            with st.expander("🔍 Przejrzyj twarde dowody z kodu strony (Raw Grounded Evidence)"):
                                st.json(lead_obj.audit.raw_evidence)


# ================= TAB 5: IMPORT & DATA TOOLS =================
with tab_import:
    st.markdown("### 📤 Import Leadów ze Scrapera (CSV / JSON)")
    st.caption("Plik zostanie przefiltrowany przez filtr Legnicy (promień 30 km), deduplikator i bezwzględną blokadę Wrocławia.")

    uploaded_file = st.file_uploader("Wybierz plik scrapera:", type=["csv", "json"])
    if uploaded_file:
        save_path = Path("data") / uploaded_file.name
        with open(save_path, "wb") as f:
            f.write(uploaded_file.getbuffer())
        st.success(f"Wgrano plik: `{save_path}`")

        c_prev, c_run = st.columns(2)
        with c_prev:
            if st.button("Podgląd rekordów (bez zapisu)", use_container_width=True):
                from leadmachine.adapters.scraper_adapter import ScraperAdapter

                raw_items = ScraperAdapter.load_from_file(save_path)
                st.write(f"Wczytano {len(raw_items)} wierszy. Przykładowe firmy:")
                st.write([r.company_name for r in raw_items[:5]])

        with c_run:
            if st.button("Importuj do Bazy i Wyklucz Wrocław", type="primary", use_container_width=True):
                from leadmachine.adapters.scraper_adapter import ScraperAdapter
                from leadmachine.core.dedup import is_duplicate, normalize_nip, normalize_phone_e164
                from leadmachine.core.geo import validate_geo

                raw_items = ScraperAdapter.load_from_file(save_path)
                imported = 0
                wroclaw_dropped = 0

                with get_db() as session:
                    for raw in raw_items:
                        geo_res = validate_geo(
                            city=raw.city,
                            address=raw.address,
                            latitude=raw.latitude,
                            longitude=raw.longitude,
                        )
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

                        if is_dup:
                            status, reason = "disqualified", dup_r
                        elif not geo_res.is_allowed:
                            status, reason = "disqualified", geo_res.rejection_reason
                        else:
                            status, reason = "new", None
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

                st.success(
                    f"Zakończono import! Zaakceptowano: {imported} leadów. Odrzucono i pominięto z Wrocławia: {wroclaw_dropped}."
                )
                st.rerun()


# ================= TRIGGER ACTIONS =================
if btn_full_pipeline:
    st.info("Uruchamianie pełnego cyklu (Weryfikacja rejestrów + Audyt WWW + Matryca Autonomiczna)...")
    reg_client = RegistryClient()
    auditor = WebAuditor()
    qualifier = LeadQualifier()

    with get_db() as session:
        leads_to_process = (
            session.query(Lead)
            .filter(
                ~Lead.city.ilike("%wroc%"),
                ~Lead.address.ilike("%wroc%"),
                ~Lead.rejection_reason.ilike("%wroc%"),
            )
            .all()
        )
        for lead in leads_to_process:
            # 1. Enrichment
            res = reg_client.lookup(nip=lead.nip, krs=lead.krs, company_name=lead.company_name)
            if res and res.owner_name:
                lead.owner_confidence = res.owner_confidence
                if not lead.contacts:
                    c = Contact(
                        lead=lead,
                        first_name=res.owner_name,
                        role=res.owner_role,
                        is_primary=True,
                        source=res.source,
                    )
                    session.add(c)
                else:
                    lead.contacts[0].first_name = res.owner_name
                    lead.contacts[0].role = res.owner_role

            # 2. Audit
            if lead.website:
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

            # 3. Qualify with Autonomous Decision Matrix
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
    st.success("Pomyślnie ukończono pełny cykl autonomicznego przetwarzania!")
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
                    c = Contact(
                        lead=lead,
                        first_name=res.owner_name,
                        role=res.owner_role,
                        is_primary=True,
                        source=res.source,
                    )
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
