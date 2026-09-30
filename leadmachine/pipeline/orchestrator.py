"""Autonomous end-to-end pipeline orchestrator for Lead Machine."""

import logging
from typing import List

from pydantic import BaseModel
from slugify import slugify
from sqlalchemy import or_

from leadmachine.audit.web_auditor import WebAuditor
from leadmachine.config import get_settings
from leadmachine.db.models import Audit, Contact, Lead, Message, Offer, utcnow
from leadmachine.enrichment.registry_client import RegistryClient
from leadmachine.offers.generator import OfferGenerator
from leadmachine.offers.html_renderer import render_offer_page
from leadmachine.offers.netlify_deployer import NetlifyDeployer
from leadmachine.outreach.email_composer import compose_outreach_email
from leadmachine.outreach.smtp_sender import SmtpSender
from leadmachine.qualification.qualifier import LeadDecision, LeadQualifier

logger = logging.getLogger(__name__)


class PipelineReport(BaseModel):
    enriched_count: int = 0
    audited_count: int = 0
    auto_qualified_count: int = 0
    needs_review_count: int = 0
    auto_disqualified_count: int = 0
    offers_generated_count: int = 0
    offers_deployed_count: int = 0
    emails_sent_count: int = 0
    emails_failed_count: int = 0
    errors: List[str] = []


class PipelineOrchestrator:
    """Orchestrates the full autonomous pipeline from ingestion to outreach."""

    def __init__(self):
        self.settings = get_settings()
        self.registry_client = RegistryClient()
        self.web_auditor = WebAuditor()
        self.qualifier = LeadQualifier()
        self.offer_generator = OfferGenerator()
        self.netlify_deployer = NetlifyDeployer()
        self.smtp_sender = SmtpSender()

    def run_full_cycle(self, session, ignore_window: bool = True, auto_send: bool = False) -> PipelineReport:
        """Executes all pipeline stages. Automatically halts before outreach when approval_mode is 'all'."""
        report = PipelineReport()

        # Strict filter: Never process Wrocław leads, correctly handling NULL columns
        wroclaw_filter = [
            or_(Lead.city.is_(None), ~Lead.city.ilike("%wroc%")),
            or_(Lead.address.is_(None), ~Lead.address.ilike("%wroc%")),
            or_(Lead.rejection_reason.is_(None), ~Lead.rejection_reason.ilike("%wroc%")),
        ]

        # ----------------------------------------------------------------------
        # 1. ENRICH: CEIDG / KRS Lookup
        # ----------------------------------------------------------------------
        try:
            leads_to_enrich = (
                session.query(Lead)
                .filter(*wroclaw_filter)
                .filter(Lead.status.in_(["new", "qualified", "needs_review"]))
                .all()
            )
            for lead in leads_to_enrich:
                try:
                    res = self.registry_client.lookup(
                        nip=lead.nip, krs=lead.krs, company_name=lead.company_name
                    )
                    if res:
                        lead.owner_confidence = res.owner_confidence
                        if res.owner_name:
                            if not lead.contacts:
                                contact = Contact(
                                    lead=lead,
                                    first_name=res.owner_name,
                                    role=res.owner_role,
                                    is_primary=True,
                                    source=res.source,
                                )
                                session.add(contact)
                            else:
                                lead.contacts[0].first_name = res.owner_name
                                lead.contacts[0].role = res.owner_role
                        report.enriched_count += 1
                except Exception as e:
                    err = f"Enrich error for Lead #{lead.id} ({lead.company_name}): {e}"
                    report.errors.append(err)
                    logger.warning(err)
            session.commit()
        except Exception as e:
            err = f"Stage 1 (ENRICH) failed: {e}"
            report.errors.append(err)
            logger.error(err)

        # ----------------------------------------------------------------------
        # 2. AUDIT: Mini Web Marketing Audit
        # ----------------------------------------------------------------------
        try:
            leads_to_audit = (
                session.query(Lead)
                .filter(*wroclaw_filter)
                .filter(Lead.website.isnot(None))
                .all()
            )
            for lead in leads_to_audit:
                if not lead.audit:
                    try:
                        audit_res = self.web_auditor.audit_url(lead.website)
                        audit = Audit(
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
                        session.add(audit)
                        lead.audit = audit
                        report.audited_count += 1
                    except Exception as e:
                        err = f"Audit error for Lead #{lead.id} ({lead.website}): {e}"
                        report.errors.append(err)
                        logger.warning(err)
            session.commit()
        except Exception as e:
            err = f"Stage 2 (AUDIT) failed: {e}"
            report.errors.append(err)
            logger.error(err)

        # ----------------------------------------------------------------------
        # 3. QUALIFY: 3-Tier Autonomous Decision Matrix
        # ----------------------------------------------------------------------
        try:
            leads_to_qualify = (
                session.query(Lead)
                .filter(*wroclaw_filter)
                .filter(Lead.status == "new")
                .all()
            )
            for lead in leads_to_qualify:
                try:
                    q_res = self.qualifier.qualify_lead(lead, lead.audit)
                    lead.score = q_res.total_score
                    lead.status = q_res.suggested_status

                    if q_res.breakdown:
                        lead.score_breakdown = {
                            **q_res.breakdown.model_dump(),
                            "decision": q_res.decision.value,
                            "confidence": q_res.confidence,
                            "automation_fit_reasons": q_res.automation_fit_reasons,
                        }

                    if q_res.decision == LeadDecision.AUTO_QUALIFIED:
                        lead.rejection_reason = None
                        report.auto_qualified_count += 1
                    elif q_res.decision == LeadDecision.NEEDS_REVIEW:
                        lead.rejection_reason = q_res.review_reason
                        report.needs_review_count += 1
                    else:
                        lead.rejection_reason = q_res.rejection_reason
                        report.auto_disqualified_count += 1
                except Exception as e:
                    err = f"Qualify error for Lead #{lead.id}: {e}"
                    report.errors.append(err)
                    logger.warning(err)
            session.commit()
        except Exception as e:
            err = f"Stage 3 (QUALIFY) failed: {e}"
            report.errors.append(err)
            logger.error(err)

        # ----------------------------------------------------------------------
        # 4. GENERATE & DEPLOY OFFER: Personalized Netlify Landing Pages
        # ----------------------------------------------------------------------
        try:
            leads_for_offer = (
                session.query(Lead)
                .filter(*wroclaw_filter)
                .filter(Lead.status.in_(["qualified", "offer_draft", "offer_approved"]))
                .all()
            )
            for lead in leads_for_offer:
                existing_offer = session.query(Offer).filter(Offer.lead_id == lead.id).first()
                if not existing_offer or existing_offer.status != "published":
                    try:
                        offer_content = self.offer_generator.generate(lead, lead.audit)
                        safe_slug = slugify(f"{lead.company_name}-{lead.city or 'legnica'}")[:70]
                        html_page = render_offer_page(offer_content, lead, safe_slug)
                        deploy_res = self.netlify_deployer.deploy(html_page, safe_slug)

                        if not existing_offer:
                            offer = Offer(
                                lead=lead,
                                slug=safe_slug,
                                title=offer_content.hero_headline,
                                hero_observation=offer_content.hero_observation,
                                observations_evidence=[o.model_dump() for o in offer_content.observations],
                                proposed_modules=[m.model_dump() for m in offer_content.proposed_modules],
                                pricing_range=offer_content.pricing_range,
                                process_steps=[s.model_dump() for s in offer_content.process_steps],
                                booking_url=deploy_res.url,
                                deploy_url=deploy_res.url,
                                netlify_deploy_id=deploy_res.deploy_id,
                                status="published",
                                published_at=utcnow(),
                            )
                            session.add(offer)
                            lead.offer = offer
                        else:
                            existing_offer.slug = safe_slug
                            existing_offer.title = offer_content.hero_headline
                            existing_offer.hero_observation = offer_content.hero_observation
                            existing_offer.observations_evidence = [o.model_dump() for o in offer_content.observations]
                            existing_offer.proposed_modules = [m.model_dump() for m in offer_content.proposed_modules]
                            existing_offer.pricing_range = offer_content.pricing_range
                            existing_offer.process_steps = [s.model_dump() for s in offer_content.process_steps]
                            existing_offer.booking_url = deploy_res.url
                            existing_offer.deploy_url = deploy_res.url
                            existing_offer.netlify_deploy_id = deploy_res.deploy_id
                            existing_offer.status = "published"
                            existing_offer.published_at = utcnow()

                        lead.status = "offer_published"
                        report.offers_generated_count += 1
                        if deploy_res.url:
                            report.offers_deployed_count += 1
                    except Exception as e:
                        err = f"Offer generation error for Lead #{lead.id}: {e}"
                        report.errors.append(err)
                        logger.warning(err)
            session.commit()
        except Exception as e:
            err = f"Stage 4 (GENERATE OFFER) failed: {e}"
            report.errors.append(err)
            logger.error(err)

        # ----------------------------------------------------------------------
        # 5. SEND EMAIL: Outreach via SmtpSender (with full safety gate chain)
        # ----------------------------------------------------------------------
        # AI Act Art. 14 Human Oversight: if approval_mode == "all" and not auto_send,
        # halt automatic dispatch and leave offers ready for human review in the panel.
        if self.settings.approval_mode == "all" and not auto_send:
            logger.info(
                "Stage 5 (SEND EMAIL) paused: approval_mode='all' (AI Act Human Oversight). "
                "Offers are published and waiting for human review."
            )
            return report

        try:
            leads_for_email = (
                session.query(Lead)
                .filter(*wroclaw_filter)
                .filter(Lead.status == "offer_published")
                .all()
            )
            for lead in leads_for_email:
                existing_email = (
                    session.query(Message)
                    .filter(
                        Message.lead_id == lead.id,
                        Message.direction == "outbound",
                        Message.channel == "email",
                        Message.status == "sent",
                    )
                    .first()
                )
                if not existing_email:
                    try:
                        offer = lead.offer
                        contact = lead.contacts[0] if lead.contacts else None
                        offer_url = getattr(offer, "deploy_url", None) or getattr(offer, "booking_url", "")
                        draft = compose_outreach_email(
                            lead=lead, offer=offer, contact=contact, offer_url=offer_url
                        )
                        send_res = self.smtp_sender.send_email(
                            draft=draft,
                            lead=lead,
                            session=session,
                            ignore_window=ignore_window,
                        )
                        if send_res.success:
                            lead.status = "sent"
                            report.emails_sent_count += 1
                        else:
                            report.emails_failed_count += 1
                            err = f"Email send failed for #{lead.id} ({lead.company_name}): {send_res.error_message}"
                            report.errors.append(err)
                            logger.warning(err)
                    except Exception as e:
                        report.emails_failed_count += 1
                        err = f"Email dispatch exception for Lead #{lead.id}: {e}"
                        report.errors.append(err)
                        logger.warning(err)
            session.commit()
        except Exception as e:
            err = f"Stage 5 (SEND EMAIL) failed: {e}"
            report.errors.append(err)
            logger.error(err)

        return report
