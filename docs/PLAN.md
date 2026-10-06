# PLAN v2: Lead Machine → platforma multitenant z playbookami kampanii

> **Jak czytać ten plik.** Sekcje A-F poniżej to **korekta v2** powstała po raporcie agenta z lokalnego repo (część kodu nie była jeszcze na gicie, więc pierwsza wersja planu jej nie widziała). **W razie sprzeczności korekta v2 ma pierwszeństwo** przed częścią "PLAN BAZOWY" (od sekcji 0 niżej). Fazy 3-10 planu bazowego obowiązują bez zmian, poza wyjątkami z sekcji D.
> Wszystko, co raport agenta twierdzi o istnieniu kodu (`lead_tasks`, `lead_deals`, `pke*`, `seed-szumi-las.ts`), jest **twierdzeniem do zweryfikowania**, nie faktem. Przeglądający plan nie widział tego kodu.

---

## A. Zasada nr 1 przed jakąkolwiek zmianą: zabezpiecz niezacommitowany kod

Zadanie **0.0 (nowe, blokujące):**

1. Agent pokazuje `git status` i `git diff --stat`. Człowiek potwierdza, że to jest całość lokalnej pracy.
2. Commit całości na branch `wip/szumi-las-snapshot` i push. **Bez porządkowania, bez refaktoru, bez usuwania.** Cel to wyłącznie wersjonowanie.
3. Tag `snapshot-pre-plan`. Od tego momentu gałąź `main` jest bazą dla faz.
4. Snapshot (branch) bazy Neon `snapshot-pre-plan` przed jakąkolwiek migracją.

Dopiero po tym rusza rekonesans. Żadna faza nie zaczyna się na brudnym drzewie roboczym.

---

## B. Mapa: co już istnieje → gdzie ląduje w architekturze docelowej

Zasada: **ewoluujemy istniejące tabele i serwisy, nie tworzymy równoległych.** Dla każdej pozycji agent najpierw sprawdza, czy twierdzenie z raportu jest prawdziwe.

| Istniejące (wg raportu) | Decyzja | Szczegóły |
|---|---|---|
| `tenants.enabled_modules` | **Zostaje** jako dostępność funkcji dla tenanta (feature gating) | `playbook.modules` to aktywacja w kampanii. Efektywnie: moduł działa, gdy włączony **w obu** miejscach. |
| `compliancePke` (flaga modułu) | Zostaje jako gating | Reguły (kto, kiedy, jaki dowód) przechodzą do `playbook.channels`. |
| `leads.pkeEmailStatus`, `leads.pkePhoneStatus` | **Migracja do `channel_permissions`** (per kontakt i kanał) | Wartości mapowane na `yes / no / to_check`. Brak statusu = `to_check`. Kolumny oznaczone jako deprecated (tylko odczyt) do Fazy 9, potem drop. Agent sprawdza, czy są pola: uzasadnienie, źródło/dowód zgody, osoba zatwierdzająca, data. Brakujące dodaje. |
| `leads.csrPriority`, `evidenceUrl`, `evidenceDate` | **Migracja** | Priorytet → `campaign_leads.priority`. Dowód → wiersz w `evidence` (url, `published_at`, `retrieved_at`, cytat gdy jest). Pusta data zostaje `NULL`. |
| `lead_tasks` | **Ewoluuje w `tasks`** (rename lub rozszerzenie, bez drugiej tabeli) | Dodać: `campaign_lead_id`, `type`, `assignee_user_id`, `blocked_reason`. Statusy: `completed→done`, `rescheduled→snoozed`, `no_answer` jako wynik (`result`), `blocked` zostaje. |
| `lead-tasks-service.ts` (telefon po 2 dniach roboczych) | **Staje się krokiem `create_task` silnika sekwencji** | Liczba dni z playbooka (`wait.businessDays`), nie z kodu. Kalendarz (`polish-calendar.ts`) bez zmian. |
| `lead_deals` | **Ewoluuje w `outcomes`** | `doublePrecision` → `bigint` w groszach + `currency`. Migracja: `ROUND(kwota*100)`; **raport wartości z więcej niż 2 miejscami po przecinku** przed konwersją. Zachować audyt potwierdzenia wpłaty. |
| `polish-calendar.ts` | **Bez zmian**, ponownie używany | Test A6 z Fazy 9 opiera się na nim. |
| `send-service.ts` (16 kontroli) | **Zachować**, rozszerzyć (Faza 2.4) | Sztywny limit 3 follow-upów zastąpić limitem z playbooka. `LIVE_MODE` z env → `campaign.test_mode`. |
| `/api/tenants/switch` | **Zachować po weryfikacji** | Musi akceptować tylko tenantów, w których użytkownik ma aktywne członkostwo. Nigdy fallback. Test: próba przełączenia na obcego tenanta daje 403. |
| `web/scripts/seed-szumi-las.ts` | **Przepisać po Fazie 2** | Seed ma korzystać z presetu `sponsorship_fundraising`, nie z zaszytych wartości. Dane firm w seedzie **muszą mieć `is_fixture = true`** i nie mogą trafić do wysyłki (R1, Inwariant 1). |
| `tests/tenant-modules-pke-tasks.test.ts` | **Baza testów odbiorczych A1-A12** | Nie usuwać. Agent mapuje, które scenariusze A* już pokrywa. |
| `tests/api-auth-scanner.test.ts` | Rozszerzyć | Wymóg `requireTenant()` lub `// public` (Faza 1.4). |

---

## C. Decyzje (aktualizacja)

| ID | Stan |
|---|---|
| D1 | **Przyjęte:** `leads` = unikalny podmiot (per tenant), `campaign_leads` = stan procesu. Zgodne z rekomendacją agenta. Do końcowego potwierdzenia przez człowieka przed Fazą 2. |
| D4 | **Potwierdzone koniecznością:** `lead_deals` używa `doublePrecision`. Migracja w Fazie 1.1 (zmiana typu), a przemianowanie na `outcomes` w Fazie 2. |
| D7 (nowa) | `enabled_modules` (tenant) vs `playbook.modules` (kampania): obowiązuje iloczyn logiczny, jak w sekcji B. |
| D8 (nowa) | `lead_tasks` → `tasks` przez rename (zachowuje historię i klucze obce) zamiast nowej tabeli. Agent potwierdza, że nic nie odwołuje się do starej nazwy poza kodem, który zaktualizuje. |

---

## D. Zmiany w fazach względem planu bazowego

### Faza 0 (zmieniona)

Do zadań z planu bazowego dochodzą:

| ID | Zadanie | Kryterium akceptacji |
|---|---|---|
| 0.0 | Zabezpieczenie niezacommitowanego kodu (sekcja A). | Branch, tag i snapshot Neon istnieją. |
| 0.9 | **Rekonesans nowego kodu**, którego nie było w pierwszej analizie: `lead-tasks-service.ts`, `/api/tenants/switch`, endpointy zadań i deali, `seed-szumi-las.ts`. Dla każdego sprawdź: `requireUser`/tenant, filtr `tenant_id`, `tenant_id NOT NULL` w `lead_tasks` i `lead_deals`, brak fallbacków `|| 1`. | Wpis w `docs/RECON.md` z werdyktem. |
| 0.10 | **Weryfikacja twierdzeń z raportu** (lista kontrolna poniżej). | Każdy punkt: potwierdzone / obalone, z numerem linii lub testem. |
| 0.11 | **Zamrożenie `page.tsx`:** od teraz żadnych nowych funkcji w tym pliku (urósł z 7145 do ok. 7327 linii). Nowe ekrany tylko w nowych trasach. Reguła ESLint `max-lines` dla `page.tsx` na obecnym poziomie (nie może rosnąć). | Lint oblewa przy wzroście. |

**Lista kontrolna weryfikacji twierdzeń z raportu** (agent odpowiada na każde, z dowodem):

1. Czy zadanie telefoniczne powstaje **dopiero po udanym wysłaniu** (potwierdzenie SMTP), a nie po zakolejkowaniu lub zatwierdzeniu?
2. Czy zadanie telefoniczne powstaje **wyłącznie gdy telefon jest dopuszczony**; co się dzieje przy `to_check`? (brief: brak odpowiedzi nie jest zgodą)
3. Czy blokada kanału bez dopuszczenia jest egzekwowana **w `sendMessage`**, a nie tylko w UI?
4. Czy błąd lub zwrot maila wstrzymuje zadanie telefoniczne?
5. Czy odpowiedź, odmowa i wypisanie zatrzymują sekwencję i anulują otwarte zadania?
6. Czy ponowny import zachowuje blokady (suppression) i nie wysyła ponownie?
7. Czy tabele `lead_tasks` i `lead_deals` mają `tenant_id NOT NULL` oraz FK?
8. Kto może potwierdzić wpłatę: czy istnieje kontrola uprawnienia (brief: Ania), czy każdy zalogowany użytkownik?
9. Czy dane z `seed-szumi-las.ts` są oznaczone jako fixture i czy test pokazuje, że nie mogą wejść do wysyłki?
10. Czy stan "Brak kontaktu" jest obsługiwany jako pełnoprawny?

### Faza 1 (zmieniona)

Do 1.1 (migracje) dochodzi, jako osobne kroki w kolejności:

- **1.1a** `lead_tasks`, `lead_deals`: `tenant_id NOT NULL` + indeksy (po uzupełnieniu danych).
- **1.1b** `lead_deals.declared_amount`, `paid_amount`: `doublePrecision` → `bigint` (grosze) + kolumna `currency` (domyślnie `PLN`). Najpierw raport kontrolny wartości niecałkowitych groszy, potem konwersja, potem test równości sum przed/po.
- **1.4a** Uprawnienie `confirm_payment` egzekwowane w endpointach deali.

Reszta Fazy 1 (RLS, sekrety, uprawnienia, limity) bez zmian.

### Faza 2 (przebudowana: "ewolucja, nie od zera")

Kolejność kroków (każdy z testem i możliwością wycofania):

1. **2.0 Inwentaryzacja semantyki:** jak dziś działają `pke*`, `csrPriority`, `lead_tasks`, `lead_deals`; spisz stany i przejścia w `docs/CURRENT_STATE.md`.
2. **2.1** `campaigns`, `playbooks`, `playbook_versions`, `campaign_leads`, `batches` + backfill: **jedna domyślna kampania na tenanta**. Dla tenantów z włączonym modułem Szumi Las kampania dostaje preset `sponsorship_fundraising`; dla pozostałych `agency_sales`.
3. **2.2** `channel_permissions` + migracja z `pke*` (z raportem rekordów, które nie dają się jednoznacznie zmapować, do ręcznej oceny, nie zgadywać).
4. **2.3** `lead_tasks` → `tasks` (D8) i podpięcie `lead-tasks-service` jako kroku sekwencji.
5. **2.4** `lead_deals` → `outcomes`.
6. **2.5** `blocks` (rozszerzenie `suppression`), `sequence_runs`, silnik sekwencji.
7. **2.6** Rozszerzenie `sendMessage` (kontrole kampanii, partii, kanału, limit follow-upów z playbooka).
8. **2.7** Adapter zgodności: stary UI (`page.tsx`) nadal czyta dane przez cienką warstwę, dopóki ekran nie zostanie przeniesiony (Faza 8).

**Warunek przejścia dalej:** test regresji pokazuje, że zachowanie istniejących klientów (agencja i Szumi Las) jest identyczne przed i po (te same wyniki na tych samych danych testowych).

### Pozostałe fazy

- **Faza 3:** bez zmian. Raport potwierdza, że brakuje siatki, checkpointów, estymaty kosztów i **programowej weryfikacji cytatów (R11)**. To obowiązkowe.
- **Fazy 4-8, 10:** bez zmian.
- **Faza 9:** seed i testy odbiorcze budujemy na istniejących (`seed-szumi-las.ts`, `tenant-modules-pke-tasks.test.ts`), nie od zera.

---

## E. Kolejność działań

```
0.0 snapshot → 0.1 rekonesans (+0.9, 0.10) → 0.2-0.8 hotfixy → 0.11 zamrożenie page.tsx
→ F1 (drizzle-kit, RLS, sekrety, grosze) → F2 (ewolucja do kampanii/playbooków)
→ F3 → F4/F5/F6 → F7 → F9 → F10        (F8 UI równolegle od F3)
```

---

## F. Pierwszy prompt do wklejenia teraz (Faza 0, wersja v2)

```
Kontekst: repo procentMarketing, katalog web/. Przeczytaj docs/PLAN.md. Sekcje A-F (korekta v2) mają pierwszeństwo przed planem bazowym.

Krok 0.0 (zrób jako pierwszy, nic innego nie zmieniaj):
- Pokaż git status i git diff --stat.
- Po mojej akceptacji: commit CAŁEGO lokalnego stanu na branch wip/szumi-las-snapshot, push, tag snapshot-pre-plan.
- Utwórz branch Neon snapshot-pre-plan (skille w .agents/skills/neon*).
Bez porządkowania i bez usuwania plików.

Krok 0.1, 0.9, 0.10 (rekonesans, tylko odczyt):
- Utwórz docs/RECON.md z werdyktem (potwierdzone / obalone / nowe) dla P1-P16 z planu oraz dla 10 pytań kontrolnych z sekcji D. Przy każdym numer pliku i linii lub nazwa testu.
- Zrób inwentaryzację wszystkich endpointów api/** (requireUser? filtr tenant_id? requireTenant?) i miejsc zmiany statusu leada.
- Nie zakładaj, że twierdzenia z Twojego poprzedniego raportu są prawdziwe. Zweryfikuj w kodzie.
Pokaż mi RECON.md i plan zmian dla 0.2-0.8 i 0.11. Poczekaj na akceptację, zanim zmienisz kod.

Ograniczenia: bez zmian schematu bazy w Fazie 0, bez nowych zależności, bez dopisywania funkcji do src/app/page.tsx.
Na końcu: lint, tsc --noEmit, npm test, raport (zrobione / niezrobione / decyzje do podjęcia).
```

---

# PLAN BAZOWY

> Poniżej plan z pierwszej wersji. Obowiązuje z poprawkami z sekcji A-F powyżej.

# PLAN WDROŻENIA: Lead Machine jako platforma multitenant z playbookami kampanii

> Dokument roboczy dla agenta w Google Antigravity (lub dowolnego agentycznego IDE). Wrzuć do repo jako `docs/PLAN.md` i odwołuj się do niego w promptach. Każda faza ma własny prompt gotowy do wklejenia.
> Zakres kodu: katalog `web/` (Next.js 16, Drizzle, Neon). Katalog `leadmachine/` (Python/Streamlit) to stary prototyp, usuwany w Fazie 10.

---

## 0. Jak pracować z agentem

1. **Jedna faza = jedno zadanie agenta = jeden branch Git = jeden branch Neon.** Nie łącz faz. Faza 0 i 1 muszą być zmergowane, zanim ruszy 2.
2. **Najpierw plan, potem kod.** Każdy prompt zaczyna się od wymogu: agent wypisuje plan zmian (pliki, migracje, ryzyka) i czeka na akceptację, zanim zmieni cokolwiek.
3. **Rekonesans jest obowiązkowy** (sekcja 3). Ten plan powstał z częściowej analizy repo. Agent ma zweryfikować każde twierdzenie z tabeli problemów w kodzie, zanim je naprawi, i zgłosić rozbieżności.
4. **Migracje tylko przez `drizzle-kit`** (od Fazy 1), wyłącznie na branchu Neon. Nigdy bezpośrednio na produkcji. W repo jest `.agents/skills/neon*`: agent ma z nich korzystać do operacji na Neon.
5. **Każda faza kończy się zielonym `npm run lint`, `tsc --noEmit`, `npm test` i raportem**: co zmieniono, czego nie zrobiono, jakie decyzje czekają na człowieka.
6. **Strangler, nie big bang.** Stary `src/app/page.tsx` (7145 linii) działa do końca Fazy 9. Nowe ekrany powstają jako osobne trasy i przejmują funkcje po kolei.
7. **Zero wymyślania.** Jeśli agent nie wie, jak coś działa (np. cennik Google, limity Vercel, warunki Places), ma to sprawdzić w oficjalnej dokumentacji albo zapytać, a nie zgadywać.

---

## 1. Cel produktu

Platforma, na której wiele organizacji (tenantów) prowadzi **kampanie pozyskiwania leadów** według własnego **playbooka**:

- agencja marketingowa: wyszukaj firmy, zweryfikuj, zrób audyt, wygeneruj ofertę, wyślij sekwencję maili,
- fundacja (klient z briefu "Szumi Las"): wyszukaj firmy z dowodem wsparcia dzieci, zatwierdź partię, jeden mail, po 2 dniach zadanie telefoniczne, śledzenie deklaracji i wpłat.

Różnice między klientami są **danymi (playbook)**, nie kodem. Rdzeń bezpieczeństwa jest wspólny i niekonfigurowalny.

---

## 2. Zasady nienaruszalne

### 2.1 Rdzeń (niekonfigurowalny, pokryty testami)

| ID | Zasada |
|---|---|
| R1 | **Brak zmyślonych danych.** Pole bez źródła ma wartość `NULL` i status "do uzupełnienia". Zakaz wartości domyślnych udających dane (np. ocena 4.7, liczba opinii 15, współrzędne środka miasta). Zakaz generowania adresów e-mail i nazwisk. |
| R2 | **Jedna ścieżka wysyłki:** `sendMessage(messageId)`. Żadnego innego miejsca z `nodemailer`. |
| R3 | **Jedna ścieżka zmiany stanu:** `transitionLead()` (po refaktorze: na `campaign_leads`). Żadnych bezpośrednich `UPDATE ... status`. |
| R4 | **Izolacja tenantów dwiema warstwami:** repozytorium wymusza `tenant_id` oraz RLS w Postgresie. Brak fallbacku na "tenant 1". |
| R5 | **Blokady są trwałe.** Odmowa, wypisanie, bounce i wcześniejszy kontakt blokują lead także po ponownym imporcie. Import nigdy nie usuwa ani nie osłabia blokady. |
| R6 | **Suppression sprawdzana tuż przed wysyłką**, nie tylko przy kolejkowaniu. |
| R7 | **Idempotencja wysyłki:** klucz zapisany w transakcji przed fizyczną wysyłką. Jeden mail na firmę w danej kampanii. |
| R8 | **Wysyłka wymaga zatwierdzenia**, jeśli playbook tak mówi, a zmienić to może tylko użytkownik z odpowiednim uprawnieniem. |
| R9 | **Sekrety zaszyfrowane** (AES-256-GCM), nigdy w `process.env` ustawianym w runtime, nigdy w logach ani w odpowiedziach API. |
| R10 | **Treści z zewnątrz są niezaufane.** Strony i odpowiedzi mailowe to dane, nie instrukcje. LLM nie ma narzędzi ani sekretów. |
| R11 | **Każde twierdzenie ma dowód:** URL, data pobrania, cytat. Cytat musi **programowo** wystąpić w pobranym tekście źródła, inaczej twierdzenie jest odrzucane. |
| R12 | **Kill switch i tryb testowy per tenant/kampania**, nie globalnie w env. |

### 2.2 Zachowanie agenta

- Nie dodawaj nowych bibliotek bez uzasadnienia w planie.
- Nie używaj `any`. Walidacja wejść zawsze Zodem. Błędy domenowe jako typowane wyjątki.
- Nie rób bezpośrednich zapytań do tabel domenowych poza warstwą repozytoriów (po Fazie 1).
- Nie commituj sekretów. Nie zmieniaj DNS ani kont zewnętrznych.
- Nie oznaczaj zadania jako zrobionego bez testu, który by oblał przed zmianą.
- Aplikacja nie daje porad prawnych. Zgodność (RODO, art. 398 PKE) to odpowiedzialność tenanta. System przechowuje dowody i blokuje wysyłkę, gdy dopuszczenie kanału nie jest potwierdzone.

---

## 3. Rekonesans i znane problemy (zweryfikuj w Fazie 0)

Wyniki częściowej analizy. **Każdy punkt agent potwierdza lub obala w kodzie.**

| # | Podejrzenie | Gdzie szukać |
|---|---|---|
| P1 | Zmyślone wartości: `googleRating: p.rating \|\| 4.7`, `googleReviewsCount \|\| 15` i `\|\| 18`, `lat: p.lat \|\| centerPoint.lat` | `src/app/api/scraper/route.ts` (ok. l.404 i 602) |
| P2 | Fallback `user.tenantId \|\| 1` | `api/pipeline`, `api/leads`, `api/outreach/history`, `api/tenants` |
| P3 | `validateSessionToken` przypisuje tenanta `procent-marketing` przy braku membership lub błędzie zapytania | `src/lib/auth.ts` ok. l.148-175 |
| P4 | `app_settings.key` jest globalnie `UNIQUE`, mimo `tenant_id` | `src/lib/db/schema.ts` ok. l.245 |
| P5 | Konfiguracja maila ustawia `process.env.SMTP_PASSWORD` itd. i prawdopodobnie zapisuje hasła jawnie w `app_settings` | `api/settings/mail/route.ts` ok. l.105-132 |
| P6 | Tabele bez `tenant_id` lub z nullable `tenant_id`: `audits`, `evidence`, `events`, `consents`, `jobs`, `invitations`, `service_catalog`; `tenant_id` nullable także w `leads`, `contacts`, `offers`, `messages` | `schema.ts` |
| P7 | Brak RLS. Driver `drizzle-orm/neon-http` nie pozwala na interaktywne transakcje z `set_config` | `src/lib/db/index.ts` |
| P8 | Domyślny kod zaproszenia `PROCENT-START-2026` | `auth.ts` l.7 |
| P9 | Brak `vercel.json` i crona. Worker uruchamiany ręcznie. Joby bez `tenant_id` | `api/worker/route.ts`, `job-runner.ts` |
| P10 | Wyszukiwanie: jeden Text Search po mieście, `pageSize` do 20, bez paginacji i siatki | `src/lib/google-places.ts` ok. l.156-190 |
| P11 | `page.tsx` ma 7145 linii i ok. 93 `useState` | `src/app/page.tsx` |
| P12 | `.env.example` jest nieaktualny (SQLite, Netlify, Telegram, SMS) | repo root |
| P13 | Znaczniki czasu bez strefy (`withTimezone: false`) | `schema.ts` |
| P14 | `LIVE_MODE`, `TEST_RECIPIENTS`, kill switch są globalne (env/plik `STOP`) | `send-service.ts` |
| P15 | `companyScale` / `verifiedScale` może przyjmować wartość domyślną bez źródła | `scraper/route.ts`, `registries.ts` |
| P16 | `contact_basis` domyślnie `inquiry`, jedno pole na lead, brak rozdziału e-mail/telefon | `schema.ts` l.~60 |

**Dodatkowo agent robi inwentaryzację:** lista wszystkich endpointów `api/**` z informacją, czy używają `requireUser()` i czy filtrują po `tenantId`; lista wszystkich zapytań do tabel domenowych; lista miejsc, gdzie ustawiany jest status leada.

---

## 4. Decyzje projektowe do zatwierdzenia przed Fazą 2

| ID | Decyzja | Rekomendacja |
|---|---|---|
| D1 | Jak modelować to, że jedna firma bywa w wielu kampaniach? | Tabela `leads` zostaje rekordem firmy (per tenant). Nowa tabela `campaign_leads` trzyma stan pipeline, priorytet, właściciela, partię, wybrany kontakt. Migracja: jedna domyślna kampania na tenanta i backfill. |
| D2 | Maszyna stanów | Zbiór stanów i przejść w playbooku (dane). Stany rdzeniowe (`blocked`, `unsubscribed`, `bounced`) są zawsze obecne i niezmienialne. |
| D3 | Kolejka jobów | Zostaje Postgres (`SKIP LOCKED`), ale za interfejsem `JobQueue`, żeby można było przejść na Inngest/QStash. |
| D4 | Pieniądze | Liczby całkowite w groszach plus waluta. Nigdy `float`. |
| D5 | Strefy czasowe | Migracja kolumn do `timestamptz` (zakładamy, że dotychczasowe wartości są w UTC; agent to potwierdza). |
| D6 | Uprawnienia | Role (`owner`, `admin`, `member`, `viewer`) plus tablica uprawnień granularnych (np. `approve_batch`, `approve_channel`, `confirm_payment`, `manage_mailbox`, `manage_playbook`). |

---

## 5. Architektura docelowa

```
web/src/
  app/
    (public)/o/[token]/            # publiczna strona oferty (bez zmian funkcjonalnych)
    (auth)/login, invite
    (app)/
      dashboard/
      campaigns/            [id]/{overview,leads,batches,sequence,settings}
      leads/                [id]/  # jeden widok z zakładkami: dane, dowody, kontakt, oferta, korespondencja, zadania, historia
      tasks/                # kolejka telefonów i zadań ręcznych
      outbox/               # kolejka wysyłki, edycja, akcje zbiorcze
      offers/               # tylko gdy moduł włączony w kampanii
      settings/{mailboxes,team,integrations,pricing,playbooks,channels}
    api/                    # cienkie route handlery: auth, walidacja Zod, wywołanie serwisu
  modules/
    tenancy/        # kontekst tenanta, withTenant(), uprawnienia
    campaigns/      # playbook (schema Zod, wersjonowanie, presety), campaign_leads, partie
    discovery/      # adaptery źródeł: places, rejestry, csv, manual; siatka; runy
    research/       # pobieranie stron, ekstrakcja LLM z weryfikacją cytatu, evidence
    crm/            # leads, contacts, pola z provenance, dedup
    channels/       # zgody per kanał, blokady
    sequencing/     # silnik sekwencji z danych
    tasks/          # zadania ręczne (telefon), wyniki
    outcomes/       # deklaracje i wpłaty
    offers/         # moduł opcjonalny
    mailing/        # email_accounts, sendMessage, inbox, bounce
    analytics/      # rollupy i zapytania dashboardu
    jobs/           # JobQueue, runner, cron tick
    secrets/        # szyfrowanie
  lib/              # drobne narzędzia bez logiki domenowej
  db/               # schema, migracje, klient, withTenant
```

Zasady warstw: UI → route/action → serwis modułu → repozytorium → DB. Adaptery zewnętrzne (Google, SMTP, IMAP, LLM) za interfejsami. Moduły nie importują się nawzajem poza publicznym `index.ts`.

---
## FAZA 0. Hotfixy bezpieczeństwa i prawdy danych

**Cel:** usunąć rzeczy, które łamią R1 i R4, zanim powstanie cokolwiek nowego. Bez zmian schematu poza jednym indeksem.
**Szacunek:** 1-2 dni.

### Zadania

| ID | Zadanie | Kryterium akceptacji |
|---|---|---|
| 0.1 | Potwierdź P1-P16 w kodzie, zapisz wyniki w `docs/RECON.md` (potwierdzone / obalone / nowe znaleziska, z numerami linii). | Plik istnieje, każde P ma werdykt. |
| 0.2 | Usuń wartości zmyślone (P1, P15): brak oceny, opinii, współrzędnych lub skali firmy to `null`. UI pokazuje "brak danych" i akcję "uzupełnij". | Test: wynik Places bez `rating` zapisuje `NULL`; UI nie pokazuje liczby. |
| 0.3 | Usuń fallback `\|\| 1` we wszystkich route'ach (P2). Dodaj `requireTenant()` zwracające `{user, tenantId}` lub rzucające 403. | Test: użytkownik bez membership dostaje 403 na każdym endpoincie z listy. |
| 0.4 | `validateSessionToken`: brak membership lub błąd bazy to `null` sesji (nie tenant domyślny). Błąd bazy nie może dawać dostępu. | Test jednostkowy z mockiem błędu DB. |
| 0.5 | Usuń domyślny kod zaproszenia (P8). Brak `BOOTSTRAP_INVITE_CODE` w env oznacza brak bootstrapu. Aplikacja startuje, ale rejestracja pierwszego użytkownika jest zablokowana z czytelnym komunikatem. | Test + zaktualizowany `.env.example`. |
| 0.6 | Zdejmij zapis haseł do `process.env` (P5). Na tym etapie: nie ustawiaj `process.env` w runtime. Hasła nadal do bazy (szyfrowanie w Fazie 1), ale odpowiedzi API nigdy ich nie zwracają. | Test: odpowiedź `GET /api/settings/mail` nie zawiera haseł ani ich masek będących prawdziwą wartością. |
| 0.7 | Przepisz `.env.example` na stan faktyczny (P12): `DATABASE_URL` Neon, `GEMINI_*`, `CRON_SECRET`, `SECRETS_ENCRYPTION_KEY`, `APP_BASE_URL`, `LIVE_MODE` (tymczasowo). Usuń SQLite, Netlify, SMS/WhatsApp. | Plik zgodny z faktycznie czytanymi zmiennymi (agent grepuje `process.env`). |
| 0.8 | Dodaj test skanujący kod: zakaz literałów `|| 4.7`, `|| 1` przy `tenantId` oraz zakaz importu `nodemailer` poza `send-service`/`mail-service`. | Test w `tests/invariants.test.ts` zielony. |

### Prompt dla agenta (Faza 0)

```
Pracuj w katalogu web/. Przeczytaj docs/PLAN.md sekcje 2, 3 i Fazę 0.
1) Najpierw wykonaj zadanie 0.1 (rekonesans) i pokaż mi docs/RECON.md oraz plan zmian. Poczekaj na akceptację.
2) Potem realizuj 0.2-0.8 po kolei, każde z testem, który oblewa przed zmianą.
Ograniczenia: nie zmieniaj schematu bazy, nie dodawaj bibliotek, nie ruszaj src/app/page.tsx poza usunięciem wyświetlania zmyślonych wartości.
Na końcu: lint, tsc --noEmit, npm test oraz raport (co zrobione, co odłożone, pytania).
```

---

## FAZA 1. Fundament multitenant

**Cel:** twarda izolacja (R4), szyfrowanie sekretów (R9), poprawne migracje, uprawnienia.
**Szacunek:** 4-6 dni. **Wymaga:** Faza 0 zmergowana.

### 1.1 Migracje i schemat

- Zainstaluj `drizzle-kit` jako standard: `drizzle.config.ts`, katalog `drizzle/` z migracjami SQL w repo. Skrypty `.mjs` w `web/scripts/migrate_*` zostają jako archiwum (nie uruchamiać).
- Wygeneruj migrację bazową odzwierciedlającą **aktualny** stan produkcji (introspekcja `drizzle-kit pull`), potem kolejne migracje przyrostowe.
- Migracja danych (kolejność ma znaczenie):
  1. uzupełnij `tenant_id` w tabelach, gdzie jest `NULL` (dla `audits`, `evidence` przez JOIN z `leads`; `jobs` z payloadu lub tenant 1 tylko jeśli agent udowodni, że to dane jednego tenanta; w razie wątpliwości raport do człowieka),
  2. dodaj `tenant_id` do tabel bez niego: `audits`, `evidence`, `events`, `consents`, `jobs`, `invitations`, `service_catalog`,
  3. ustaw `NOT NULL` + FK + indeksy `(tenant_id, ...)`,
  4. `app_settings`: zamień `UNIQUE(key)` na `UNIQUE(tenant_id, key)`,
  5. kolumny czasu na `timestamptz` (D5).
- `suppression`: `UNIQUE(tenant_id, kind, hash)`.

**Kryterium:** `drizzle-kit check` czysty, migracja przechodzi na kopii (branch Neon) z danymi produkcyjnymi, test porównuje liczbę rekordów przed i po.

### 1.2 Kontekst tenanta i RLS

- Zmień klienta DB na `drizzle-orm/neon-serverless` (Pool, WebSocket), bo `neon-http` nie utrzyma `set_config` w transakcji.
- Funkcja `withTenant(tenantId, fn)`: otwiera transakcję, wykonuje `select set_config('app.tenant_id', $1, true)`, wywołuje `fn(tx)`.
- Polityki RLS dla każdej tabeli z `tenant_id`: `USING (tenant_id = current_setting('app.tenant_id', true)::int)` oraz `WITH CHECK` tak samo. Włącz `ENABLE` i `FORCE ROW LEVEL SECURITY`.
- Role Postgresa: `app_rw` (bez `BYPASSRLS`, nie właściciel tabel) używana przez aplikację; osobna rola migracyjna. Dwa connection stringi: `DATABASE_URL` (app) i `DATABASE_URL_MIGRATIONS`.
- Tryb systemowy dla crona: `withSystemContext()` tylko do enumeracji tenantów i claimowania jobów; praca właściwa zawsze w `withTenant`.
- Warstwa repozytoriów: każda funkcja przyjmuje `TenantScope` (`{tenantId, tx}`) jako pierwszy argument. Brak zapytań do tabel domenowych poza `modules/*/repo.ts` (reguła ESLint `no-restricted-imports` na `@/db/schema` poza repozytoriami).

**Kryteria:**
- Test integracyjny na prawdziwym branchu Neon: tenant A nie widzi, nie zmienia i nie usuwa danych tenanta B **nawet przy ręcznie pominiętym filtrze `WHERE`** (surowy SQL bez filtra zwraca 0 cudzych wierszy).
- Test: zapytanie bez ustawionego `app.tenant_id` zwraca 0 wierszy.

### 1.3 Sekrety

- Moduł `secrets`: AES-256-GCM, klucz z `SECRETS_ENCRYPTION_KEY` (32 bajty base64), pole `key_version` pod rotację. Tabela `tenant_secrets(tenant_id, name, ciphertext, iv, tag, key_version, updated_at)`.
- API: `setSecret`, `getSecret` (tylko po stronie serwera), `hasSecret`. Klient nigdy nie dostaje wartości.
- Migracja istniejących haseł SMTP/IMAP z `app_settings` do `tenant_secrets`, następnie usunięcie jawnych wartości z `app_settings`.
- Test: dane w bazie nie zawierają hasła jawnie; rotacja klucza (re-encrypt) działa.

### 1.4 Uprawnienia

- `tenant_members.capabilities text[]` (D6). Helper `can(user, 'approve_batch')`. Role mają domyślne zestawy, uprawnienia można dodawać pojedynczo.
- Strażnik `requireCapability()` w route'ach i server actions. Rozszerz skaner `api-auth-scanner.test.ts`, żeby wymagał `requireTenant()` lub jawnego oznaczenia `// public`.
- Ekran zespołu: zaproszenia, role, uprawnienia (ekran w nowej trasie `settings/team`).

### 1.5 Limity per tenant

- Tabela `usage_counters(tenant_id, metric, period, value)` oraz `tenant_limits(tenant_id, metric, limit)`. Metryki: `google_requests`, `emails_sent`, `llm_tokens`, `leads`.
- Funkcja `consume(tenantScope, metric, n)` atomowa, rzuca `LimitExceededError`.

### Prompt dla agenta (Faza 1)

```
Przeczytaj docs/PLAN.md sekcje 2, 4 i Fazę 1. Pracuj na branchu Neon "phase-1" (użyj skilli z .agents/skills/neon*).
Najpierw przedstaw plan migracji z kolejnością i ryzykiem utraty danych dla każdego kroku, wraz z zapytaniami kontrolnymi. Czekaj na akceptację.
Realizuj 1.1 → 1.2 → 1.3 → 1.4 → 1.5, każdy podpunkt jako osobny commit z testami.
Nie przechodź na RLS, dopóki repozytoria nie istnieją. Nie zmieniaj logiki biznesowej wysyłki ani ofert.
Na końcu raport + wyniki testów izolacji tenantów.
```

---

## FAZA 2. Silnik playbooków kampanii

**Cel:** różnice między klientami to konfiguracja. Zastępuje zaszyte na stałe reguły (max 3 follow-upy, jedno `contact_basis`, jedna maszyna stanów).
**Szacunek:** 6-8 dni. **Wymaga:** Faza 1 i zatwierdzone D1-D2.

### 2.1 Model danych

| Tabela | Kluczowe kolumny |
|---|---|
| `campaigns` | `id, tenant_id, name, status (draft/active/paused/archived), playbook_version_id, owner_user_id, test_mode bool, kill_switch bool, created_at` |
| `playbooks` | `id, tenant_id, name, preset_key null` |
| `playbook_versions` | `id, playbook_id, version int, definition jsonb (Zod), created_by, created_at`. **Niezmienne.** Zmiana tworzy nową wersję. |
| `campaign_leads` | `id, tenant_id, campaign_id, lead_id, state, priority smallint null, owner_user_id, batch_id null, chosen_contact_id null, fit_reason text null, requires_manual_review bool, created_at`. `UNIQUE(campaign_id, lead_id)`. |
| `batches` | `id, tenant_id, campaign_id, size, status (draft/approved/rejected), approved_by, approved_at` |
| `channel_permissions` | `id, tenant_id, campaign_lead_id, contact_id, channel (email/phone), status (yes/no/to_check), rationale, evidence_url, evidence_note, approved_by, approved_at`. Domyślnie `to_check`. |
| `blocks` | `id, tenant_id, kind (email/domain/phone/nip), hash, reason (refusal/unsubscribe/bounce/prior_contact/manual), source, created_at`. `UNIQUE(tenant_id, kind, hash)`. To rozszerzenie/zastąpienie `suppression`. |
| `sequence_runs` | `id, tenant_id, campaign_lead_id, step_index, status (active/paused/stopped/done), next_run_at, stop_reason` |
| `tasks` | `id, tenant_id, campaign_lead_id, type, assignee_user_id, due_at, status (open/done/snoozed/cancelled/blocked), result, next_step, blocked_reason` |
| `outcomes` | `id, tenant_id, campaign_lead_id, pledged_minor bigint null, currency char(3), expected_payment_date date null, paid_minor bigint null, payment_confirmed_by, payment_confirmed_at` |
| `custom_field_defs` | `id, tenant_id, campaign_id, key, label, type (text/number/date/enum), options jsonb, required` |
| `custom_field_values` | `campaign_lead_id, key, value jsonb, source, updated_by` |

Migracja: dla każdego tenanta utwórz domyślną kampanię z presetem "Sprzedaż usług" (odwzorowuje dzisiejsze zachowanie) i backfill `campaign_leads` z `leads`. **Zachowanie istniejącego klienta nie może się zmienić.**

### 2.2 Schemat playbooka (Zod, `modules/campaigns/playbook.schema.ts`)

```jsonc
{
  "schemaVersion": 1,
  "sources": [{ "type": "places" | "registry" | "csv" | "manual", "config": {} }],
  "fitRubric": {
    "levels": [
      { "priority": 1, "label": "Wspiera dzieci/edukację", "requires": ["evidence:child_support"], "maxEvidenceAgeMonths": 36 },
      { "priority": 2, "label": "Wspiera lokalną społeczność", "requires": ["evidence:community_support OR role:csr_contact"] },
      { "priority": 3, "label": "Dopasowanie tematyczne", "requires": [], "forceManualReview": true }
    ],
    "noEvidenceBehavior": "manual_review"
  },
  "exclusions": { "industries": ["tobacco","gambling","adult","alcohol"], "inactiveCompanies": true },
  "contactPath": {
    "order": ["csr_department","corporate_foundation","designated_contact","owner_or_board","marketing"],
    "onePathPerCompany": true,
    "flagApplicationForm": true
  },
  "channels": {
    "email": { "requireApprovalBeforeSend": true },
    "phone": { "requireApprovalBeforeCall": true }
  },
  "approval": { "firstBatchSize": 20, "requiredCapability": "approve_batch" },
  "limits": { "newCompaniesPerBusinessDay": 5, "sendWindow": { "tz": "Europe/Warsaw", "days": "mon-fri", "from": "08:30", "to": "16:00", "skipHolidays": "PL" } },
  "sequence": [
    { "id": "mail1", "type": "send_email", "template": "first_contact" },
    { "id": "wait1", "type": "wait", "businessDays": 2 },
    { "id": "call1", "type": "create_task", "taskType": "phone_call", "assigneeRole": "campaign_owner",
      "requires": { "channel": "phone", "permission": "yes", "afterStepSucceeded": "mail1" } }
  ],
  "stopConditions": ["reply","refusal","unsubscribe","bounce"],
  "onEvents": {
    "reply": { "pauseSequence": true, "notify": "campaign_owner" },
    "bounce": { "blockTasks": true, "reason": "mail_error_to_clarify" },
    "reschedule_request": { "moveTask": true }
  },
  "states": ["new","researched","qualified","approved","in_sequence","replied","call_pending","in_talks","pledged","paid","closed"],
  "transitions": [ { "from": "new", "to": "researched", "actor": ["system","user"] } ],
  "modules": { "audit": false, "offers": false, "pricing": false },
  "outcomeSchema": { "enabled": true, "confirmPaymentCapability": "confirm_payment" },
  "templates": { "first_contact": { "format": "plain_text", "attachments": false, "autoPraise": false } },
  "customFields": []
}
```

Walidacja przy zapisie: spójność (każdy stan w przejściach istnieje, każdy krok sekwencji ma poprawny typ, brak pętli bez `wait`), plus **lint playbooka** (ostrzeżenia, np. "limit 0 follow-upów, ale sekwencja ma 3 maile"). Rdzeniowe stany `blocked`, `unsubscribed`, `bounced` dodawane automatycznie i niedostępne do edycji.

### 2.3 Silnik

- `transitionLead()` → `transitionCampaignLead()`: czyta dozwolone przejścia z wersji playbooka kampanii, zapisuje zdarzenie. Stary kod odwołujący się do `leads.status` przechodzi na adapter do czasu Fazy 9.
- `SequenceEngine`: job `advance_sequence` wybiera `sequence_runs` z `next_run_at <= now`, wykonuje krok. `send_email` tworzy `messages` (przejdą przez `sendMessage`). `create_task` tworzy `tasks` **tylko jeśli** warunki spełnione i **po udanej wysyłce** (event `message_sent`), nie wcześniej.
- Reguły zdarzeń: odpowiedź (z IMAP) → `sequence_runs.status = paused`, task przypisany do właściciela, powiadomienie. Odmowa/wypisanie → blok w `blocks`, `sequence_runs.status = stopped`, otwarte `tasks` anulowane. Bounce lub błąd wysyłki → `tasks` w stanie `blocked` z powodem. Prośba o inny termin → zmiana `due_at`.
- **Jedna ścieżka na firmę:** partial unique index na aktywnym `sequence_runs` per `(campaign_id, lead_id)` oraz wybór `chosen_contact_id` według `contactPath.order`.
- **Brak odpowiedzi nie jest zgodą na telefon:** zadanie telefoniczne tworzy się wyłącznie przy `channel_permissions(phone) = yes`, w przeciwnym razie powstaje zadanie typu `verify_channel` dla człowieka.
- **Partia:** playbook wymaga `firstBatchSize`. Pierwsza partia (rekordy `qualified` z `fit` i dowodami) trafia do `batches` jako `draft`. Dopóki nie ma zatwierdzonej partii przez użytkownika z uprawnieniem, **żaden** rekord kampanii nie wchodzi do sekwencji. Wyszukiwanie nigdy samo nie uruchamia wysyłki.
- **Limit dzienny nowych firm:** liczony w `usage_counters` per kampania i dzień roboczy PL.

### 2.4 Rozszerzenie `sendMessage`

Dodaj kontrole (poza istniejącymi): `campaign.status = active`, `campaign.kill_switch = false`, `campaign.test_mode` (przekierowanie na adresy testowe tenanta z prefiksem `[TEST]`), `channel_permissions(email) = yes` jeśli playbook tego wymaga, `batch.status = approved`, brak bloku w `blocks`, jedna aktywna ścieżka na firmę. Kontrole `LIVE_MODE` z env zastąpione przez `test_mode` kampanii (P14).

### 2.5 Presety

- `agency_sales` (odwzorowanie obecnego zachowania: 3 follow-upy, audyt i oferty włączone).
- `sponsorship_fundraising` (Fundacja, według briefu: sekcja w Fazie 9).

### Testy Fazy 2

Jednostkowe: walidacja playbooka, przejścia, lint. Integracyjne: sekwencja z briefu (mail → po 2 dniach roboczych zadanie), stop po odpowiedzi/odmowie, blokada trwała po reimporcie, brak wysyłki bez zatwierdzonej partii, brak zadania telefonicznego bez zgody kanału, limit 5 dziennie, jeden mail na firmę.

### Prompt dla agenta (Faza 2)

```
Przeczytaj docs/PLAN.md sekcje 2, 4, 5 i Fazę 2. Zatwierdzone decyzje: D1=<...>, D2=<...>.
Zacznij od: (a) schemat Zod playbooka, (b) migracja tabel i backfill kampanii domyślnych, (c) test, że obecne zachowanie agencji nie zmieniło się.
Dopiero potem silnik sekwencji i rozszerzenie sendMessage. Każde z 2.3 i 2.4 z testem integracyjnym.
Nie buduj jeszcze UI, poza minimalnym podglądem JSON playbooka w settings/playbooks.
Pokaż plan i czekaj na akceptację przed migracją.
```

---

## FAZA 3. Wyszukiwanie, research i dowody

**Cel:** "pobierz wszystkie" z Google Places (siatka, paginacja, dedup), dowody z cytatami, bez halucynacji (R1, R11).
**Szacunek:** 6-8 dni. **Wymaga:** Faza 2.

### 3.1 Wyszukiwanie w Google Places (Places API New)

- Tabele: `search_templates` (kryteria zapisane do ponownego użycia), `search_runs` (`status, estimated_requests, used_requests, found, new, duplicates, error`), `search_run_cells` (`run_id, bbox/center+radius, status, pages_fetched, results, saturated bool, error`).
- Kryteria: branża (słownik plus frazy własne), region (nazwa, promień lub wielokąt), wielkość firmy (filtr stosowany **po** wzbogaceniu, nie przy zapytaniu).
- Algorytm: region → siatka komórek → dla każdej komórki Text Search z `locationRestriction`/`locationBias`, paginacja `nextPageToken` do wyczerpania (limit całkowity na zapytanie ok. 60 wyników; agent weryfikuje aktualne limity w dokumentacji) → jeśli komórka zwraca maksimum, **dzieli się** na cztery i zapytania powtarza (`saturated`). Dedup po `place_id` i po (domena | telefon | nazwa+adres).
- Zadanie jobem z **checkpointami** na poziomie komórek (wznowienie po awarii), pojedynczy job przetwarza partię komórek i planuje kolejny (limity czasu funkcji Vercel; patrz `maxDuration`).
- `FieldMask` minimalny. Pola dodatkowo płatne (strona, telefon) zbieraj osobno przez Place Details tylko dla rekordów, które przeszły wstępny filtr. **Agent sprawdza aktualny cennik i warunki cache'owania Places** (m.in. czego nie wolno trzymać długoterminowo) i zapisuje wnioski w `docs/GOOGLE_PLACES.md`. Dane Google przechowuj z `fetched_at` i polityką odświeżania; `place_id` można trzymać bezterminowo.
- **Estymata kosztu przed startem:** liczba komórek × szacowana liczba stron × cena z konfiguracji tenanta (`tenant_limits`/ustawienia). Cena nie jest zaszyta w kodzie. Użytkownik widzi estymatę i zatwierdza start; `consume('google_requests')` przerywa run po przekroczeniu budżetu.
- UI `campaigns/[id]` → "Nowe wyszukiwanie": formularz, estymata, start, postęp na żywo (polling), stany: przerwany (akcja "wznów"), częściowy, zakończony.

### 3.2 Dane z provenance

- Tabela `lead_field_values(tenant_id, lead_id, field, value jsonb, source, source_url, retrieved_at, confidence, verified_by, verified_at, is_manual)`. Widok bieżącej wartości: ręczna ma pierwszeństwo, potem wyższa pewność, potem nowsza.
- Pola "stałe" w `leads` pozostają dla wydajności, ale każda zmiana idzie przez serwis zapisujący provenance.
- Wielkość firmy: wyłącznie z rejestru (KRS/CEIDG/REGON) lub potwierdzonego źródła. Inaczej `unknown`. Szacunek LLM zapisywany jako osobne pole `size_estimate` z etykietą "szacunek" i pewnością, **nigdy** nie jest używany do filtrowania ani oceny bez zgody użytkownika.

### 3.3 Research i dowody (`modules/research`)

- Pobieranie stron: istniejący `isSafeUrl` (SSRF), `robots.txt`, timeouty, rate limit per domena, `User-Agent` z kontaktem, zapis `fetched_at`. Przechowuj skrócony tekst źródła (do weryfikacji cytatów) z retencją.
- Ekstrakcja LLM (Gemini, structured output): wejście to wyłącznie pobrany tekst w bloku `<untrusted_scraped_data>`; wyjście to lista twierdzeń `{type, value, quote, url}`.
- **Weryfikacja programowa (R11):** `quote` po normalizacji (białe znaki, wielkość liter, cudzysłowy) musi być podciągiem pobranego tekstu; inaczej twierdzenie odrzucone i zalogowane. Data publikacji tylko jeśli wystąpiła w źródle (meta, treść), inaczej `NULL`.
- Typy dowodów konfigurowalne w playbooku (np. `child_support`, `community_support`, `csr_contact`, `application_form`).
- Ocena dopasowania: czysta funkcja `rubric(evidence[], rubric) → {priority, reason, requiresManualReview}`. Powód (`fit_reason`) składany z faktycznych dowodów (szablon, nie swobodny tekst LLM). Brak dowodu: `requires_manual_review = true`, nie wysyłka.
- Wykluczenia branżowe z playbooka stosowane przed researchem (oszczędność kosztów).

### 3.4 Kontakty

- `contacts` rozszerz o `kind (email/phone/form)`, `role_label`, `source_url`, `retrieved_at`, `verification_status (verified/unverified/invalid)`. Osoba (imię, nazwisko) tylko z potwierdzonego źródła.
- Weryfikacja e-mail: składnia, MX, odrzucenie adresów prywatnych (domeny pocztowe publiczne) zgodnie z playbookiem. **Zakaz zgadywania** adresów (`imie.nazwisko@`).
- Status `Brak kontaktu` jako pełnoprawny stan z akcją "dodaj ręcznie". Po dodaniu lead wraca do kolejki automatycznie.

### Testy Fazy 3

Siatka (podział komórki przy saturacji, dedup, wznowienie po awarii przy przerwaniu w środku komórki), estymata kosztu, przerwanie po budżecie, odrzucenie cytatu nieobecnego w źródle, brak e-maila bez źródła, prompt injection w treści strony nie zmienia wyniku (test z podstawioną stroną).

### Prompt dla agenta (Faza 3)

```
Przeczytaj docs/PLAN.md sekcje 2, 5 i Fazę 3.
Krok 1: zbadaj aktualną dokumentację Google Places API (New): limity Text Search i paginacji, SKU i cennik, zasady cache'owania. Zapisz w docs/GOOGLE_PLACES.md i przedstaw mi wnioski przed kodem.
Krok 2: adapter Places za interfejsem DiscoverySource, siatka, runy z checkpointami, estymata kosztu.
Krok 3: provenance i research z programową weryfikacją cytatów.
Dla każdego kroku testy na zamockowanym adapterze, bez prawdziwych wywołań Google w CI.
```

---

## FAZA 4. Moduły opcjonalne: audyt, oferty, cennik, bramka gotowości

**Cel:** to, co dziś jest rdzeniem agencji, staje się modułem włączanym w playbooku (`modules.audit/offers/pricing`).
**Szacunek:** 4-5 dni. **Wymaga:** Faza 3.

- `tenant_profile` (czym się zajmuje firma szukająca, usługi, USP) per tenant. Podstawa do ofert, nie zgadywana.
- `pricing_config` per tenant (zastępuje globalny `service_catalog`; migracja z `tenant_id`). **Brak stawki to oferta bez ceny** z jawnym komunikatem w UI. Żadnej ceny z LLM.
- **Bramka gotowości** (`readiness(lead, campaign)`): lista warunków z playbooka (profil tenanta uzupełniony, dowody, kontakt, opcjonalnie stawka). Wynik to checklista, a przy każdym braku przycisk naprawczy ("Uzupełnij profil", "Dodaj e-mail", "Skonfiguruj stawkę"). Brak ślepych zaułków.
- Generator oferty: szablon + dane leada + profil; LLM tylko parafrazuje fakty z `evidence`; walidator odrzuca twierdzenia bez `evidence_ids` (istniejący mechanizm, przenieść na tenant-scope).
- Oferta tworzona także bez kontaktu (status `no_contact`), kontakt można dodać później.
- Publiczna strona `/o/[token]`: bez zmian funkcjonalnych, ale `tenant_id` w zapytaniach, `noindex`, wygasanie.
- Dla kampanii z `modules.offers = false` (Fundacja) wszystkie te ekrany i kroki są ukryte, a kod nie jest wywoływany.

**Testy:** oferta bez stawki nie zawiera ceny; twierdzenie bez dowodu odrzucone; kampania z wyłączonym modułem nie wyświetla ani nie uruchamia generatora; bramka pokazuje akcję przy każdym braku.

### Prompt dla agenta (Faza 4)

```
Przeczytaj docs/PLAN.md Fazę 4. Przenieś istniejące generatory ofert (lib/outreach.ts, html-renderer.ts, gemini.ts) pod modules/offers za interfejsami, zachowując zachowanie. Dodaj tenant_profile, pricing_config i bramkę gotowości. Najpierw testy charakteryzujące obecne zachowanie, potem refaktor.
```

---
## FAZA 5. Moduł e-mail

**Cel:** zarządzanie skrzynkami z poziomu systemu, bezpieczna wysyłka, odbiór odpowiedzi.
**Szacunek:** 5-7 dni. **Wymaga:** Faza 2 (i 1.3).

### Zadania

- **`email_accounts`**: `tenant_id, label, from_name, from_email, reply_to, signature, smtp_*` (host, port, user; hasło w `tenant_secrets`), `imap_*`, `daily_limit, hourly_limit, min_gap_seconds, warmup_plan jsonb, status (ok/degraded/error), last_check_at, last_error`. Kampania wskazuje skrzynkę (`campaigns.email_account_id`).
- Ekran `settings/mailboxes`: dodanie, test SMTP i IMAP (istniejące endpointy `test-smtp`/`test-imap` przenieś na konto), status zdrowia, limity.
- **Deliverability w UI:** sprawdzenie SPF/DKIM/DMARC dla domeny nadawcy (zapytania DNS TXT po stronie serwera), czytelne wskazówki co poprawić. System **nie zmienia DNS** (reguła z AGENTS.md); generuje instrukcję.
- **Wysyłka:** `sendMessage` bierze skrzynkę z kampanii, respektuje limity godzinowe/dzienne i losowe odstępy, retry z backoffem, klucz idempotencji w transakcji **przed** wysyłką. Status `sent` tylko po potwierdzeniu SMTP.
- **Odbiór (IMAP):** job `poll_inbox` per skrzynka (kursor UID, brak ponownego przetwarzania). Klasyfikacja: odpowiedź, bounce (DSN), wypisanie, auto-reply. Wątkowanie po `In-Reply-To`/`References`. Treść odpowiedzi jest **niezaufana** (R10); klasyfikacja LLM bez narzędzi, wynik zawsze do potwierdzenia człowieka dla odmowy i wypisania, chyba że dopasowano jednoznaczną frazę z listy.
- **Nagłówki:** `List-Unsubscribe`, link wypisania z tokenem, stopka wymagana przez playbook (klauzula informacyjna, kontakt). Wypisanie tworzy rekord w `blocks` natychmiast.
- **Kolejka wysyłki (`outbox`):** widok wiadomości `draft/approved/scheduled/sending/sent/failed/held`, edycja treści, akcje zbiorcze (zatwierdź, wstrzymaj, usuń), harmonogram w oknie wysyłki. Edycja po zatwierdzeniu cofa zatwierdzenie. Zwykły tekst i brak załączników, jeśli tak mówi szablon.
- **Tryby zatwierdzania** w playbooku: wszystko ręcznie, auto po zatwierdzeniu partii, w pełni automatycznie (ostatni wymaga uprawnienia `manage_playbook` i jest domyślnie niedostępny).

### Testy

Jedna wysyłka przy podwójnym wywołaniu joba; zatrzymanie sekwencji po odpowiedzi i po odmowie; bounce wstrzymuje zadanie telefoniczne; limity dzienne i godzinowe; wypisanie przetrwa reimport; poll nie przetwarza dwa razy tej samej wiadomości; test na skrzynkach testowych (SMTP lokalny, np. Mailpit w CI).

### Prompt dla agenta (Faza 5)

```
Przeczytaj docs/PLAN.md Fazę 5 oraz reguły R2, R5-R7, R9, R10. Zacznij od testów (Mailpit jako SMTP/IMAP w CI lub mocki adapterów). Nie twórz drugiej ścieżki wysyłki. Pokaż plan przed zmianą send-service.ts.
```

---

## FAZA 6. Joby, cron i budżety

**Cel:** automatyka działa bez ręcznego wołania workera i sprawiedliwie między tenantami.
**Szacunek:** 3-4 dni. **Wymaga:** Faza 1.

- `jobs`: dodaj `tenant_id NOT NULL`, `campaign_id null`, `idempotency_key`, `priority`, `heartbeat_at`, `result jsonb`. Unikalność `(tenant_id, idempotency_key)`.
- Interfejs `JobQueue` (D3) z implementacją Postgres. Claim: `FOR UPDATE SKIP LOCKED` z **fair share** (round-robin po tenantach, limit równoległych jobów per tenant). Odzyskiwanie zawieszonych jobów po `heartbeat_at`.
- `vercel.json`: crony wywołujące `/api/cron/tick` (autoryzacja `CRON_SECRET`). **Agent sprawdza ograniczenia częstotliwości cronów dla aktualnego planu Vercel** i dobiera strategię (częste crony na planie Pro, w przeciwnym razie zewnętrzny wyzwalacz lub przejście na Inngest/QStash).
- `export const maxDuration` na route'ach workera; joby krojone na krótkie kroki z checkpointami, bez pętli ponad limit funkcji.
- Typy jobów: `search_cell`, `enrich_lead`, `research_lead`, `qualify_lead`, `advance_sequence`, `send_message`, `poll_inbox`, `refresh_place`, `rollup_stats`, `cleanup`.
- Dead-letter: po `maxAttempts` job trafia do widoku "Do sprawdzenia" w UI z przyciskiem "ponów" i powodem.
- Obserwowalność: logi strukturalne (JSON) z `tenant_id`, `job_id`, `campaign_id`; Sentry; metryki długości kolejki i wieku najstarszego jobu.

**Testy:** równoległy claim bez dubli, fair share, odzyskanie jobu po padzie workera, idempotentne `enqueue`.

---

## FAZA 7. Dashboard i analityka

**Cel:** solidne statystyki, szybkie przy skali.
**Szacunek:** 3-4 dni. **Wymaga:** Faza 5-6.

- Tabela rollupów `stats_daily(tenant_id, campaign_id, date, metric, value)` odświeżana jobem `rollup_stats` (przyrostowo). Widoki surowe tylko do drążenia.
- **Sekcje:** lejek (znalezione → zweryfikowane → zakwalifikowane → w partii → wysłane → odpowiedź → rozmowa → deklaracja → wpłata), jakość danych (% pól ze źródłem, % bez kontaktu, % do ręcznej oceny), skrzynki i kolejka (zdrowie, limity, wiek najstarszej wiadomości), koszty (zużycie Google i LLM względem budżetu, koszt na lead), zadania (zaległe telefony, dziś, wstrzymane), wyniki finansowe (deklarowane vs wpłacone, tylko gdy `outcomeSchema.enabled`).
- Filtry: okres, kampania, skrzynka, właściciel. Każda liczba jest linkiem do filtrowanej listy (brak ślepych zaułków).
- Dashboard dostosowuje się do playbooka (kampania bez ofert nie pokazuje metryk ofert).
- Wpłaty: liczone wyłącznie z `outcomes.paid_minor` po `payment_confirmed_at`. Deklaracja nigdy nie liczy się jako wpłata.

**Testy:** rollup zgadza się z zapytaniem surowym na danych testowych; deklaracja nie wlicza się do wpłat; widoczność metryk zależna od modułów.

---

## FAZA 8. UI/UX i rozbicie `page.tsx`

**Cel:** czysty, spójny interfejs bez deadendów, powieleń i łańcuchów przekierowań.
**Szacunek:** 8-12 dni, **równolegle z Fazami 3-7** (każdy nowy ekran od razu w nowej trasie).

### Zasady

- **Design system:** tokeny (kolory, odstępy, typografia), komponenty współdzielone w `components/ui` (przycisk, pole, tabela, badge statusu, puste stany, dialog, drawer, toast). Jeden słownik statusów (`status-meta.ts`: etykieta, kolor, ikona), używany wszędzie.
- **Nawigacja:** Dashboard, Kampanie, Leady, Zadania, Wysyłka, Oferty (jeśli moduł), Ustawienia. Jedna ścieżka do każdej akcji.
- **Szczegóły leada:** jedna trasa `leads/[id]` z zakładkami (Dane, Dowody, Kontakt i zgody, Oferta, Korespondencja, Zadania, Historia). Zakładka w URL (`?tab=`), brak osobnych stron na to samo.
- **Reguły UX:** każdy stan pusty, błąd lub blokada ma akcję naprawczą; każdy pasek postępu zadań w tle odświeża się bez przeładowania; zmiany masowe z potwierdzeniem i możliwością cofnięcia tam, gdzie się da; formularze zapisują wersje robocze; a11y (fokus, etykiety, kontrast) i responsywność.
- **Dane serwerowe:** React Server Components i server actions z walidacją Zod; po stronie klienta tylko interaktywność (TanStack Table już jest w zależnościach).

### Kolejność przenoszenia z `page.tsx`

1. Rozpisz mapę funkcji: zakładki i drawery w `page.tsx` → docelowe trasy (`docs/UI_MIGRATION.md`).
2. Wyciągnij komponenty bez zmiany zachowania (tabele, drawery, formularze) do `components/`.
3. Przenoś ekran po ekranie: ustawienia → CRM/lista leadów → szczegóły leada → wysyłka → historia → dashboard.
4. Po każdym przeniesieniu usuń odpowiadający kod z `page.tsx`; `/` przekierowuje na `/dashboard` jednym redirectem.
5. Test e2e (Playwright) dla przeniesionego przepływu, zanim usuniesz stary.

**Kryteria końcowe:** `page.tsx` poniżej 150 linii lub usunięty, żaden komponent powyżej ok. 400 linii, brak `useState` na poziomie całej aplikacji, zero duplikatów widoków tej samej encji, audyt "kliknięć do akcji" dla 10 kluczowych zadań (maks. 3).

---

## FAZA 9. Presety klientów i testy odbiorcze

### 9.1 Preset `sponsorship_fundraising` (Fundacja Szumi Las)

Odwzorowanie briefu z 29.09.2026. **Wartości w nawiasach to propozycje startowe z briefu i muszą być edytowalnymi parametrami.**

| Element briefu | Konfiguracja |
|---|---|
| Priorytety dopasowania 1-3 | `fitRubric` jak w schemacie; priorytet 3 zawsze `forceManualReview` |
| URL dowodu i data informacji | wymagane przy priorytetach 1-2; data `NULL`, jeśli źródło jej nie podaje |
| Wykluczenia (tytoń, hazard, treści dla dorosłych, alkohol) | `exclusions.industries` (propozycja do zatwierdzenia) |
| Ścieżka kontaktu | `contactPath.order = [csr_department, corporate_foundation, designated_contact, owner_or_board, marketing]`, `onePathPerCompany`, flaga formularza zgłoszeniowego |
| Brak szacowania budżetu sponsorskiego po branży | system nie ma pola "szacowany budżet"; wielkość firmy tylko ze źródła |
| Zgody osobno dla e-maila i telefonu | `channel_permissions` per kanał: status, uzasadnienie, źródło/dowód, osoba zatwierdzająca; domyślnie `to_check` |
| Rekordy niepewne = ręczna ocena | `requires_manual_review`, bez wysyłki |
| Pierwsza partia 20 rekordów zatwierdza Dawid | `approval.firstBatchSize = 20`, uprawnienie `approve_batch` |
| Limit pilotażu 5 nowych firm w dzień roboczy | `limits.newCompaniesPerBusinessDay = 5` |
| Jeden mail, zwykły tekst, bez załącznika | szablon `first_contact`: `plain_text`, `attachments:false`, `autoPraise:false` |
| Zadanie telefoniczne po 2 dniach roboczych po **udanej** wysyłce | `wait 2 businessDays` + `create_task` z warunkiem `afterStepSucceeded` i zgodą na telefon |
| Błąd lub zwrot maila wstrzymuje zadanie | `onEvents.bounce.blockTasks` |
| Odpowiedź zatrzymuje sekwencję; prośba o termin przesuwa zadanie; odmowa/wypisanie blokuje | `stopConditions`, `onEvents` |
| Brak odpowiedzi nie jest zgodą na telefon | zadanie tylko przy `phone = yes`, inaczej `verify_channel` |
| Wynik: deklarowana kwota, oczekiwana data wpłaty, wpłacona kwota, potwierdzenie przez Anię | `outcomes` (grosze) + `confirm_payment` tylko dla Ani |
| Blokady trwałe po reimporcie | `blocks` (R5) |
| Kwoty i świadczenia w mailu | brak w szablonie startowym; pole możliwe do włączenia po potwierdzeniu kosztów przez Jakuba (uprawnienie) |
| Termin raportu sponsorskiego | pole kampanii, ustalane przy starcie |

Role dla zespołu: Dawid (właściciel kampanii, `approve_batch`, zadania telefoniczne), Jakub (wsparcie, `manage_playbook` w zakresie kosztów i warunków), Ania (`confirm_payment`).

### 9.2 Testy odbiorcze (z briefu) jako automatyczne

| # | Scenariusz | Oczekiwanie |
|---|---|---|
| A1 | Wysyłka pierwszego maila na skrzynkę testową, job odpalony dwa razy | dokładnie jedna wiadomość |
| A2 | Odpowiedź na mail | sekwencja wstrzymana, zadanie u Dawida, brak dalszych wysyłek |
| A3 | Odmowa / wypisanie | blok w `blocks`, zadania anulowane |
| A4 | Zwrot (bounce) | zadanie telefoniczne `blocked` z powodem |
| A5 | Błąd SMTP | retry z backoffem, po limicie job w dead-letter, brak `sent` |
| A6 | Daty zadań | zadanie po 2 dniach roboczych PL (z pominięciem weekendu i święta) |
| A7 | Reimport tego samego pliku/wyszukiwania | brak zdublowanych leadów, blokady zachowane, brak ponownej wysyłki |
| A8 | Brak zatwierdzonej partii | zero wysyłek |
| A9 | Kanał telefoniczny `to_check` | brak zadania telefonicznego, jest `verify_channel` |
| A10 | Rekord bez dowodu | priorytet 3, ręczna ocena, brak sekwencji |
| A11 | Deklaracja bez wpłaty | nie wlicza się do wpłat na dashboardzie |
| A12 | Dwóch tenantów: agencja i fundacja jednocześnie | brak wycieku danych, osobne skrzynki i limity |

### 9.3 Preset `agency_sales`

Test regresji: zachowanie Procent Marketing sprzed refaktoru (audyt, oferty, 3 follow-upy) działa identycznie.

---

## FAZA 10. Hardening, porządki, wydanie

- **Bezpieczeństwo:** przegląd RLS (każda tabela ma politykę), rate limiting logowania i API, nagłówki bezpieczeństwa, CSRF dla mutacji, sesje (rotacja, wygasanie), audit log zmian playbooka, uprawnień i skrzynek, skanowanie zależności.
- **RODO (wsparcie techniczne, nie porada prawna):** eksport i usunięcie danych leada/kontaktu, retencja (job `cleanup` wg polityki tenanta), rejestr źródeł danych, informacja dla odbiorcy w stopce.
- **Porządki:** usunięcie `leadmachine/`, `.streamlit`, skryptów Pythona, `netlify.ts`, `output/offers`, starych `scripts/migrate_*.mjs`, zbędnych skryptów w `web/scripts`. Aktualizacja `README.md`, `AGENTS.md`, `docs/*` (RUNBOOK, GO_LIVE_CHECKLIST, COMPLIANCE) do nowej architektury.
- **CI/CD:** GitHub Actions: lint, `tsc`, testy jednostkowe, testy integracyjne na efemerycznym branchu Neon, Playwright, migracje w podglądzie. Preview deployments na Vercelu z branchem Neon.
- **Wydajność:** indeksy z `EXPLAIN` dla list (tenant + status + data), paginacja kursorowa na listach, partycjonowanie `lead_events` i zdarzeń maili przy skali.
- **Go-live per klient:** checklista (skrzynka zatwierdzona, podpis, kanały dopuszczone, limity, tryb testowy wyłączony świadomie przez uprawnioną osobę, kill switch przetestowany).

---

## 6. Definition of Done (każda faza)

- [ ] Kod zgodny z zasadami z sekcji 2, brak `any`, walidacja Zod na granicach.
- [ ] Lint, `tsc --noEmit`, testy jednostkowe i integracyjne zielone w CI.
- [ ] Testy izolacji tenantów dla nowych tabel.
- [ ] Migracje odwracalne lub z planem wycofania, sprawdzone na branchu Neon z danymi.
- [ ] Żadnego nowego fallbacku udającego dane.
- [ ] Nowe ekrany: stany puste/błędu z akcją, a11y, bez duplikatów widoków.
- [ ] Dokumentacja zaktualizowana (`docs/`), raport fazy z otwartymi pytaniami.

## 7. Zależności między fazami

```
F0 → F1 → F2 → F3 → F4
            ↘ F5 ↗      ↘
        F1 → F6 → F7      F9 → F10
        F8 równolegle z F3-F7
```

## 8. Otwarte pytania (wymagają decyzji człowieka)

1. D1-D6 z sekcji 4.
2. Czy telefon jest wymagany do "gotowości do sekwencji", czy brak telefonu nie blokuje maila? (brief mówi o obu danych jako wymaganych, a jednocześnie telefon jest dopuszczony tylko warunkowo)
3. Kto po stronie Fundacji prawnie ocenia dopuszczenie kanałów (art. 398 PKE) i jaką treść ma informacja dla odbiorcy? System tego nie rozstrzyga.
4. Plan Vercel i częstotliwość cronów; czy zostajemy przy kolejce w Postgresie.
5. Budżety i limity Google/LLM per tenant oraz źródło ceny jednostkowej.
6. Retencja tekstów źródłowych i danych kontaktowych.
7. Czy auto-wysyłka bez ręcznego zatwierdzenia ma w ogóle być dostępna.
8. Wartości startowe z briefu (20 rekordów, 5 dziennie, 2 dni, wykluczenia) potwierdzone przez Dawida.
9. Wykonanie potwierdzenia wpłaty przez Anię: czy tylko flaga, czy także załącznik/dowód.

## 9. Szablon promptu dla dowolnej fazy

```
Kontekst: repo procentMarketing, katalog web/. Przeczytaj docs/PLAN.md: sekcje 2 (zasady), 3 (rekonesans) oraz Fazę <N>.
Cel fazy: <skrót>. Zakres wyłączony: <co NIE jest w tej fazie>.
Zasady pracy:
1. Najpierw przedstaw plan zmian (pliki, migracje, ryzyka, testy) i czekaj na akceptację.
2. Pracuj na osobnym branchu Git i branchu Neon.
3. Dla każdego zadania: test, który oblewa przed zmianą → implementacja → test zielony → osobny commit.
4. Jeśli plan rozjeżdża się z kodem lub brakuje informacji, zatrzymaj się i zapytaj. Nie zgaduj.
5. Nie dodawaj zależności, nie ruszaj plików spoza zakresu.
Na końcu: lint, tsc --noEmit, npm test, raport (zrobione / niezrobione / decyzje / ryzyka).
```
