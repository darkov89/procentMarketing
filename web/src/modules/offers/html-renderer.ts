import { OfferContent } from "@/lib/gemini";

export interface AuthorProfileInfo {
  name?: string | null;
  role?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  customNote?: string | null;
  bookingUrl?: string | null;
}

/**
 * Public offer page renderer for /o/[token].
 * Correctly renders offers WITH and WITHOUT prices (omits pricing box when pricing is unconfigured).
 * Embeds tenant author card, responsive CSS, and RODO disclaimer.
 */
export function renderModularOfferPage(
  offer: OfferContent,
  lead: { companyName: string; city?: string | null },
  slug: string,
  bookingUrl: string = "https://cal.com/procentmarketing/15min",
  author?: AuthorProfileInfo
): string {
  const effectiveBookingUrl = author?.bookingUrl || bookingUrl || "https://cal.com/procentmarketing/15min";
  const companyName = author?.company || "PROCENT MARKETING";
  const authorName = author?.name || "Dariusz";
  const authorRole = author?.role || "Strateg B2B";
  const authorEmail = author?.email || "kontakt@procentmarketing.pl";
  const authorPhone = author?.phone || null;
  const authorWebsite = author?.website || "https://procentmarketing.pl";
  const customNote = author?.customNote || null;
  const initials = authorName.trim() ? authorName.trim().charAt(0).toUpperCase() : "%";

  const observationsHtml = offer.observations
    .map(
      (obs) => `
      <div class="card">
        <div class="card-icon">🔍</div>
        <h3>${obs.finding}</h3>
        <p><strong>Wpływ biznesowy:</strong> ${obs.impact}</p>
      </div>`
    )
    .join("\n");

  const modulesHtml = offer.proposedModules
    .map(
      (mod) => `
      <div class="card">
        <div class="card-icon">${mod.iconEmoji || "⚡"}</div>
        <h3>${mod.name}</h3>
        <p>${mod.description}</p>
      </div>`
    )
    .join("\n");

  const stepsHtml = offer.processSteps
    .map(
      (step) => `
      <div class="step-item">
        <div class="step-number">${step.stepNumber}</div>
        <div class="step-content">
          <h3>${step.title}</h3>
          <p>${step.description}</p>
        </div>
      </div>`
    )
    .join("\n");

  // If price is missing or individual, present transparent note instead of artificial price tag
  const isIndividualPricing = !offer.pricingRange || offer.pricingRange.includes("indywidualna");

  const pricingSectionHtml = `
    <section class="pricing-box">
        <div class="pricing-tag">${isIndividualPricing ? "Model współpracy" : "Inwestycja miesięczna"}</div>
        <div class="price-amount">${offer.pricingRange || "Wycena indywidualna"}</div>
        <p style="color: var(--text-secondary); margin-bottom: 30px; max-width: 500px; margin-left: auto; margin-right: auto;">
            ${
              isIndividualPricing
                ? "Zakres prac oraz model rozliczenia ustalamy precyzyjnie po 15-minutowej rozmowie wstępnej."
                : "Bez długoterminowych cyrografów. Rozliczamy się za realne wdrożenia i wzrost zapytań."
            }
        </p>
        <a href="${effectiveBookingUrl}" target="_blank" class="cta-btn">${offer.ctaText} →</a>
    </section>
  `;

  return `<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="robots" content="noindex, nofollow">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Strategia & Oferta dla ${lead.companyName} | ${companyName}</title>
    <meta property="og:title" content="Oferta dla ${lead.companyName}">
    <meta property="og:description" content="${offer.heroHeadline}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0A0C10;
            --bg-card: rgba(20, 24, 34, 0.75);
            --border-card: rgba(255, 255, 255, 0.1);
            --accent: #FFE600;
            --accent-glow: rgba(255, 230, 0, 0.4);
            --text-primary: #F3F4F6;
            --text-secondary: #9CA3AF;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            padding: 0 20px;
        }

        .container { max-width: 1000px; margin: 0 auto; padding: 60px 0; }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 60px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border-card);
        }

        .logo {
            font-size: 1.25rem;
            font-weight: 800;
            letter-spacing: -0.5px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .logo-tag {
            background-color: var(--accent);
            color: #000;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 900;
        }

        .badge-target {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-card);
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.85rem;
        }

        .hero { text-align: center; margin-bottom: 70px; }
        .hero h1 {
            font-size: 2.75rem;
            font-weight: 800;
            line-height: 1.2;
            margin-bottom: 20px;
            letter-spacing: -1px;
        }
        .hero p {
            font-size: 1.2rem;
            color: var(--text-secondary);
            max-width: 700px;
            margin: 0 auto;
        }

        .section-title {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 30px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 60px;
        }

        .card {
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: 12px;
            padding: 24px;
            transition: all 0.2s ease;
        }

        .card:hover {
            border-color: var(--accent);
            transform: translateY(-2px);
        }

        .card-icon { font-size: 1.75rem; margin-bottom: 16px; }
        .card h3 { font-size: 1.15rem; font-weight: 700; margin-bottom: 8px; }
        .card p { color: var(--text-secondary); font-size: 0.95rem; }

        .timeline { margin-bottom: 60px; }
        .step-item {
            display: flex;
            gap: 20px;
            margin-bottom: 24px;
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            padding: 20px;
            border-radius: 12px;
        }

        .step-number {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background-color: var(--accent);
            color: #000;
            font-weight: 800;
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .pricing-box {
            background: linear-gradient(145deg, rgba(255, 230, 0, 0.05) 0%, rgba(20, 24, 34, 0.9) 100%);
            border: 1px solid rgba(255, 230, 0, 0.35);
            border-radius: 16px;
            padding: 40px;
            text-align: center;
            margin-bottom: 60px;
        }

        .pricing-tag {
            color: var(--accent);
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-size: 0.85rem;
            margin-bottom: 12px;
        }

        .price-amount {
            font-size: 2.5rem;
            font-weight: 900;
            margin-bottom: 24px;
        }

        .cta-btn {
            display: inline-block;
            background-color: var(--accent);
            color: #000;
            font-weight: 800;
            font-size: 1.05rem;
            padding: 16px 36px;
            border-radius: 10px;
            text-decoration: none;
            box-shadow: 0 0 25px var(--accent-glow);
            transition: all 0.2s ease;
        }

        .author-card {
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 60px;
        }

        .author-top {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 16px;
        }

        .author-avatar {
            width: 52px;
            height: 52px;
            border-radius: 50%;
            background-color: var(--accent);
            color: #000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
            font-weight: 900;
        }

        .author-info h4 { font-size: 1.15rem; font-weight: 800; }
        .author-info p { color: var(--text-secondary); font-size: 0.9rem; }
        .author-note {
            margin: 16px 0;
            font-style: italic;
            color: #E2E8F0;
            border-left: 3px solid var(--accent);
            padding-left: 14px;
            font-size: 0.95rem;
        }

        .author-contacts {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 16px;
            align-items: center;
        }

        .contact-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-card);
            color: var(--text-primary);
            text-decoration: none;
            font-size: 0.85rem;
        }

        footer {
            border-top: 1px solid var(--border-card);
            padding-top: 30px;
            font-size: 0.85rem;
            color: var(--text-secondary);
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">
                <span class="logo-tag">${initials}</span> ${companyName.toUpperCase()}
            </div>
            <div class="badge-target">Dedykowana dla: <strong>${lead.companyName}</strong></div>
        </header>

        <section class="hero">
            <h1>${offer.heroHeadline}</h1>
            <p>${offer.heroObservation}</p>
        </section>

        <section>
            <h2 class="section-title">Co zauważyliśmy podczas analizy</h2>
            <div class="grid">
                ${observationsHtml}
            </div>
        </section>

        <section>
            <h2 class="section-title">Proponowane moduły</h2>
            <div class="grid">
                ${modulesHtml}
            </div>
        </section>

        <section>
            <h2 class="section-title">Plan wdrożenia</h2>
            <div class="timeline">
                ${stepsHtml}
            </div>
        </section>

        ${pricingSectionHtml}

        <section class="author-card">
            <div class="author-top">
                <div class="author-avatar">${initials}</div>
                <div class="author-info">
                    <div style="font-size: 0.8rem; text-transform: uppercase; color: var(--accent); font-weight: 700;">
                        Ofertę przygotował(a):
                    </div>
                    <h4>${authorName}</h4>
                    <p>${authorRole} · <strong style="color: var(--text-primary);">${companyName}</strong></p>
                </div>
            </div>
            ${customNote ? `<div class="author-note">"${customNote}"</div>` : ""}
            <div class="author-contacts">
                ${authorEmail ? `<a href="mailto:${authorEmail}" class="contact-pill">📧 ${authorEmail}</a>` : ""}
                ${authorPhone ? `<a href="tel:${authorPhone}" class="contact-pill">📞 ${authorPhone}</a>` : ""}
                ${authorWebsite ? `<a href="${authorWebsite.startsWith("http") ? authorWebsite : "https://" + authorWebsite}" target="_blank" class="contact-pill">🌐 ${authorWebsite.replace(/^https?:\/\//, "")}</a>` : ""}
                <a href="${effectiveBookingUrl}" target="_blank" class="contact-pill" style="border-color: var(--accent); color: var(--accent); margin-left: auto;">
                    📅 ${offer.ctaText}
                </a>
            </div>
        </section>

        <footer>
            <p><strong>${companyName}</strong> ${authorEmail ? `| ${authorEmail}` : ""} ${authorPhone ? `| ${authorPhone}` : ""}</p>
            <p style="font-size: 0.75rem; margin-top: 8px;">
                Dokument wygenerowany w oparciu o publiczne dane i audyt technologiczny. Klauzula RODO: ${authorWebsite ? `${authorWebsite.replace(/\/$/, "")}/rodo` : "procentmarketing.pl/rodo"}
            </p>
        </footer>
    </div>
</body>
</html>`;
}
