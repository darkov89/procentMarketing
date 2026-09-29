import * as cheerio from "cheerio";

export interface AuditResult {
  sslValid: boolean;
  isResponsive: boolean;
  cmsDetected: string | null;
  copyrightYear: number | null;
  hasGa4: boolean;
  hasGtm: boolean;
  hasMetaPixel: boolean;
  hasContactForm: boolean;
  hasOnlineBooking: boolean;
  hasLiveChat: boolean;
  socialLinks: Record<string, string>;
  emailsScraped: string[];
  metaAdsActive: boolean;
  rawEvidence: Record<string, any>;
}

export async function auditWebsite(targetUrl: string): Promise<AuditResult> {
  let url = targetUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  const evidence: Record<string, any> = {};
  let sslValid = false;
  let html = "";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 (ProcentMarketing-Auditor/2.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    clearTimeout(timeoutId);
    sslValid = res.url.startsWith("https://");
    html = await res.text();
  } catch (err: any) {
    // If https failed, try http fallback
    if (url.startsWith("https://")) {
      try {
        const httpUrl = url.replace("https://", "http://");
        const res = await fetch(httpUrl, {
          headers: {
            "User-Agent": "ProcentMarketing-Auditor/2.0",
          },
        });
        sslValid = false;
        html = await res.text();
      } catch {
        // Failed completely
      }
    }
  }

  if (!html) {
    return {
      sslValid: false,
      isResponsive: false,
      cmsDetected: null,
      copyrightYear: null,
      hasGa4: false,
      hasGtm: false,
      hasMetaPixel: false,
      hasContactForm: false,
      hasOnlineBooking: false,
      hasLiveChat: false,
      socialLinks: {},
      emailsScraped: [],
      metaAdsActive: false,
      rawEvidence: { error: "Nie udało się połączyć ze stroną WWW" },
    };
  }

  const $ = cheerio.load(html);
  const textContent = html.toLowerCase();

  // 1. Mobile Responsiveness
  const viewport = $('meta[name="viewport"]').attr("content");
  const isResponsive = Boolean(
    viewport && viewport.toLowerCase().includes("width=device-width")
  );
  if (isResponsive) evidence["viewport"] = viewport;

  // 2. CMS Detection
  let cmsDetected: string | null = null;
  const generator = $('meta[name="generator"]').attr("content") || "";
  if (generator.toLowerCase().includes("wordpress") || textContent.includes("wp-content")) {
    cmsDetected = "WordPress";
  } else if (generator.toLowerCase().includes("wix") || textContent.includes("wix.com")) {
    cmsDetected = "Wix";
  } else if (generator.toLowerCase().includes("webflow") || textContent.includes("webflow")) {
    cmsDetected = "Webflow";
  } else if (generator.toLowerCase().includes("shopify") || textContent.includes("shopify")) {
    cmsDetected = "Shopify";
  } else if (generator.toLowerCase().includes("prestashop") || textContent.includes("prestashop")) {
    cmsDetected = "PrestaShop";
  } else if (generator.toLowerCase().includes("squarespace")) {
    cmsDetected = "Squarespace";
  }
  if (cmsDetected) evidence["cms"] = cmsDetected;

  // 3. Analytics & Tracking
  const hasGa4 =
    /G-[A-Z0-9]{6,12}/.test(html) ||
    textContent.includes("gtag('config'") ||
    textContent.includes("google-analytics.com/g/collect");
  if (hasGa4) evidence["ga4"] = "detected";

  const hasGtm =
    /GTM-[A-Z0-9]{4,10}/.test(html) || textContent.includes("googletagmanager.com/gtm.js");
  if (hasGtm) evidence["gtm"] = "detected";

  const hasMetaPixel =
    textContent.includes("connect.facebook.net") ||
    textContent.includes("fbq('init'") ||
    textContent.includes("fbevents.js");
  if (hasMetaPixel) evidence["meta_pixel"] = "detected";

  // 4. Conversion & Interaction Tools
  const hasContactForm =
    $("form").length > 0 &&
    ($('input[type="email"]').length > 0 ||
      $('textarea').length > 0 ||
      textContent.includes("wpcf7") ||
      textContent.includes("formularz"));
  if (hasContactForm) evidence["contact_form"] = true;

  const hasOnlineBooking =
    textContent.includes("booksy.com") ||
    textContent.includes("calendly.com") ||
    textContent.includes("znanylekarz.pl") ||
    textContent.includes("zarezerwuj") ||
    textContent.includes("bookero") ||
    textContent.includes("cal.com");
  if (hasOnlineBooking) evidence["online_booking"] = true;

  const hasLiveChat =
    textContent.includes("tawk.to") ||
    textContent.includes("livechat") ||
    textContent.includes("smartsupp") ||
    textContent.includes("crisp.chat") ||
    textContent.includes("tidio");
  if (hasLiveChat) evidence["live_chat"] = true;

  // 5. Scrape Business Profile ("Co robi firma" - title, meta description, headings, services)
  const pageTitle = $("title").text().trim().replace(/\s+/g, " ");
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim().replace(/\s+/g, " ") ||
    $('meta[property="og:description"]').attr("content")?.trim().replace(/\s+/g, " ") ||
    "";

  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().trim().replace(/\s+/g, " ");
    if (text && text.length > 4 && text.length < 120 && !headings.includes(text)) {
      headings.push(text);
    }
  });

  let sampleParagraphs = "";
  $("p").each((_, el) => {
    const p = $(el).text().trim().replace(/\s+/g, " ");
    if (
      p.length > 40 &&
      p.length < 350 &&
      (p.toLowerCase().includes("oferuj") ||
        p.toLowerCase().includes("usług") ||
        p.toLowerCase().includes("zajmujemy") ||
        p.toLowerCase().includes("specjaliz") ||
        p.toLowerCase().includes("dostarcz") ||
        p.toLowerCase().includes("montaż") ||
        p.toLowerCase().includes("serwis") ||
        p.toLowerCase().includes("napraw") ||
        p.toLowerCase().includes("klient") ||
        p.toLowerCase().includes("doświadcz"))
    ) {
      if (!sampleParagraphs) sampleParagraphs = p;
    }
  });

  const businessActivity =
    metaDescription ||
    sampleParagraphs ||
    (headings.length > 0 ? `Specjalizacja i oferta: ${headings.slice(0, 4).join(", ")}` : pageTitle);

  evidence["pageTitle"] = pageTitle;
  evidence["metaDescription"] = metaDescription;
  evidence["headings"] = headings.slice(0, 8);
  evidence["businessActivity"] = businessActivity;

  // 6. Scrape Emails (Homepage + Deep Contact subpage lookup)
  const emailsSet = new Set<string>();
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const email = href.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
    if (email && email.includes("@")) emailsSet.add(email);
  });

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(emailRegex) || [];
  for (const m of matches) {
    const clean = m.toLowerCase();
    if (!clean.endsWith(".png") && !clean.endsWith(".jpg") && !clean.includes("sentry") && !clean.includes("wix")) {
      emailsSet.add(clean);
    }
  }

  // Deep Email Scraping: If no email on homepage, check /kontakt or contact link
  if (emailsSet.size === 0) {
    let contactHref = $('a[href*="kontakt"], a[href*="contact"]').first().attr("href");
    let contactTarget = "";
    if (contactHref) {
      if (contactHref.startsWith("http")) {
        contactTarget = contactHref;
      } else {
        try {
          contactTarget = new URL(contactHref, url).toString();
        } catch {}
      }
    } else {
      try {
        contactTarget = new URL("/kontakt", url).toString();
      } catch {}
    }

    if (contactTarget) {
      try {
        const cController = new AbortController();
        const cTimeout = setTimeout(() => cController.abort(), 4000);
        const cRes = await fetch(contactTarget, {
          signal: cController.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 (ProcentMarketing-Auditor/2.0)",
          },
        });
        clearTimeout(cTimeout);
        if (cRes.ok) {
          const cHtml = await cRes.text();
          const c$ = cheerio.load(cHtml);
          c$('a[href^="mailto:"]').each((_, el) => {
            const href = c$(el).attr("href") || "";
            const email = href.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
            if (email && email.includes("@")) emailsSet.add(email);
          });
          const cMatches = cHtml.match(emailRegex) || [];
          for (const m of cMatches) {
            const clean = m.toLowerCase();
            if (
              !clean.endsWith(".png") &&
              !clean.endsWith(".jpg") &&
              !clean.includes("sentry") &&
              !clean.includes("wix")
            ) {
              emailsSet.add(clean);
            }
          }
        }
      } catch {}
    }
  }

  // 7. Social Links
  const socialLinks: Record<string, string> = {};
  $('a[href]').each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.includes("facebook.com/") && !socialLinks.facebook) socialLinks.facebook = href;
    if (href.includes("instagram.com/") && !socialLinks.instagram) socialLinks.instagram = href;
    if (href.includes("linkedin.com/") && !socialLinks.linkedin) socialLinks.linkedin = href;
  });

  // 8. Copyright Year
  let copyrightYear: number | null = null;
  const copyMatch = html.match(/©\s*(20[12]\d)/);
  if (copyMatch) {
    copyrightYear = parseInt(copyMatch[1], 10);
  }

  return {
    sslValid,
    isResponsive,
    cmsDetected,
    copyrightYear,
    hasGa4,
    hasGtm,
    hasMetaPixel,
    hasContactForm,
    hasOnlineBooking,
    hasLiveChat,
    socialLinks,
    emailsScraped: Array.from(emailsSet).slice(0, 5),
    metaAdsActive: hasMetaPixel,
    rawEvidence: evidence,
  };
}
