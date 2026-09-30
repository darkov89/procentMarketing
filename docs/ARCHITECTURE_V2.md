# Architektura Systemu Lead Machine 2.0 (ARCHITECTURE_V2.md)

Dokument opisuje stan docelowy architektury produkcyjnej **Lead Machine (Procent Marketing)** po udanej transformacji z prototypu Python do pełnoskalowej aplikacji TypeScript/Next.js/Neon Postgres.

---

## 1. Stos Technologiczny

- **Frontend & Backend**: Next.js 16 (App Router, Turbopack, React 19).
- **Baza danych**: Neon Serverless PostgreSQL (Drizzle ORM).
- **Autentykacja**: System zaproszeń (Invite-Only) z bezpiecznymi sesjami w ciasteczkach `pm_session_token` i hashowaniem `scrypt`.
- **Integracje AI**: Google Gemini API (`@google/genai`) z restrykcyjnymi promptami anty-iniekcyjnymi (`<untrusted_scraped_data>`).
- **Poczta**: Nodemailer (SMTP) + ImapFlow / Mailparser (IMAP).
- **Zadania w tle**: PostgreSQL-backed job queue (`jobs` table z `FOR UPDATE SKIP LOCKED`).

---

## 2. Siedem Nienaruszalnych Inwariantów Architektonicznych

System implementuje 7 twardych inwariantów, z których każdy jest pokryty testami automatycznymi:

### Inwariant 1: Zero zmyślonych danych (Anti-Hallucination & Fixture Isolation)
- Wszystkie dane firm (nazwa, NIP, adres, telefon, strona) pochodzą wyłącznie z oficjalnych rejestrów (CEIDG/KRS) lub bezpośredniego scrapowania stron www.
- Całkowity zakaz i brak syntetycznych generatorów fałszywych NIP-ów czy fikcyjnych firm.
- Leady testowe (`is_fixture = true`) posiadają twardą blokadę wysyłki w silniku `sendMessage()`.

### Inwariant 2: Pojedyncza bezpieczna ścieżka wysyłki (`sendMessage(messageId)`)
Każda wychodząca wiadomość e-mail musi przejść przez jedną centralną funkcję `sendMessage(messageId)` w `send-service.ts`, która bezwzględnie egzekwuje 16 sekwencyjnych kontroli:
1. Istnienie rekordu wiadomości i powiązanego leada.
2. Blokada rekordów testowych (`is_fixture == true`).
3. Weryfikacja Kill Switch (plik `STOP` na dysku lub flaga w bazie).
4. Weryfikacja `LIVE_MODE` (w trybie testowym bezpieczne przekierowanie na `TEST_RECIPIENTS` z prefiksem `[TEST]`).
5. Poprawność podstawy kontaktu (`contact_basis`).
6. Dozwolony status leada (`approved`, `in_sequence`) oraz blokada stanów końcowych (`unsubscribed`, `lost`, `bounced`).
7. Limit sekwencji (max 4 wiadomości łącznie / max 3 follow-upy).
8. Weryfikacja listy `suppression` (e-mail, domena, NIP, telefon z haszowaniem SHA-256).
9. Weryfikacja polskiego okna wysyłkowego (pn–pt 08:30–16:00, bez świąt ustawowych).
10. Dzienny limit wysyłek oraz limity ramp-up.
11. Generowanie unikalnego klucza idempotencji (`idempotency_key`).
12. Atomowe zajęcie wiadomości w bazie (`status = 'sending'`).
13. Fizyczna wysyłka SMTP przez Nodemailer.
14. Obsługa błędów SMTP z wykładniczym backoffem ponowień.
15. Zapis statusu `sent` wyłącznie po fizycznym potwierdzeniu przez serwer SMTP.
16. Niezmienne logowanie audytowe do tabeli `lead_events`.

### Inwariant 3: Pojedyncza ścieżka zmiany stanu leada (`transitionLead()`)
- Żaden moduł nie modyfikuje statusu leada bezpośrednim zapytaniem SQL.
- Każda zmiana przechodzi przez funkcję `transitionLead()` w `state-machine.ts`.
- Dozwolone przejścia definiuje macierz `ALLOWED_TRANSITIONS`.
- Wszystkie przejścia są natychmiast rejestrowane w tabeli `lead_events` z podaniem aktora, poprzedniego stanu, nowego stanu i uzasadnienia.

### Inwariant 4: Ochrona uwierzytelniania na każdej trasie API (`requireUser()`)
- Wszystkie endpointy w `app/api/**` oraz Server Actions są chronione funkcją `requireUser()`.
- Próba dostępu bez ważnej sesji natychmiast zwraca HTTP 401 Unauthorized.
- Zautomatyzowany skaner bezpieczeństwa (`tests/api-auth-scanner.test.ts`) weryfikuje w potoku CI brak niechronionych tras.

### Inwariant 5: Oferty oparte wyłącznie na dowodach i katalogu usług
- Każda wygenerowana oferta w `offers` wiąże proponowane moduły z konkretnymi identyfikatorami dowodów w tabeli `evidence` (`evidence_ids`).
- Proponowane pakiety i widełki cenowe pochodzą ze zdefiniowanego katalogu `service_catalog` (np. `seo_local`, `landing_page`, `analytics_ga4`, `google_ads`).

### Inwariant 6: Bezpieczny audytor stron www (Zero Fake Audits & SSRF Guard)
- Audytor stron w `auditor.ts` weryfikuje bezpieczeństwo adresu funkcją `isSafeUrl()` (ochrona przed SSRF: blokada localhost, 127.0.0.1, 169.254.x.x, sieci prywatnych RFC 1918).
- W przypadku błędu pobierania strony audytor rzuca `AuditFetchError`, a lead otrzymuje status `audit_failed`. Zakaz wymyślania fałszywych audytów WordPress czy zgadywania maili.

### Inwariant 7: Twardy limit 3 follow-upów (Max 4 wiadomości)
- Cykl outreachu leada składa się maksymalnie z: Wiadomości 1 (inicjalnej) + Follow-up 1 (+3 dni robocze) + Follow-up 2 (+5 dni roboczych) + Follow-up 3 (+7 dni roboczych).
- Wiadomości o kroku sekwencji $> 3$ są twardo odrzucane przez bazę i silnik wysyłkowy.
- Po 7 dniach roboczych ciszy od Follow-up 3 lead przechodzi do stanu `lost` (`lost_reason: "followup_exhausted"`) i wchodzi w 90-dniowy cooldown.

---

## 3. Serwowanie Dedykowanych Stron Ofertowych (`/o/[token]`)

Zgodnie z wymaganiami produkcyjnymi wyeliminowano zewnętrzne zależności (Netlify):
- **Adres**: `https://procentmarketing.pl/o/[token]`
- **Bezpieczeństwo**: losowy, nieodgadniony token o długości $\ge 22$ znaków (32-znakowy random hex).
- **SEO & Prywatność**: każda strona oferty renderuje `<meta name="robots" content="noindex, nofollow">` oraz nagłówek HTTP `X-Robots-Tag: noindex`.
- **Ważność**: oferta posiada 60-dniowy okres ważności (`expiresAt`); po upływie terminu wyświetlana jest informacja o wygaśnięciu propozycji.

---

## 4. Polski Kalendarz i Okno Wysyłkowe (`polish-calendar.ts`)

- **Strefa czasowa**: automatyczna konwersja do `Europe/Warsaw` (uwzględniająca czas letni CEST i zimowy CET).
- **Okno wysyłki**: poniedziałek – piątek, godz. 08:30 – 16:00 czasu polskiego.
- **Święta ruchome**: algorytm Meeusa/Jonesa/Butchera oblicza Wielkanoc, Poniedziałek Wielkanocny, Boże Ciało i Zielone Świątki dla dowolnego roku.
- **Dni robocze**: funkcja `addPolishBusinessDays()` przeskakuje weekendy oraz wszystkie ustawowe dni wolne od pracy w Polsce.

---

## 5. Baza Danych i Model Relacyjny

Tabela stanów i relacji:
- `leads`: centralna encja leada (`status`, `sequence_step`, `next_action_at`, `lost_reason`, `cooldown_until`, `contact_basis`, `is_fixture`).
- `audits`: wyniki audytu technologicznego strony www.
- `evidence`: dowody faktów i twierdzeń wykorzystywanych w ofertach.
- `service_catalog`: oficjalny cennik i pakiety usług agencji.
- `offers`: oferty ze zindywidualizowanymi tokenami `/o/[token]`.
- `messages`: wiadomości wychodzące i przychodzące z `idempotency_key` i `sequence_step`.
- `suppression`: globalna lista wypisanych podmiotów (hasze SHA-256 e-maila, telefonu, NIP-u i domeny).
- `lead_events`: niezmienna historia każdego zdarzenia i zmiany statusu leada.
- `jobs`: kolejka asynchronicznych zadań w tle (`audit_lead`, `qualify_lead`, `generate_offer`, `send_scheduled_message`, `poll_inbox`, `process_followups`).
- `users`, `sessions`, `invitations`: invite-only system uwierzytelniania.
