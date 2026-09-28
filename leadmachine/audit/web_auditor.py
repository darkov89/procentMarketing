"""Polite marketing website auditor extracting factual technical signals with evidence."""

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

USER_AGENT = "ProcentMarketing-Auditor/1.0 (+https://procentmarketing.pl/)"


@dataclass
class AuditResult:
    website_url: str
    ssl_valid: bool = False
    is_responsive: bool = False
    pagespeed_mobile_score: Optional[int] = None
    cms_detected: Optional[str] = None
    copyright_year: Optional[int] = None
    has_ga4: bool = False
    has_gtm: bool = False
    has_meta_pixel: bool = False
    has_contact_form: bool = False
    has_online_booking: bool = False
    has_live_chat: bool = False
    social_links: Dict[str, str] = field(default_factory=dict)
    emails_scraped: List[str] = field(default_factory=list)
    meta_ads_active: bool = False
    evidence: Dict[str, Any] = field(default_factory=dict)
    audited_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    error: Optional[str] = None


class WebAuditor:
    """Audits potential client websites politely, extracting verifiable signals with evidence."""

    def __init__(self, timeout_sec: float = 8.0):
        self.timeout = timeout_sec

    def audit_url(self, raw_url: Optional[str]) -> AuditResult:
        if not raw_url:
            return AuditResult(website_url="", error="No website URL provided")

        url = raw_url.strip()
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        result = AuditResult(website_url=url)

        try:
            # 1. SSL & Connectivity Check
            headers = {"User-Agent": USER_AGENT}
            with httpx.Client(timeout=self.timeout, follow_redirects=True, verify=True) as client:
                resp = client.get(url, headers=headers)

                final_url = str(resp.url)
                result.ssl_valid = final_url.startswith("https://")
                result.evidence["ssl_valid"] = {
                    "final_url": final_url,
                    "status_code": resp.status_code,
                    "is_https": result.ssl_valid,
                }

                html = resp.text
                self._analyze_html(html, final_url, result)

        except httpx.ConnectError as e:
            result.ssl_valid = False
            result.error = f"Connection failed: {str(e)}"
            result.evidence["connectivity_error"] = str(e)
        except Exception as e:
            result.error = f"Audit error: {str(e)}"
            result.evidence["audit_exception"] = str(e)

        return result

    def _analyze_html(self, html: str, base_url: str, res: AuditResult):
        soup = BeautifulSoup(html, "html.parser")
        html_lower = html.lower()

        # 1. Responsiveness (Viewport tag)
        viewport = soup.find("meta", attrs={"name": re.compile(r"^viewport$", re.I)})
        if viewport and viewport.get("content"):
            content = str(viewport.get("content"))
            if "width=device-width" in content:
                res.is_responsive = True
                res.evidence["is_responsive"] = {
                    "tag": f'<meta name="viewport" content="{content[:60]}">',
                }

        # 2. CMS Detection
        generator = soup.find("meta", attrs={"name": re.compile(r"^generator$", re.I)})
        gen_content = str(generator.get("content", "")) if generator else ""

        if "wp-content" in html_lower or "wordpress" in gen_content.lower():
            res.cms_detected = "WordPress"
            res.evidence["cms"] = "wp-content path or generator meta"
        elif "wix.com" in html_lower or "wix" in gen_content.lower():
            res.cms_detected = "Wix"
            res.evidence["cms"] = "wix.com static script or generator meta"
        elif "webflow" in html_lower:
            res.cms_detected = "Webflow"
            res.evidence["cms"] = "webflow CSS/JS artifacts"
        elif "shopify" in html_lower:
            res.cms_detected = "Shopify"
            res.evidence["cms"] = "cdn.shopify.com scripts"
        elif "prestashop" in html_lower:
            res.cms_detected = "PrestaShop"
            res.evidence["cms"] = "prestashop JS variables"
        else:
            res.cms_detected = "Custom / Inny"
            res.evidence["cms"] = "No standard CMS fingerprint detected"

        # 3. Copyright year / last update
        year_matches = re.findall(
            r"(?:©|copyright|\(c\))\s*(?:20\d\d\s*[-–—]\s*)?(20\d\d)", html, re.I
        )
        if year_matches:
            try:
                latest_year = max(int(y) for y in year_matches)
                res.copyright_year = latest_year
                res.evidence["copyright_year"] = {
                    "matched_year": latest_year,
                    "evidence_snippet": f"Copyright {latest_year}",
                }
            except Exception:
                pass

        # 4. Analytics & Tag Management
        # GA4
        ga4_match = re.search(r"\b(G-[A-Z0-9]{6,12})\b", html)
        if ga4_match:
            res.has_ga4 = True
            res.evidence["has_ga4"] = {"tag": ga4_match.group(1)}

        # GTM
        gtm_match = re.search(r"\b(GTM-[A-Z0-9]{5,10})\b", html)
        if gtm_match:
            res.has_gtm = True
            res.evidence["has_gtm"] = {"tag": gtm_match.group(1)}

        # Meta Pixel
        if "fbq(" in html or "connect.facebook.net" in html_lower:
            res.has_meta_pixel = True
            res.meta_ads_active = True
            res.evidence["has_meta_pixel"] = {
                "snippet": "fbq('init') / connect.facebook.net detected"
            }

        # 5. Conversion Elements: Contact Form, Online Booking, Live Chat
        forms = soup.find_all("form")
        for f in forms:
            # Check if form looks like a contact form (has inputs and not just search)
            inputs = f.find_all(["input", "textarea"])
            if len(inputs) >= 2 and not f.get("role") == "search":
                res.has_contact_form = True
                res.evidence["has_contact_form"] = {
                    "form_action": str(f.get("action", ""))[:50],
                    "inputs_count": len(inputs),
                }
                break

        # Online booking tools
        booking_keywords = [
            "booksy",
            "calendly",
            "cal.com",
            "znanylekarz",
            "bookero",
            "rezerwacja online",
            "umów wizytę",
        ]
        for kw in booking_keywords:
            if kw in html_lower:
                res.has_online_booking = True
                res.evidence["has_online_booking"] = {"keyword": kw}
                break

        # Live chat widgets
        chat_keywords = [
            "tawk.to",
            "livechatinc",
            "smartsupp",
            "crisp.chat",
            "tidio",
            "facebook-jssdk",
            "intercom",
        ]
        for kw in chat_keywords:
            if kw in html_lower:
                res.has_live_chat = True
                res.evidence["has_live_chat"] = {"provider": kw}
                break

        # 6. Scrape Email Addresses (excluding image files or assets)
        raw_emails = re.findall(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b", html)
        clean_emails = set()
        for em in raw_emails:
            em_low = em.lower()
            if not em_low.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg")):
                clean_emails.add(em_low)
        res.emails_scraped = sorted(list(clean_emails))[:5]
        if res.emails_scraped:
            res.evidence["emails_scraped"] = res.emails_scraped

        # 7. Social media links
        social_domains = {
            "facebook": "facebook.com",
            "instagram": "instagram.com",
            "linkedin": "linkedin.com",
            "tiktok": "tiktok.com",
            "youtube": "youtube.com",
        }
        for a in soup.find_all("a", href=True):
            href = a["href"]
            for name, domain in social_domains.items():
                if domain in href and name not in res.social_links:
                    res.social_links[name] = href
                    break
        if res.social_links:
            res.evidence["social_links"] = res.social_links
