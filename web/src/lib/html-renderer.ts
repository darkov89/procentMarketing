import { OfferContent } from "./gemini";

export interface SenderInfo {
  name?: string | null;
  role?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  customNote?: string | null;
  bookingUrl?: string | null;
}

export function resolvePricingPresentation(
  pricingRange?: string | null,
  customCta?: string | null
): { tag: string; amount: string; description: string; cta: string } {
  const raw = (pricingRange || "").trim();
  const lower = raw.toLowerCase();

  const isIndividualOrEmpty =
    !raw ||
    lower.includes("indywidualna") ||
    lower.includes("sprawdź ceny") ||
    lower.includes("sprawdz ceny") ||
    lower.includes("bez ceny") ||
    lower.includes("do ustalenia") ||
    lower === "null" ||
    lower === "undefined";

  if (isIndividualOrEmpty) {
    return {
      tag: "Model współpracy",
      amount: "Wycena indywidualna",
      description:
        "Zakres prac oraz elastyczny model rozliczenia (podział zyskiem 50/50, stawka za wykonanie lub abonament) ustalamy precyzyjnie po krótkiej 15-minutowej rozmowie.",
      cta: customCta && customCta.trim() ? customCta : "Sprawdź ceny & Porozmawiajmy",
    };
  }

  // Model rev-share / % zysku (np. 50/50 - Procent Marketing)
  if (
    lower.includes("%") ||
    lower.includes("zyskiem") ||
    lower.includes("zysku") ||
    lower.includes("prowiz") ||
    lower.includes("success")
  ) {
    return {
      tag: "Model prowizyjny & Podział zysku (Success Fee)",
      amount: raw,
      description:
        "Dzielimy się wygenerowanym zyskiem (np. pół na pół). Zarabiamy wyłącznie wtedy, gdy wdrożone rozwiązania generują realne przychody dla Twojej firmy.",
      cta: customCta && customCta.trim() ? customCta : "Sprawdź warunki współpracy",
    };
  }

  // Stawka godzinowa
  if (lower.includes("/ godz") || lower.includes("/ h") || lower.includes("/h") || lower.includes("godzin")) {
    return {
      tag: "Stawka godzinowa (Time & Material)",
      amount: raw,
      description:
        "Transparentne rozliczenie za faktycznie przepracowany czas specjalistów bez długoterminowych zobowiązań.",
      cta: customCta && customCta.trim() ? customCta : "Porozmawiajmy o wycenie",
    };
  }

  // Za wykonanie / Projekt
  if (
    lower.includes("projekt") ||
    lower.includes("jednorazowo") ||
    lower.includes("wykonani") ||
    lower.includes("wdrożeni")
  ) {
    return {
      tag: "Inwestycja wdrożeniowa (Projekt)",
      amount: raw,
      description:
        "Kompleksowe wdrożenie systemu z gwarancją zakresu prac i wsparciem powdrożeniowym.",
      cta: customCta && customCta.trim() ? customCta : "Sprawdź zakres & wycenę",
    };
  }

  // Domyślnie miesięczna lub podana kwota
  return {
    tag: lower.includes("mies") ? "Inwestycja miesięczna" : "Inwestycja",
    amount: raw,
    description: "Bez długoterminowych cyrografów. Rozliczamy się za realne wdrożenia i wzrost zapytań.",
    cta: customCta && customCta.trim() ? customCta : "Umów bezpłatną konsultację",
  };
}

export function renderOfferPage(
  offer: OfferContent,
  lead: { companyName: string; city?: string | null },
  slug: string,
  bookingUrl: string = "https://cal.com/procentmarketing/15min",
  sender?: SenderInfo
): string {
  const effectiveBookingUrl = sender?.bookingUrl || bookingUrl || "https://cal.com/procentmarketing/15min";
  const companyName = sender?.company || "PROCENT MARKETING";
  const authorName = sender?.name || "Dariusz";
  const authorRole = sender?.role || "Założyciel & Strateg B2B";
  const authorEmail = sender?.email || "kontakt@procentmarketing.pl";
  const authorPhone = sender?.phone || null;
  const authorWebsite = sender?.website || "https://procentmarketing.pl";
  const customNote = sender?.customNote || null;
  const initials = authorName.trim() ? authorName.trim().charAt(0).toUpperCase() : "%";

  const pricing = resolvePricingPresentation(offer.pricingRange, offer.ctaText);

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

  return `<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Strategia & Oferta dla ${lead.companyName} | Procent Marketing</title>
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

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            padding: 0 20px;
        }

        .container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 60px 0;
        }

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
            color: var(--text-secondary);
        }

        .hero {
            text-align: center;
            margin-bottom: 70px;
        }

        .hero h1 {
            font-size: 2.75rem;
            font-weight: 800;
            line-height: 1.2;
            margin-bottom: 24px;
            letter-spacing: -1px;
        }

        .hero-lead-name {
            color: var(--accent);
            text-shadow: 0 0 20px var(--accent-glow);
        }

        .hero p {
            font-size: 1.15rem;
            color: var(--text-secondary);
            max-width: 780px;
            margin: 0 auto;
        }

        .section-title {
            font-size: 1.6rem;
            font-weight: 800;
            margin-bottom: 30px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .section-title::before {
            content: '';
            display: inline-block;
            width: 4px;
            height: 24px;
            background-color: var(--accent);
            border-radius: 2px;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 60px;
        }

        .card {
            background-color: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: 14px;
            padding: 24px;
            backdrop-filter: blur(10px);
            transition: all 0.2s ease;
        }

        .card:hover {
            border-color: rgba(255, 230, 0, 0.4);
            transform: translateY(-2px);
        }

        .card-icon {
            font-size: 1.8rem;
            margin-bottom: 16px;
        }

        .card h3 {
            font-size: 1.15rem;
            font-weight: 700;
            margin-bottom: 12px;
        }

        .card p {
            color: var(--text-secondary);
            font-size: 0.95rem;
        }

        .timeline {
            margin-bottom: 60px;
            border-left: 2px solid var(--border-card);
            padding-left: 28px;
            margin-left: 10px;
        }

        .step-item {
            position: relative;
            margin-bottom: 30px;
        }

        .step-number {
            position: absolute;
            left: -40px;
            top: 0;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background-color: var(--accent);
            color: #000;
            font-weight: 800;
            font-size: 0.75rem;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .step-content h3 {
            font-size: 1.1rem;
            font-weight: 700;
            margin-bottom: 6px;
        }

        .step-content p {
            color: var(--text-secondary);
            font-size: 0.95rem;
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
            font-size: 2.75rem;
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

        .cta-btn:hover {
            transform: scale(1.02);
            background-color: #fff;
        }

        .author-card {
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: 16px;
            padding: 32px;
            margin-bottom: 60px;
            backdrop-filter: blur(10px);
            display: flex;
            flex-direction: column;
            gap: 18px;
        }

        .author-top {
            display: flex;
            align-items: center;
            gap: 18px;
        }

        .author-avatar {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--accent) 0%, #D4AF37 100%);
            color: #0A0C10;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.4rem;
            font-weight: 900;
            flex-shrink: 0;
            box-shadow: 0 0 15px var(--accent-glow);
        }

        .author-info h4 {
            font-size: 1.15rem;
            font-weight: 800;
            color: var(--text-primary);
            margin-bottom: 4px;
        }

        .author-info p {
            font-size: 0.9rem;
            color: var(--text-secondary);
        }

        .author-note {
            background: rgba(255, 255, 255, 0.03);
            border-left: 3px solid var(--accent);
            padding: 14px 18px;
            border-radius: 6px;
            font-size: 0.95rem;
            color: #D1D5DB;
            font-style: italic;
        }

        .author-contacts {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            padding-top: 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .contact-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-card);
            color: var(--text-primary);
            text-decoration: none;
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            transition: all 0.2s ease;
        }

        .contact-pill:hover {
            border-color: var(--accent);
            color: var(--accent);
            background: rgba(255, 230, 0, 0.05);
        }

        footer {
            border-top: 1px solid var(--border-card);
            padding-top: 40px;
            font-size: 0.85rem;
            color: var(--text-secondary);
            text-align: center;
            line-height: 1.8;
        }

        @media (max-width: 768px) {
            .hero h1 { font-size: 2rem; }
            .grid { grid-template-columns: 1fr; }
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
            <h1>${offer.heroHeadline.replace(lead.companyName, `<span class="hero-lead-name">${lead.companyName}</span>`)}</h1>
            <p>${offer.heroObservation}</p>
        </section>

        <section>
            <h2 class="section-title">Co zauważyliśmy podczas audytu</h2>
            <div class="grid">
                ${observationsHtml}
            </div>
        </section>

        <section>
            <h2 class="section-title">Proponowane moduły wdrożenia</h2>
            <div class="grid">
                ${modulesHtml}
            </div>
        </section>

        <section>
            <h2 class="section-title">Etapy współpracy</h2>
            <div class="timeline">
                ${stepsHtml}
            </div>
        </section>

        <section class="pricing-box">
            <div class="pricing-tag">${pricing.tag}</div>
            <div class="price-amount">${pricing.amount}</div>
            <p style="color: var(--text-secondary); margin-bottom: 30px; max-width: 500px; margin-left: auto; margin-right: auto;">
                ${pricing.description}
            </p>
            <a href="${effectiveBookingUrl}" target="_blank" class="cta-btn">${pricing.cta} →</a>
        </section>

        <section class="author-card">
            <div class="author-top">
                <div class="author-avatar">${initials}</div>
                <div class="author-info">
                    <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent); font-weight: 700; margin-bottom: 2px;">
                        Ofertę przygotował(a):
                    </div>
                    <h4>${authorName}</h4>
                    <p>${authorRole} · <strong style="color: var(--text-primary);">${companyName}</strong></p>
                </div>
            </div>
            ${customNote ? `<div class="author-note">"${customNote}"</div>` : ''}
            <div class="author-contacts">
                ${authorEmail ? `<a href="mailto:${authorEmail}" class="contact-pill">📧 ${authorEmail}</a>` : ''}
                ${authorPhone ? `<a href="tel:${authorPhone}" class="contact-pill">📞 ${authorPhone}</a>` : ''}
                ${authorWebsite ? `<a href="${authorWebsite.startsWith('http') ? authorWebsite : 'https://' + authorWebsite}" target="_blank" class="contact-pill">🌐 ${authorWebsite.replace(/^https?:\/\//, '')}</a>` : ''}
                <a href="${effectiveBookingUrl}" target="_blank" class="contact-pill" style="border-color: var(--accent); color: var(--accent); margin-left: auto;">
                    📅 ${offer.ctaText}
                </a>
            </div>
        </section>

        <footer>
            <p><strong>${companyName}</strong> ${authorEmail ? `| ${authorEmail}` : ''} ${authorPhone ? `| ${authorPhone}` : ''}</p>
            <p style="font-size: 0.75rem; margin-top: 10px;">
                Dokument wygenerowany w oparciu o publiczne dane i audyt technologiczny. Klauzula informacyjna RODO: ${authorWebsite ? `${authorWebsite.replace(/\/$/, '')}/rodo` : 'procentmarketing.pl/rodo'}
            </p>
        </footer>
    </div>
</body>
</html>`;
}
