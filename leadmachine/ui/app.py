"""Streamlit web dashboard for Lead Machine (Procent Marketing).

Cloudflare-ready, modern dark-themed interactive UI with real-time lead state management.
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
from leadmachine.qualification.qualifier import LeadQualifier

# Page setup
st.set_page_config(
    page_title="Lead Machine | Procent Marketing",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom High-End Styling (Procent Marketing Dark Theme)
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');

    html, body, [class*="css"] {
        font-family: 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    h1, h2, h3, h4, h5, h6, .brand-font {
        font-family: 'Plus Jakarta Sans', sans-serif !important;
        letter-spacing: -0.02em;
    }

    /* Backgrounds & Containers */
    .stApp {
        background-color: #0E1015;
        color: #F0F2F5;
    }

    /* Metric Cards */
    [data-testid="stMetric"] {
        background: linear-gradient(145deg, #181B22 0%, #12141A 100%);
        border: 1px solid #282C37;
        border-radius: 12px;
        padding: 16px 20px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
        transition: transform 0.15s ease, border-color 0.15s ease;
    }

    [data-testid="stMetric"]:hover {
        border-color: #FFE600;
        transform: translateY(-2px);
    }

    [data-testid="stMetricLabel"] {
        color: #9BA3AF !important;
        font-size: 0.85rem !important;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    [data-testid="stMetricValue"] {
        color: #FFE600 !important;
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
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .badge-qualified { background: rgba(74, 222, 128, 0.15); color: #4ADE80; border: 1px solid rgba(74, 222, 128, 0.3); }
    .badge-disqualified { background: rgba(248, 113, 113, 0.15); color: #F87171; border: 1px solid rgba(248, 113, 113, 0.3); }
    .badge-new { background: rgba(250, 204, 21, 0.15); color: #FACC15; border: 1px solid rgba(250, 204, 21, 0.3); }
    .badge-audited { background: rgba(96, 165, 250, 0.15); color: #60A5FA; border: 1px solid rgba(96, 165, 250, 0.3); }
    .badge-offer { background: rgba(192, 132, 252, 0.15); color: #C084FC; border: 1px solid rgba(192, 132, 252, 0.3); }
    .badge-sent { background: rgba(45, 212, 191, 0.15); color: #2DD4BF; border: 1px solid rgba(45, 212, 191, 0.3); }

    .tag-pill {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 0.72rem;
        background: #252833;
        color: #D1D5DB;
        border: 1px solid #373C4B;
    }

    .tag-pill-active {
        background: rgba(255, 230, 0, 0.15);
        color: #FFE600;
        border: 1px solid rgba(255, 230, 0, 0.4);
        font-weight: 600;
    }

    /* Header Accent */
    .hero-glow {
        text-shadow: 0 0 24px rgba(255, 230, 0, 0.35);
        color: #FFE600;
    }

    .card-panel {
        background: #181B22;
        border: 1px solid #282C37;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
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
                    "has_audit": lead.audit is not None,
                    "created_at": lead.created_at,
                }
            )
        return data, leads


settings = get_settings()
stop_file_exists = Path(settings.kill_switch_file).exists()

# ----------------- TOP BAR & STATUS HEADER -----------------
col_logo, col_mode, col_kill = st.columns([3, 1, 1])

with col_logo:
    st.markdown(
        """
        <div style="display: flex; align-items: center; gap: 14px;">
            <div style="background: #FFE600; color: #000; font-weight: 900; font-size: 1.4rem; padding: 6px 12px; border-radius: 8px;">%</div>
            <div>
                <h2 style="margin: 0; padding: 0; line-height: 1.1;" class="brand-font">PROCENT MARKETING <span class="hero-glow">LEAD MACHINE</span></h2>
                <span style="font-size: 0.82rem; color: #9CA3AF;">System automatyzacji B2B Legnica + 30 km (Wrocław wykluczony)</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

with col_mode:
    if settings.live_mode:
        st.markdown(
            '<div style="text-align: right;"><span class="pm-badge badge-disqualified">🔴 LIVE PRODUKCJA</span></div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<div style="text-align: right;"><span class="pm-badge badge-qualified">🟢 SANDBOX TESTOWY</span></div>',
            unsafe_allow_html=True,
        )
    st.markdown(
        f'<div style="text-align: right; font-size: 0.75rem; color: #9CA3AF; margin-top: 4px;">Akceptacja: <b>{settings.approval_mode}</b></div>',
        unsafe_allow_html=True,
    )

with col_kill:
    if stop_file_exists:
        st.markdown(
            '<div style="text-align: right;"><span class="pm-badge badge-disqualified">🚨 STOP (WYSYŁKA ZABLOKOWANA)</span></div>',
            unsafe_allow_html=True,
        )
        if st.button("Odblokuj System", type="primary", use_container_width=True):
            Path(settings.kill_switch_file).unlink(missing_ok=True)
            st.rerun()
    else:
        st.markdown(
            '<div style="text-align: right;"><span class="pm-badge badge-qualified">🛡️ BEZPIECZNIK AKTYWNY</span></div>',
            unsafe_allow_html=True,
        )
        if st.button("Aktywuj STOP (Kill-Switch)", use_container_width=True):
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
        <span style="font-weight: 700; color: #FFE600; font-size: 0.95rem;">CENTRUM OPERACYJNE</span><br/>
        <span style="font-size: 0.78rem; color: #8F97A3;">Zarządzanie pipeline'em i eksportem</span>
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

st.sidebar.markdown("### ⚡ Automatyzacja")
btn_full_pipeline = st.sidebar.button(
    "🚀 Uruchom pełny cykl (Rejestry + Audyt + Scoring)", type="primary", use_container_width=True
)
btn_enrich = st.sidebar.button("1. Sprawdź CEIDG / KRS", use_container_width=True)
btn_audit = st.sidebar.button("2. Przeprowadź audyt WWW", use_container_width=True)
btn_qualify = st.sidebar.button("3. Przelicz kwalifikację & score", use_container_width=True)

st.sidebar.markdown("---")
st.sidebar.markdown(
    """
    <div style="font-size: 0.8rem; color: #9CA3AF; line-height: 1.4;">
        <b>🌐 Cloudflare Status:</b><br/>
        Wystaw ten panel online poleceniem:<br/>
        <code>cloudflared tunnel --url http://localhost:8501</code>
    </div>
    """,
    unsafe_allow_html=True,
)

# ----------------- MAIN TABS -----------------
tab_funnel, tab_explorer, tab_approval, tab_import = st.tabs(
    [
        "📊 Lejek i Stan Pipeline'u",
        "📋 Eksplorator Leadów & Audyt",
        "⚖️ Kolejka Akceptacji Ofert",
        "📤 Import Nowych Leadów (CSV/JSON)",
    ]
)

# ================= TAB 1: FUNNEL & STATS =================
with tab_funnel:
    if df.empty:
        st.info(
            "Baza danych jest pusta. Zaimportuj plik scrapera w zakładce 'Import Nowych Leadów'."
        )
    else:
        # Key Metrics Row
        col1, col2, col3, col4, col5 = st.columns(5)
        total_leads = len(df)
        qualified_leads = len(df[df["status"] == "qualified"])
        audited_leads = len(df[df["has_audit"]])
        disqualified_leads = len(df[df["status"] == "disqualified"])
        avg_score = (
            int(df[df["status"] == "qualified"]["score"].mean()) if qualified_leads > 0 else 0
        )

        col1.metric("Wszystkie Leady", total_leads)
        col2.metric(
            "Zakwalifikowane",
            qualified_leads,
            f"{int(qualified_leads / total_leads * 100)}%" if total_leads else "",
        )
        col3.metric("Zaudytowane WWW", audited_leads)
        col4.metric("Odrzucone", disqualified_leads)
        col5.metric("Średni Score (Kwalif.)", f"{avg_score}/100")

        st.markdown("<br/>", unsafe_allow_html=True)
        c_chart1, c_chart2 = st.columns([3, 2])

        with c_chart1:
            st.markdown("#### 📈 Rozkład Stanów w Maszynie Leada")
            status_df = df["status"].value_counts().reset_index()
            status_df.columns = ["Status", "Liczba"]
            st.bar_chart(status_df.set_index("Status"), color="#FFE600", height=260)

        with c_chart2:
            st.markdown("#### 🎯 Branże Zakwalifikowane")
            q_industries = df[df["status"] == "qualified"]["industry"].value_counts().reset_index()
            q_industries.columns = ["Branża", "Liczba"]
            st.dataframe(q_industries, use_container_width=True, hide_index=True)

        if disqualified_leads > 0:
            st.markdown("#### 🛑 Zarejestrowane Przyczyny Odrzucenia")
            rej_df = (
                df[df["status"] == "disqualified"]["rejection_reason"].value_counts().reset_index()
            )
            rej_df.columns = ["Przyczyna Odrzucenia", "Liczba Leadów"]
            st.dataframe(rej_df, use_container_width=True, hide_index=True)


# ================= TAB 2: EXPLORER & AUDIT DETECTOR =================
with tab_explorer:
    if df.empty:
        st.info("Brak leadów do wyświetlenia.")
    else:
        # Search & Filter Row
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

        st.caption(f"Znaleziono **{len(filtered)}** leadów spełniających kryteria:")

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
        st.markdown("### 🔬 Inspektor Techniczny i Karta Leada")
        selected_id = st.selectbox(
            "Wybierz ID leada do zbadania faktów:", options=filtered["id"].tolist()
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
                        st.markdown(f"#### Status: `{lead_obj.status.upper()}`")
                        st.progress(min(100, lead_obj.score) / 100)
                        st.markdown(
                            f"<div style='font-size: 1.8rem; font-weight: 800; color: #FFE600;'>{lead_obj.score} / 100 pkt</div>",
                            unsafe_allow_html=True,
                        )
                        st.markdown(
                            f"Pewność decydenta: <b>`{lead_obj.owner_confidence or 'brak'}`</b>",
                            unsafe_allow_html=True,
                        )
                        if lead_obj.contacts:
                            st.write(
                                f"Główny kontakt: **{lead_obj.contacts[0].first_name or ''}** ({lead_obj.contacts[0].role or 'Decydent'})"
                            )

                    # Detailed Audit Signals & Grounded Evidence
                    if lead_obj.audit:
                        st.markdown(
                            "#### 📊 Obserwacje z Audytu Marketingowego (Zasada Twardych Dowodów)"
                        )

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
                            with st.expander(
                                "🔍 Przejrzyj twarde dowody z kodu strony (Raw Evidence)"
                            ):
                                st.json(lead_obj.audit.raw_evidence)

                    if lead_obj.score_breakdown and isinstance(lead_obj.score_breakdown, dict):
                        with st.expander("📈 Szczegółowe podsumowanie składowych scoringu"):
                            st.json(lead_obj.score_breakdown)


# ================= TAB 3: APPROVAL QUEUE =================
with tab_approval:
    st.markdown("### ⚖️ Kolejka Akceptacji Człowieka (`approval_mode=all`)")
    st.caption("Każda wygenerowana oferta wymaga zatwierdzenia przed zakolejkowaniem do wysyłki.")

    with get_db() as session:
        pending_leads = (
            session.query(Lead)
            .filter(Lead.status.in_(["qualified", "offer_draft", "offer_approved"]))
            .all()
        )

        if not pending_leads:
            st.success(
                "Wszystkie zakwalifikowane oferty zostały przejrzane lub brak oczekujących leadów."
            )
        else:
            for pl in pending_leads:
                with st.expander(
                    f"Lead #{pl.id}: {pl.company_name} | {pl.city} | Score: {pl.score}/100",
                    expanded=(pl.status == "qualified"),
                ):
                    col_det, col_btns = st.columns([3, 1])
                    with col_det:
                        st.write(
                            f"Branża: **{pl.industry}** | Telefon: `{pl.phone_normalized or 'Brak'}` | Email: `{pl.email_primary or 'Brak'}`"
                        )
                        st.write(
                            f"Strona WWW: [{pl.website}]({pl.website}) | Status: `{pl.status}`"
                        )
                    with col_btns:
                        if st.button(
                            f"Zatwierdź Ofertę #{pl.id}", key=f"app_{pl.id}", type="primary"
                        ):
                            pl.status = "offer_approved"
                            session.commit()
                            st.success(f"Zatwierdzono lead #{pl.id}")
                            st.rerun()
                        if st.button(f"Odrzuć Ofertę #{pl.id}", key=f"rej_{pl.id}"):
                            pl.status = "disqualified"
                            pl.rejection_reason = "Manualnie odrzucony przez człowieka w panelu"
                            session.commit()
                            st.warning(f"Odrzucono lead #{pl.id}")
                            st.rerun()


# ================= TAB 4: IMPORT NEW LEADS =================
with tab_import:
    st.markdown("### 📤 Import Leadów ze Scrapera (CSV / JSON)")
    st.caption(
        "Plik zostanie automatycznie przefiltrowany przez filtr geograficzny Legnicy (30 km) i deduplikator."
    )

    uploaded_file = st.file_uploader("Wybierz plik ze scrapera:", type=["csv", "json"])
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
            if st.button(
                "Importuj do Bazy i Wyklucz Wrocław", type="primary", use_container_width=True
            ):
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
    st.info("Uruchamianie pełnego cyklu (Weryfikacja rejestrów + Audyt WWW + Scoring)...")
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

            # 3. Qualify
            q_res = qualifier.qualify_lead(lead, lead.audit)
            if q_res.is_qualified:
                lead.status = "qualified"
                lead.score = q_res.total_score
                lead.rejection_reason = None
                if q_res.breakdown:
                    lead.score_breakdown = q_res.breakdown.model_dump()
            else:
                lead.status = "disqualified"
                lead.score = q_res.total_score
                lead.rejection_reason = q_res.rejection_reason
                if q_res.breakdown:
                    lead.score_breakdown = q_res.breakdown.model_dump()

        session.commit()
    st.success("Pomyślnie ukończono pełny cykl przetwarzania!")
    st.rerun()

if btn_enrich:
    reg_client = RegistryClient()
    updated = 0
    with get_db() as session:
        leads_to_enrich = session.query(Lead).filter(Lead.status.in_(["new", "qualified"])).all()
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
            if q_res.is_qualified:
                lead.status = "qualified"
                lead.score = q_res.total_score
                lead.rejection_reason = None
                if q_res.breakdown:
                    lead.score_breakdown = q_res.breakdown.model_dump()
            else:
                lead.status = "disqualified"
                lead.score = q_res.total_score
                lead.rejection_reason = q_res.rejection_reason
                if q_res.breakdown:
                    lead.score_breakdown = q_res.breakdown.model_dump()
        session.commit()
    st.success("Zakończono kwalifikację i przeliczanie scoringu!")
    st.rerun()
