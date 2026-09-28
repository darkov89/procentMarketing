"""Company registry client for CEIDG, REGON, and KRS."""

import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional

import httpx

from leadmachine.config import get_settings
from leadmachine.core.dedup import normalize_nip

logger = logging.getLogger(__name__)


@dataclass
class RegistryResult:
    is_active: bool = True
    company_legal_name: Optional[str] = None
    krs: Optional[str] = None
    regon: Optional[str] = None
    nip: Optional[str] = None
    pkd_main: Optional[str] = None
    owner_name: Optional[str] = None
    owner_role: Optional[str] = None
    owner_confidence: str = "none"  # high, medium, low, none
    source: str = "registry"
    raw_response: Optional[Dict[str, Any]] = None


class RegistryClient:
    """Client for verifying Polish business registries (CEIDG, KRS, REGON)."""

    def __init__(self, timeout_sec: float = 6.0):
        self.settings = get_settings()
        self.timeout = timeout_sec

    def lookup(
        self,
        nip: Optional[str] = None,
        krs: Optional[str] = None,
        company_name: Optional[str] = None,
    ) -> RegistryResult:
        """Looks up business details in KRS or CEIDG."""
        clean_nip = normalize_nip(nip)

        # 1. Spółki handlowe (KRS)
        if krs or (
            company_name
            and any(term in company_name.lower() for term in ["sp. z o.o.", "spółka", "s.a."])
        ):
            krs_res = self._lookup_krs(krs=krs, nip=clean_nip)
            if krs_res:
                return krs_res

        # 2. Jednoosobowe Działalności Gospodarcze (CEIDG)
        if clean_nip:
            ceidg_res = self._lookup_ceidg(nip=clean_nip)
            if ceidg_res:
                return ceidg_res

        # 3. Fallback extraction from company name if it contains owner's full name (common in Polish JDG)
        inferred = self._infer_owner_from_name(company_name)
        if inferred:
            return inferred

        return RegistryResult(
            is_active=True,
            owner_confidence="none",
            source="none",
        )

    def _lookup_krs(
        self, krs: Optional[str] = None, nip: Optional[str] = None
    ) -> Optional[RegistryResult]:
        """Queries the official public Polish Ministry of Justice KRS API."""
        if not krs and not nip:
            return None

        # Format KRS to 10 digits
        clean_krs = krs.zfill(10) if krs else None

        if clean_krs:
            url = (
                f"https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/{clean_krs}?rejestr=P&format=json"
            )
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    resp = client.get(url)
                    if resp.status_code == 200:
                        data = resp.json()
                        return self._parse_krs_response(data)
            except Exception as e:
                logger.debug(f"KRS API lookup failed: {e}")

        return None

    def _parse_krs_response(self, data: Dict[str, Any]) -> RegistryResult:
        odpis = data.get("odpis", {})
        dane = odpis.get("dane", {})
        naglowek = odpis.get("naglowekA", {})

        krs_num = naglowek.get("numerKRS")
        dzial1 = dane.get("dzial1", {})
        dane_podmiotu = dzial1.get("danePodmiotu", {})
        legal_name = dane_podmiotu.get("nazwa")
        identyfikatory = dane_podmiotu.get("identyfikatory", {})
        nip_val = identyfikatory.get("nip")
        regon_val = identyfikatory.get("regon")

        # Representing board members (Dział 2 - Reprezentacja)
        dzial2 = dane.get("dzial2", {})
        organ_reprezentacji = dzial2.get("organReprezentacji", {})
        reprezentanci = organ_reprezentacji.get("sklad", [])

        owner_name = None
        owner_role = None

        if reprezentanci:
            # First board member (often President of the board)
            first_rep = reprezentanci[0]
            nazwisko = first_rep.get("nazwisko", {}).get("nazwiskoIczlon", "")
            imiona = first_rep.get("imiona", {}).get("imie", "")
            funkcja = first_rep.get("funkcjaWorganie", "Członek Zarządu")
            owner_name = f"{imiona} {nazwisko}".strip()
            owner_role = funkcja

        return RegistryResult(
            is_active=True,
            company_legal_name=legal_name,
            krs=krs_num,
            regon=regon_val,
            nip=nip_val,
            owner_name=owner_name,
            owner_role=owner_role or "Zarząd",
            owner_confidence="high" if owner_name else "low",
            source="krs_api",
            raw_response=data,
        )

    def _lookup_ceidg(self, nip: str) -> Optional[RegistryResult]:
        """Queries CEIDG (dane.biznes.gov.pl) if token is available."""
        token = self.settings.ceidg_api_token
        if not token:
            return None

        url = f"https://dane.biznes.gov.pl/api/ceidg/v2/firmy?nip={nip}"
        headers = {"Authorization": f"Bearer {token}"}
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    firmy = data.get("firmy", [])
                    if firmy:
                        f = firmy[0]
                        imie = f.get("wlasciciel", {}).get("imie", "")
                        nazwisko = f.get("wlasciciel", {}).get("nazwisko", "")
                        owner_name = f"{imie} {nazwisko}".strip()
                        return RegistryResult(
                            is_active=f.get("status") == "AKTYWNY",
                            company_legal_name=f.get("nazwa"),
                            nip=nip,
                            regon=f.get("regon"),
                            pkd_main=f.get("pkdGlowny"),
                            owner_name=owner_name if owner_name else None,
                            owner_role="Właściciel",
                            owner_confidence="high" if owner_name else "medium",
                            source="ceidg_api",
                            raw_response=f,
                        )
        except Exception as e:
            logger.debug(f"CEIDG API lookup failed: {e}")

        return None

    def _infer_owner_from_name(self, company_name: Optional[str]) -> Optional[RegistryResult]:
        """Infers owner from JDG company name if it follows typical 'Firma Usługowa Jan Kowalski' pattern."""
        if not company_name:
            return None

        parts = company_name.split()
        if len(parts) >= 2:
            # Check if last 2 words look like Polish First Name + Last Name (both capitalized, common polish endings)
            first_candidate = parts[-2]
            last_candidate = parts[-1]
            if first_candidate.istitle() and last_candidate.istitle():
                # Common Polish first name / surname patterns
                surname_endings = (
                    "ski",
                    "ska",
                    "cki",
                    "cka",
                    "ak",
                    "ek",
                    "ik",
                    "yk",
                    "uk",
                    "ec",
                    "a",
                    "k",
                )
                if any(last_candidate.lower().endswith(end) for end in surname_endings):
                    return RegistryResult(
                        is_active=True,
                        company_legal_name=company_name,
                        owner_name=f"{first_candidate} {last_candidate}",
                        owner_role="Właściciel",
                        owner_confidence="medium",
                        source="inferred_name",
                    )
        return None
