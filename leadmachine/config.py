"""Configuration management using Pydantic Settings and YAML files."""

import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class GeoConfig(BaseModel):
    center_name: str = "Legnica Rynek"
    center_lat: float = 51.2070
    center_lon: float = 16.1605
    radius_km: float = 30.0
    excluded_cities: List[str] = Field(default_factory=lambda: ["Wrocław", "Wroclaw"])


class SenderConfig(BaseModel):
    company_name: str = "AM PROCENT Sp. z o.o."
    brand_name: str = "Procent Marketing"
    address: str = "ul. M. Rataja 15, 59-220 Legnica"
    krs: str = "0001200066"
    nip: str = "6912590158"
    sender_person_name: str = "Dariusz / Zespół Procent Marketing"
    sender_email: str = "kontakt@procentmarketing.pl"
    sender_phone: str = "+48 76 000 00 00"
    privacy_policy_url: str = "https://procentmarketing.pl/assets/PolitykaPrywatności-RODO.pdf"
    booking_url: str = "https://cal.com/procentmarketing/15min"


class LimitsConfig(BaseModel):
    daily_max_emails: int = 30
    send_window_start: str = "08:30"
    send_window_end: str = "16:00"
    send_days: List[str] = Field(
        default_factory=lambda: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    )
    exclude_polish_holidays: bool = True


class ScoringConfig(BaseModel):
    min_qualification_score: int = 60
    weights: Dict[str, int] = Field(
        default_factory=lambda: {
            "industry_match_max": 30,
            "automation_need_max": 25,
            "payment_ability_max": 20,
            "reachability_max": 15,
            "other_signals_max": 10,
        }
    )


class FollowupConfig(BaseModel):
    business_days_delay: int = 3
    max_followups: int = 1


class RetentionConfig(BaseModel):
    offer_validity_days: int = 60
    lead_inactive_retention_months: int = 12


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Security & Execution Mode
    live_mode: bool = False
    test_recipients: str = "test@example.com"
    approval_mode: str = "all"
    kill_switch_file: str = "STOP"
    timezone: str = "Europe/Warsaw"

    # Database
    database_url: str = f"sqlite:///{PROJECT_ROOT}/leadmachine.db"

    # LLM (Gemini)
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-2.5-flash"

    # Mail / SMTP / IMAP
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_name: str = "Dariusz - Procent Marketing"
    smtp_from_email: str = "kontakt@procentmarketing.pl"

    imap_host: Optional[str] = None
    imap_port: int = 993
    imap_user: Optional[str] = None
    imap_password: Optional[str] = None

    # Netlify
    netlify_auth_token: Optional[str] = None
    netlify_site_id: Optional[str] = None
    netlify_base_url: str = "https://oferta.procentmarketing.pl"

    # External APIs
    ceidg_api_token: Optional[str] = None
    regon_user_key: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    smsapi_token: Optional[str] = None
    whatsapp_cloud_api_token: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None

    # Structured YAML Configs
    geo: GeoConfig = Field(default_factory=GeoConfig)
    sender: SenderConfig = Field(default_factory=SenderConfig)
    limits: LimitsConfig = Field(default_factory=LimitsConfig)
    scoring: ScoringConfig = Field(default_factory=ScoringConfig)
    followup: FollowupConfig = Field(default_factory=FollowupConfig)
    retention: RetentionConfig = Field(default_factory=RetentionConfig)


def load_yaml_config(file_path: Path) -> Dict[str, Any]:
    if file_path.exists():
        with open(file_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}


@lru_cache()
def get_settings() -> Settings:
    # Sync Streamlit Community Cloud secrets into os.environ if present
    try:
        import streamlit as st
        try:
            for k, v in st.secrets.items():
                if isinstance(v, (str, int, float, bool)):
                    os.environ.setdefault(k.upper(), str(v))
                    os.environ.setdefault(k.lower(), str(v))
        except Exception:
            pass
    except Exception:
        pass

    settings_yaml = load_yaml_config(PROJECT_ROOT / "config" / "settings.yaml")

    geo_data = settings_yaml.get("geo", {})
    sender_data = settings_yaml.get("sender", {})
    limits_data = settings_yaml.get("limits", {})
    scoring_data = settings_yaml.get("scoring", {})
    followup_data = settings_yaml.get("followup", {})
    retention_data = settings_yaml.get("retention", {})

    settings = Settings(
        geo=GeoConfig(**geo_data) if geo_data else GeoConfig(),
        sender=SenderConfig(**sender_data) if sender_data else SenderConfig(),
        limits=LimitsConfig(**limits_data) if limits_data else LimitsConfig(),
        scoring=ScoringConfig(**scoring_data) if scoring_data else ScoringConfig(),
        followup=FollowupConfig(**followup_data) if followup_data else FollowupConfig(),
        retention=RetentionConfig(**retention_data) if retention_data else RetentionConfig(),
    )
    return settings


@lru_cache()
def get_industries_config() -> Dict[str, Any]:
    return load_yaml_config(PROJECT_ROOT / "config" / "industries.yaml")
