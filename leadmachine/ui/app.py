"""Streamlit web dashboard for Lead Machine (Procent Marketing)."""

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

# Custom Styling (Procent Marketing Design Tokens)
st.markdown(
    """
    <style>
    /* Dark Theme & Yellow Accent */
    .main {
        background-color: #121212;
        color: #ffffff;
    }
    .stMetric {
        background-color: #1c1c1c;
        border: 1px solid #333333;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .stMetric label {
        color: #bebebe !important;
        font-size: 0.85rem !important;
    }
    .stMetric [data-testid="stMetricValue"] {
        color: #FFE600 !important;
        font-weight: 700;
        font-size: 1.8rem;
    }
    .status-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }
    .badge-live { background-color: #e53935; color: white; }
    .badge-test { background-color: #2e7d32; color: white; }
    .badge-kill { background-color: #c62828; color: white; }
    .badge-ok { background-color: #1565c0; color: white; }
    </style>
    """,
    unsafe_allow_html=True,
)


def load_leads_from_db():
    init_db()
    with get_db() as session:
        leads = session.query(Lead).all()
        # Detach/convert to list of dicts for safe Streamlit rendering
        data = []
        for lead in leads:
            data.append({
                "id": lead.id,
                "company_name": lead.company_name,
                "city": lead.city,
                "distance_km": lead.distance_km,
                "industry": lead.industry,
                "status": lead.status,
                "score": lead.score,
                "owner_confidence": lead.owner_confidence or "brak",
                "phone": lead.phone_normalized,
                "email": lead.email_primary,
                "website": lead.website,
                "rejection_reason": lead.rejection_reason,
                "has_audit": lead.audit is not None,
                "created_at": lead.created_at,
            })
        return data, leads


settings = get_settings()
stop_file_exists = Path(settings.kill_switch_file).exists()

# Top Bar Header
col_header, col_mode, col_kill = st.columns([3, 1, 1])
with col_header:
    st.title("⚡ Procent Marketing — Lead Machine")
    st.caption("Autonomiczny system B2B: kwalifikacja, mini-audyt WWW, personalizacja ofert i outreach")

with col_mode:
    if settings.live_mode:
        st.markdown('<div style="text-align: right;"><span class="status-badge badge-live">🔴 LIVE PROD</span></div>', unsafe_allow_html=True)
    else:
        st.markdown('<div style="text-align: right;"><span class="status-badge badge-test">🟢 SANDBOX (BEZPIECZNY)</span></div>', unsafe_allow_html=True)
    st.caption(f"Tryb akceptacji: `{settings.approval_mode}`")

with col_kill:
    if stop_file_exists:
        st.markdown('<div style="text-align: right;"><span class="status-badge badge-kill">🚨 STOP AKTYWNY</span></div>', unsafe_allow_html=True)
        if st.button("Odblokuj system", type="primary", use_container_width=True):
            Path(settings.kill_switch_file).unlink(missing_ok=True)
            st.rerun()
    else:
        st.markdown('<div style="text-align: right;"><span class="status-badge badge-ok">🛡️ BEZPIECZNIK OK</span></div>', unsafe_allow_html=True)
        if st.button("Aktywuj STOP (Kill-Switch)", use_container_width=True):
            Path(settings.kill_switch_file).touch()
            st.rerun()

st.divider()

# Load DB Data
leads_dict, raw_leads_objects = load_leads_from_db()
df = pd.DataFrame(leads_dict) if leads_dict else pd.DataFrame()

# Sidebar Controls
st.sidebar.header("Sterowanie i Narzędzia")

if st.sidebar.button("🔄 Odśwież dane z bazy", use_container_width=True):
    st.rerun()

if st.sidebar.button("📥 Eksportuj do Excela (leads.xlsx)", use_container_width=True):
    if raw_leads_objects:
        saved_path = export_leads_to_excel(raw_leads_objects, Path("leads.xlsx"))
        st.sidebar.success(f"Zapisano {len(raw_leads_objects)} leadów do: {saved_path}")
    else:
        st.sidebar.warning("Brak leadów w bazie do eksportu.")

st.sidebar.subheader("Pętla Przetwarzania")
action_enrich = st.sidebar.button("1. Weryfikacja rejestrów (CEIDG/KRS)", use_container_width=True)
action_audit = st.sidebar.button("2. Uruchom audyt marketingowy WWW", use_container_width=True)
action_qualify = st.sidebar.button("3. Kwalifikuj i nalicz scoring", use_container_width=True)

# Main Tabs
tab_funnel, tab_leads, tab_approval, tab_import = st.tabs([
    "📊 Lejek i Maszyna Stanów",
    "📋 Baza Leadów i Detale",
    "⚖️ Kolejka Akceptacji",
    "📤 Import Nowych Leadów",
])

# ----------------- TAB 1: FUNNEL & STATS -----------------
with tab_funnel:
    if df.empty:
        st.info("Baza danych jest obecnie pusta. Wgraj plik scrapera w zakładce 'Import Nowych Leadów' lub uruchom `leadmachine scan`.")
    else:
        # Key Metrics Row
        m1, m2, m3, m4, m5, m6 = st.columns(6)
        total_count = len(df)
        qualified_count = len(df[df["status"] == "qualified"])
        disqualified_count = len(df[df["status"] == "disqualified"])
        new_count = len(df[df["status"] == "new"])
        audited_count = len(df[df["status"] == "audited"])
        sent_count = len(df[df["status"].isin(["sent", "followup_sent"])])

        m1.metric("Wszystkie Leady", total_count)
        m2.metric("Nowe", new_count)
        m3.metric("Zakwalifikowane", qualified_count)
        m4.metric("Audytowane", audited_count)
        m5.metric("Odrzucone", disqualified_count)
        m6.metric("Wysłane", sent_count)

        st.subheader("Rozkład Stanów Maszyny Leada")
        status_counts = df["status"].value_counts().reset_index()
        status_counts.columns = ["Status", "Liczba"]
        st.bar_chart(status_counts.set_index("Status"), color="#FFE600")

        # Rejection Reasons Breakdown
        if disqualified_count > 0:
            st.subheader("Główne Przyczyny Odrzucenia (Kwalifikacja & Geo)")
            rejections = df[df["status"] == "disqualified"]["rejection_reason"].value_counts().reset_index()
            rejections.columns = ["Powód Odrzucenia", "Liczba"]
            st.dataframe(rejections, use_container_width=True, hide_index=True)


# ----------------- TAB 2: LEADS EXPLORER -----------------
with tab_leads:
    if df.empty:
        st.info("Brak danych do wyświetlenia.")
    else:
        # Filters row
        f1, f2, f3 = st.columns(3)
        with f1:
            selected_statuses = st.multiselect(
                "Filtruj status:",
                options=df["status"].unique().tolist(),
                default=df["status"].unique().tolist(),
            )
        with f2:
            cities = ["Wszystkie"] + sorted([c for c in df["city"].dropna().unique().tolist() if c])
            selected_city = st.selectbox("Filtruj miasto:", options=cities)
        with f3:
            min_score = st.slider("Minimalny Score:", 0, 100, 0)

        # Apply filters
        filtered_df = df[df["status"].isin(selected_statuses)]
        if selected_city != "Wszystkie":
            filtered_df = filtered_df[filtered_df["city"] == selected_city]
        filtered_df = filtered_df[filtered_df["score"] >= min_score]

        st.write(f"Wyświetlanie **{len(filtered_df)}** z **{len(df)}** leadów:")

        # Display Dataframe
        st.dataframe(
            filtered_df[[
                "id", "company_name", "city", "distance_km", "industry", "status", "score",
                "owner_confidence", "phone", "website"
            ]],
            use_container_width=True,
            hide_index=True,
        )

        # Selected Lead Detailed Inspector Card
        st.subheader("Karta Szczegółów Wybranego Leada")
        selected_lead_id = st.selectbox("Wybierz ID leada do zbadania:", options=filtered_df["id"].tolist())

        if selected_lead_id:
            with get_db() as session:
                lead_obj = session.query(Lead).filter(Lead.id == selected_lead_id).first()
                if lead_obj:
                    c1, c2 = st.columns(2)
                    with c1:
                        st.markdown(f"### **{lead_obj.company_name}**")
                        st.write(f"📍 **Adres**: {lead_obj.address or 'Brak'}, {lead_obj.city or 'Brak'}")
                        st.write(f"📏 **Odległość od Legnicy**: {lead_obj.distance_km} km")
                        st.write(f"📞 **Telefon**: {lead_obj.phone_normalized or 'Brak'}")
                        st.write(f"✉️ **Email**: {lead_obj.email_primary or 'Brak'}")
                        st.write(f"🌐 **WWW**: {lead_obj.website or 'Brak'}")
                        st.write(f"🏷️ **NIP**: {lead_obj.nip or 'Brak'} | **KRS**: {lead_obj.krs or 'Brak'}")

                    with c2:
                        st.markdown(f"### Status: `{lead_obj.status}` (Score: {lead_obj.score}/100)")
                        st.write(f"👤 **Pewność właściciela**: `{lead_obj.owner_confidence or 'brak'}`")
                        if lead_obj.rejection_reason:
                            st.warning(f"Powód odrzucenia: {lead_obj.rejection_reason}")

                        if lead_obj.score_breakdown and isinstance(lead_obj.score_breakdown, dict):
                            st.write("📊 **Podsumowanie scoringu:**")
                            st.json(lead_obj.score_breakdown)

                    # Audit Findings Section
                    if lead_obj.audit:
                        st.divider()
                        st.markdown("#### 🔍 Wyniki Audytu Marketingowego (z dowodami `evidence`)")
                        a_col1, a_col2, a_col3, a_col4 = st.columns(4)
                        a_col1.metric("SSL (HTTPS)", "TAK" if lead_obj.audit.ssl_valid else "NIE")
                        a_col2.metric("Responsywność", "TAK" if lead_obj.audit.is_responsive else "NIE")
                        a_col3.metric("CMS", lead_obj.audit.cms_detected or "Nieznany")
                        a_col4.metric("Opinie Google", f"{lead_obj.audit.google_rating or 0}★ ({lead_obj.audit.google_reviews_count or 0})")

                        b_col1, b_col2, b_col3, b_col4 = st.columns(4)
                        b_col1.metric("GA4", "TAK" if lead_obj.audit.has_ga4 else "NIE")
                        b_col2.metric("Meta Pixel", "TAK" if lead_obj.audit.has_meta_pixel else "NIE")
                        b_col3.metric("Formularz", "TAK" if lead_obj.audit.has_contact_form else "NIE")
                        b_col4.metric("Rezerwacja Online", "TAK" if lead_obj.audit.has_online_booking else "NIE")

                        if lead_obj.audit.raw_evidence:
                            with st.expander("Zobacz twarde dowody z kodu strony (Raw Evidence)"):
                                st.json(lead_obj.audit.raw_evidence)


# ----------------- TAB 3: APPROVAL QUEUE -----------------
with tab_approval:
    st.subheader("Kolejka Akceptacji Człowieka (`approval_mode=all`)")
    with get_db() as session:
        pending_leads = session.query(Lead).filter(Lead.status.in_(["qualified", "offer_draft", "offer_approved"])).all()
        if not pending_leads:
            st.success("Brak leadów oczekujących na akceptację oferty/wysyłki.")
        else:
            for pl in pending_leads:
                with st.expander(f"Lead #{pl.id}: {pl.company_name} | Branża: {pl.industry} | Score: {pl.score}"):
                    st.write(f"Status: `{pl.status}` | Miasto: {pl.city} | Telefon: {pl.phone_normalized}")
                    col_btn1, col_btn2 = st.columns(2)
                    with col_btn1:
                        if st.button(f"Zatwierdź Ofertę #{pl.id}", key=f"app_{pl.id}"):
                            pl.status = "offer_approved"
                            session.commit()
                            st.success(f"Zatwierdzono lead #{pl.id}")
                            st.rerun()
                    with col_btn2:
                        if st.button(f"Odrzuć Ofertę #{pl.id}", key=f"rej_{pl.id}"):
                            pl.status = "disqualified"
                            pl.rejection_reason = "Manualnie odrzucony przez człowieka w panelu"
                            session.commit()
                            st.warning(f"Odrzucono lead #{pl.id}")
                            st.rerun()


# ----------------- TAB 4: IMPORT NEW LEADS -----------------
with tab_import:
    st.subheader("Import Nowych Leadów (Plik CSV lub JSON ze Scrapera)")
    uploaded_file = st.file_uploader("Wybierz plik CSV ze scrapera", type=["csv", "json"])

    if uploaded_file is not None:
        save_dir = Path("data")
        save_dir.mkdir(exist_ok=True)
        temp_path = save_dir / uploaded_file.name
        with open(temp_path, "wb") as f:
            f.write(uploaded_file.getbuffer())

        st.success(f"Zapisano plik: {temp_path}")

        c_dry, c_run = st.columns(2)
        with c_dry:
            if st.button("Uruchom Symulację (Dry-Run)", use_container_width=True):
                from leadmachine.adapters.scraper_adapter import ScraperAdapter
                raw = ScraperAdapter.load_from_file(temp_path)
                st.info(f"Wczytano {len(raw)} rekordów. Podgląd pierwszych 3:")
                st.write([r.company_name for r in raw[:3]])
        with c_run:
            if st.button("Importuj do Bazy Danych (Scan)", type="primary", use_container_width=True):
                st.info("Uruchamianie importu z filtrem geo i deduplikacją...")
                # Call scan command logic
                from leadmachine.adapters.scraper_adapter import ScraperAdapter
                from leadmachine.core.dedup import is_duplicate, normalize_nip, normalize_phone_e164
                from leadmachine.core.geo import validate_geo

                raw_leads = ScraperAdapter.load_from_file(temp_path)
                with get_db() as session:
                    imported = 0
                    for raw in raw_leads:
                        geo_res = validate_geo(city=raw.city, address=raw.address, latitude=raw.latitude, longitude=raw.longitude)
                        norm_nip = normalize_nip(raw.nip)
                        norm_phone = normalize_phone_e164(raw.phone)
                        is_dup, dup_r = is_duplicate(session, nip=norm_nip, phone_normalized=norm_phone, website=raw.website, company_name=raw.company_name, address=raw.address)

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
                st.success(f"Zakończono import! Zaakceptowano {imported} nowych leadów.")
                st.rerun()


# --- Background processing actions triggered from sidebar ---
if action_enrich:
    st.info("Uruchamianie wzbogacania rejestrowego (CEIDG / KRS)...")
    reg_client = RegistryClient()
    updated = 0
    with get_db() as session:
        leads_to_enrich = session.query(Lead).filter(Lead.status.in_(["new", "qualified"])).all()
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
    st.success(f"Zaktualizowano dane właścicieli dla {updated} leadów!")
    st.rerun()

if action_audit:
    st.info("Uruchamianie audytu marketingowego WWW...")
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
            audited_count += 1
        session.commit()
    st.success(f"Przeprowadzono audyt dla {audited_count} stron WWW!")
    st.rerun()

if action_qualify:
    st.info("Naliczanie scoringu i kwalifikacja leadów...")
    qualifier = LeadQualifier()
    q_count = 0
    with get_db() as session:
        leads_to_q = session.query(Lead).filter(Lead.status.in_(["new", "audited", "qualified"])).all()
        for lead in leads_to_q:
            q_res = qualifier.qualify_lead(lead, lead.audit)
            if q_res.is_qualified:
                lead.status = "qualified"
                lead.score = q_res.total_score
                lead.score_breakdown = q_res.breakdown.model_dump() if q_res.breakdown else None
                q_count += 1
            else:
                lead.status = "disqualified"
                lead.score = q_res.total_score
                lead.rejection_reason = q_res.rejection_reason
                if q_res.breakdown:
                    lead.score_breakdown = q_res.breakdown.model_dump()
        session.commit()
    st.success(f"Zakończono kwalifikację! Zakwalifikowano {q_count} leadów.")
    st.rerun()
