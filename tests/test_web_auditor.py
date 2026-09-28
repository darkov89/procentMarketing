"""Tests for WebAuditor extracting factual signals and evidence."""

from leadmachine.audit.web_auditor import AuditResult, WebAuditor


def test_analyze_html_signals_and_evidence():
    auditor = WebAuditor()
    sample_html = """
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Klinika Medyczna Legnica</title>
        <!-- Google Analytics 4 -->
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC1234567"></script>
        <!-- Meta Pixel Code -->
        <script>fbq('init', '1234567890');</script>
    </head>
    <body>
        <header>
            <a href="https://facebook.com/klinikalegnica">Facebook</a>
            <a href="https://instagram.com/klinikalegnica">Instagram</a>
        </header>
        <main>
            <h1>Nowoczesna opieka medyczna</h1>
            <!-- Online booking link -->
            <a href="https://booksy.com/pl-pl/123-klinika">Zarezerwuj wizytę przez Booksy</a>
            <!-- Contact Form -->
            <form action="/contact" method="POST">
                <input type="text" name="name" placeholder="Twoje imię">
                <input type="email" name="email" placeholder="Twój e-mail">
                <textarea name="msg"></textarea>
                <button type="submit">Wyślij</button>
            </form>
        </main>
        <footer>
            <p>Kontakt: rejestracja@klinika-legnica.pl</p>
            <p>© 2021-2023 Klinika Medyczna Legnica. Wszelkie prawa zastrzeżone.</p>
        </footer>
    </body>
    </html>
    """

    res = AuditResult(website_url="https://klinika-legnica.pl", ssl_valid=True)
    auditor._analyze_html(sample_html, "https://klinika-legnica.pl", res)

    # 1. Responsiveness
    assert res.is_responsive is True
    assert "is_responsive" in res.evidence

    # 2. Tracking tags
    assert res.has_ga4 is True
    assert res.evidence["has_ga4"]["tag"] == "G-ABC1234567"
    assert res.has_meta_pixel is True
    assert "has_meta_pixel" in res.evidence

    # 3. Conversion elements
    assert res.has_online_booking is True
    assert res.evidence["has_online_booking"]["keyword"] == "booksy"
    assert res.has_contact_form is True
    assert "has_contact_form" in res.evidence

    # 4. Copyright & Email
    assert res.copyright_year == 2023
    assert res.evidence["copyright_year"]["matched_year"] == 2023
    assert "rejestracja@klinika-legnica.pl" in res.emails_scraped
    assert "rejestracja@klinika-legnica.pl" in res.evidence["emails_scraped"]

    # 5. Social links
    assert "facebook" in res.social_links
    assert "instagram" in res.social_links
