# Lead Machine — Procent Marketing 2.0 (Architecture V2)

Autonomiczny, wielotenantowy system B2B dla agencji **Procent Marketing** oraz partnerów (np. Fundacja Szumi Las), automatyzujący proces discovery lokalnych podmiotów, weryfikację dowodową, audyt technologiczny, dynamiczne strony ofertowe `/o/[token]`, personalizowany outreach e-mail z ochroną reputacji oraz zarządzanie pipeline'em sprzedaży i sponsoringu.

---

## Stos Technologiczny

- **Frontend & API**: Next.js 16 (App Router, React 19, Turbopack, Tailwind CSS).
- **Baza Danych**: Neon PostgreSQL (Serverless, Row-Level Security, multi-tenant).
- **ORM & Migracje**: Drizzle ORM z Drizzle Kit.
- **Kolejka Zadań & Fair-Share**: PostgreSQL `FOR UPDATE SKIP LOCKED` (`PostgresJobQueue`).
- **Modele LLM & Audyt**: Google Gemini API (`@google/genai`) z blokiem `<untrusted_scraped_data>` i ochroną przed prompt injection.
- **Poczta & Dostarczalność**: Nodemailer (SMTP z rozgrzewką i limitami godzinowymi/dziennymi), ImapFlow (IMAP inbox poller i klasyfikacja intencji), autoweryfikacja rekordów DNS (SPF, DKIM, DMARC).

---

## Szybki Start

### 1. Wymagania i instalacja

- Node.js 22+
- npm 10+
- Instancja Neon PostgreSQL z `DATABASE_URL`

```bash
cd web
npm install
cp ../.env.example .env.local
```

### 2. Dostępne Skrypty

```bash
# Uruchomienie deweloperskie
npm run dev

# Kompilacja produkcyjna z weryfikacją stron
npm run build

# Uruchomienie pełnego zestawu testów integracyjnych (108 testów)
npm test

# Sprawdzenie typowania TypeScript (zero tolerancji dla błędów)
npx tsc --noEmit

# Statyczna analiza kodu ESLint
npm run lint

# Idempotentny provisioning tenanta Fundacji Szumi Las (Brief 29.09.2026)
npx tsx --env-file=.env.local scripts/seed-szumi-las.ts
```

---

## Architektura i Bezpieczeństwo (Siedem Nienaruszalnych Inwariantów)

System chroniony jest przez 7 nienaruszalnych inwariantów architektonicznych:

1. **Inwariant 1 (Anti-hallucination & Fixture Isolation)**: Leady testowe (`is_fixture=true`) oraz fikcyjne podmioty nigdy nie trafiają do serwera SMTP.
2. **Inwariant 2 (Single SMTP Send Path)**: Wszystkie wysyłki przechodzą przez `sendMessage(messageId)` w `send-service.ts` (16 kolejnych kontroli bezpieczeństwa).
3. **Inwariant 3 (Single State Transition Path)**: Wszystkie zmiany statusu leada odbywają się wyłącznie przez `transitionLead()` w `state-machine.ts` z audytem w `lead_events`.
4. **Inwariant 4 (API Auth Guard)**: Każdy endpoint API i Server Action posiada strażnika `requireUser()` (weryfikowane przez automatyczny skaner `tests/api-auth-scanner.test.ts`).
5. **Inwariant 5 (Evidence-backed Claims & Service Catalog)**: Twierdzenia ofertowe odwołują się do zweryfikowanych dowodów (`evidence_ids`) i katalogu usług `service_catalog`.
6. **Inwariant 6 (Safe Web Auditor)**: Audytor stron WWW posiada ochronę SSRF (`isSafeUrl`) i w razie błędu oznacza stan `audit_failed` (zakaz fikcyjnych audytów i zgadywania e-maili).
7. **Inwariant 7 (Follow-up Limit)**: Twardy limit maksymalnie 3 follow-upów (maksymalnie 4 wiadomości łącznie na lead). Po 7 dniach ciszy od FU3 lead przechodzi w stan `lost` (`followup_exhausted`).

---

## Moduły Opcjonalne i Presety

- **`agency_sales` (Domyślny dla Procent Marketing)**: Tradycyjny lejek agencji marketingowej: discovery Google Places, audyt WWW, dedykowana oferta `/o/[token]` z wyceną pakietową PLN oraz sekwencja do 3 follow-upów.
- **`sponsorship_fundraising` (Dedykowany dla Fundacji Szumi Las)**: Tryb pozyskiwania sponsorów B2B: brak audytu WWW i ofert ze stroną, priorytety CSR 1-3 oparte na dowodach, partia 20 podmiotów zatwierdzana przez Dawida, zadania telefoniczne pod warunkiem zgody PKE, a deklarowane wpłaty zatwierdzane przez Anię (`confirm_payment`).

---

## Wsparcie Techniczne RODO (GDPR)

- **Art. 15 RODO (Prawo dostępu)**: `GET /api/gdpr/export?email=...` lub `?leadId=...` — eksportuje pełny zrzut danych leada, kontaktów, zgód i korespondencji.
- **Art. 17 RODO (Prawo do bycia zapomnianym)**: `POST /api/gdpr/erase` — anonimizuje dane leada i kontaktów, anuluje zadania, oraz zapisuje nieodwracalny skrót SHA-256 w tabeli `blocks`, trwale uniemożliwiając ponowną wysyłkę.
- **Art. 5 ust. 1 lit. c RODO (Minimalizacja danych)**: Job kolejki `cleanup` usuwa z bazy stare surowe zrzuty dowodów dla zamkniętych procesów po upływie okresu retencji (domyślnie 90 dni).

---

## Dokumentacja

- [`docs/PLAN.md`](./docs/PLAN.md) — Szczegółowy plan transformacji i specyfikacja wszystkich 10 faz.
- [`docs/ARCHITECTURE_V2.md`](./docs/ARCHITECTURE_V2.md) — Architektura modularna 2.0 i model danych.
- [`docs/RUNBOOK.md`](./docs/RUNBOOK.md) — Instrukcja codziennej obsługi operacyjnej ($\le 30$ min/dzień).
- [`docs/GO_LIVE_CHECKLIST.md`](./docs/GO_LIVE_CHECKLIST.md) — Procedura uruchomienia produkcyjnego.
- [`docs/COMPLIANCE.md`](./docs/COMPLIANCE.md) — Rejestr zgodności prawnej i pytań do IOD.
