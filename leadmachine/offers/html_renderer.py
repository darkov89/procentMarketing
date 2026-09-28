from typing import Optional

from leadmachine.config import get_settings
from leadmachine.db.models import Lead
from leadmachine.offers.generator import OfferContent


class OfferRenderer:
    """Renders OfferContent into a standalone HTML landing page."""

    def render(self, offer: OfferContent, lead: Lead, slug: str, booking_url: str = "https://calendly.com/procentmarketing") -> str:
        """Render the complete HTML page."""

        # Build observations HTML
        observations_html = ""
        for obs in offer.observations:
            observations_html += f"""
            <div class="card">
                <div class="card-icon">🔍</div>
                <h3>{obs.finding}</h3>
                <p><strong>Wpływ:</strong> {obs.impact}</p>
            </div>
            """

        # Build modules HTML
        modules_html = ""
        for mod in offer.proposed_modules:
            modules_html += f"""
            <div class="card">
                <div class="card-icon">{mod.icon_emoji}</div>
                <h3>{mod.name}</h3>
                <p>{mod.description}</p>
            </div>
            """

        # Build process steps HTML
        steps_html = ""
        for step in offer.process_steps:
            steps_html += f"""
            <div class="step-item">
                <div class="step-number">{step.step_number}</div>
                <div class="step-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                </div>
            </div>
            """

        html = f"""<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Oferta dla {lead.company_name} | Procent Marketing</title>
    <meta property="og:title" content="Oferta dla {lead.company_name}">
    <meta property="og:description" content="{offer.hero_headline}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-color: #0A0C10;
            --accent: #FFE600;
            --text-main: #F3F4F6;
            --text-muted: #9CA3AF;
            --card-bg: rgba(20, 24, 34, 0.7);
        }}

        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}

        body {{
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            line-height: 1.6;
        }}

        .container {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }}

        section {{
            padding: 80px 0;
        }}

        h1, h2, h3 {{
            font-weight: 700;
            line-height: 1.2;
            margin-bottom: 20px;
        }}

        h2 {{
            font-size: 2.5rem;
            text-align: center;
            margin-bottom: 50px;
        }}

        h2 span {{
            color: var(--accent);
        }}

        .hero {{
            min-height: 80vh;
            display: flex;
            align-items: center;
            text-align: center;
            background: radial-gradient(circle at top, rgba(255, 230, 0, 0.1) 0%, rgba(10, 12, 16, 1) 60%);
        }}

        .hero h1 {{
            font-size: 3.5rem;
            margin-bottom: 24px;
        }}

        .hero p {{
            font-size: 1.25rem;
            color: var(--text-muted);
            max-width: 800px;
            margin: 0 auto 40px;
        }}

        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
        }}

        .card {{
            background: var(--card-bg);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 30px;
            backdrop-filter: blur(10px);
            transition: transform 0.3s ease;
        }}

        .card:hover {{
            transform: translateY(-5px);
            border-color: rgba(255, 230, 0, 0.3);
        }}

        .card-icon {{
            font-size: 2.5rem;
            margin-bottom: 20px;
        }}

        .btn {{
            display: inline-block;
            background-color: var(--accent);
            color: #000;
            padding: 16px 40px;
            border-radius: 50px;
            font-weight: 700;
            text-decoration: none;
            font-size: 1.1rem;
            transition: all 0.3s ease;
        }}

        .btn:hover {{
            background-color: #e6cf00;
            transform: scale(1.05);
        }}

        .process-steps {{
            max-width: 800px;
            margin: 0 auto;
        }}

        .step-item {{
            display: flex;
            margin-bottom: 40px;
            background: var(--card-bg);
            border-radius: 16px;
            padding: 30px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }}

        .step-number {{
            font-size: 2rem;
            font-weight: 700;
            color: var(--accent);
            margin-right: 30px;
            min-width: 50px;
        }}

        .pricing-section {{
            text-align: center;
            background: rgba(255, 230, 0, 0.05);
            border-radius: 24px;
            padding: 60px;
            margin: 80px 0;
            border: 1px solid rgba(255, 230, 0, 0.1);
        }}

        .pricing-val {{
            font-size: 3rem;
            font-weight: 700;
            color: var(--accent);
            margin: 20px 0;
        }}

        footer {{
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            padding: 40px 0;
            text-align: center;
            color: var(--text-muted);
            font-size: 0.9rem;
        }}

        @media (max-width: 768px) {{
            .hero h1 {{ font-size: 2.5rem; }}
            .step-item {{ flex-direction: column; }}
            .step-number {{ margin-bottom: 15px; }}
        }}
    </style>
</head>
<body>

    <section class="hero">
        <div class="container">
            <h1>{offer.hero_headline}</h1>
            <p>{offer.hero_observation}</p>
            <a href="{booking_url}" class="btn">{offer.cta_text}</a>
        </div>
    </section>

    <section class="container">
        <h2>Co <span>zauważyliśmy</span> w obecnej strategii</h2>
        <div class="grid">
            {observations_html}
        </div>
    </section>

    <section class="container">
        <h2>Proponowane <span>rozwiązania</span></h2>
        <div class="grid">
            {modules_html}
        </div>
    </section>

    <section class="container">
        <h2>Proces <span>wdrożenia</span></h2>
        <div class="process-steps">
            {steps_html}
        </div>
    </section>

    <section class="container">
        <div class="pricing-section">
            <h2>Przewidywana <span>inwestycja</span></h2>
            <p>Szacunkowy budżet dla optymalnej realizacji strategii:</p>
            <div class="pricing-val">{offer.pricing_range}</div>
            <br>
            <a href="{booking_url}" class="btn">{offer.cta_text}</a>
        </div>
    </section>

    <footer>
        <div class="container">
            <p>&copy; 2026 Procent Marketing. Wszelkie prawa zastrzeżone.</p>
            <p style="margin-top: 10px; font-size: 0.8rem;">
                Administratorem danych osobowych jest AM PROCENT Sp. z o.o., Legnica (art. 14 RODO). Przetwarzamy Twoje dane wyłącznie w prawnie uzasadnionym celu B2B.
            </p>
        </div>
    </footer>

</body>
</html>"""
        return html


def render_offer_page(
    offer: OfferContent,
    lead: Optional[Lead] = None,
    slug: str = "oferta",
    booking_url: Optional[str] = None,
) -> str:
    """Helper function to render an offer page."""
    renderer = OfferRenderer()
    if lead is None:
        lead = Lead(company_name="Twoja Firma", industry="B2B")
    settings = get_settings()
    b_url = booking_url or getattr(settings.sender, "booking_url", "https://cal.com/procentmarketing/15min")
    return renderer.render(offer, lead, slug, b_url)

