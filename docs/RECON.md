# RAPORT REKONESANSU: FAZA 0 (docs/RECON.md)

> Wygenerowano: 2026-10-06  
> Środowisko: gałąź `fix/phase-0-hotfixes` (snapshot kodu na `wip/szumi-las-snapshot` / tag `snapshot-pre-plan` / branch Neon `snapshot-pre-plan`).

---

## 1. Weryfikacja podejrzeń P1 – P16 z PLAN.md

| # | Podejrzenie | Status | Dowód w kodzie (plik i linia) |
|---|---|---|---|
| **P1** | Zmyślone wartości: `|| 4.7`, `|| 15`, `|| 18`, `lat || centerPoint.lat` | **POTWIERDZONE** | `src/app/api/scraper/route.ts:403` (`rating \|\| 4.7`), `l.404` (`reviewsCount \|\| 15`), `l.601` (`rating \|\| 4.7`), `l.602` (`reviewsCount \|\| 18`). Naruszenie zasady **R1**. |
| **P2** | Fallback `user.tenantId \|\| 1` | **POTWIERDZONE** | `api/pipeline/route.ts:30`, `api/leads/route.ts:16`, `api/leads/route.ts:85`, `api/tenants/route.ts:28`, `api/outreach/history/route.ts:9`, `api/tasks/route.ts:9`, `api/deals/route.ts:9`, `src/app/o/[token]/page.tsx:78`. Naruszenie zasady **R4**. |
| **P3** | `validateSessionToken` przypisuje tenanta `procent-marketing` przy braku membership lub błędzie | **POTWIERDZONE** | `src/lib/auth.ts:149-173` — domyślny obiekt `{ tenantId: 1, tenantSlug: "procent-marketing" }` przypisywany przy braku rekordów w `tenant_members` lub w bloku `catch`. Naruszenie **R4**. |
| **P4** | `app_settings.key` jest globalnie `UNIQUE`, mimo `tenant_id` | **POTWIERDZONE** | `src/lib/db/schema.ts:245` — `key: varchar("key", { length: 100 }).unique().notNull()`. Uniemożliwia niezależne ustawienia per tenant. |
| **P5** | Konfiguracja maila ustawia `process.env.SMTP_PASSWORD` w runtime i zapisuje hasła jawnie w `app_settings` | **POTWIERDZONE** | `src/app/api/settings/mail/route.ts:109` (`process.env.SMTP_PASSWORD = body.smtpPass`), `l.128` (`process.env.IMAP_PASSWORD = body.imapPass`). Naruszenie **R9**. |
| **P6** | Tabele bez `tenant_id` lub z nullable `tenant_id` | **POTWIERDZONE** | `schema.ts`: `audits`, `evidence`, `events`, `consents`, `jobs`, `invitations`, `service_catalog`, `users` nie mają kolumny `tenant_id`. Ponadto `leads.tenant_id`, `contacts.tenant_id`, `offers.tenant_id`, `messages.tenant_id`, `suppression.tenant_id`, `app_settings.tenant_id` są zdefiniowane jako **nullable** (brak `.notNull()`). |
| **P7** | Brak RLS, driver `neon-http` | **POTWIERDZONE** | `src/lib/db/index.ts:2,12` — używa `drizzle-orm/neon-http` i bezstanowego klienta `neon()`. Brak wsparcia dla sesyjnego `set_config('app.tenant_id', ...)` i brak polityk RLS w bazie. |
| **P8** | Domyślny kod zaproszenia `PROCENT-START-2026` | **POTWIERDZONE** | `src/lib/auth.ts:7` — `export const BOOTSTRAP_INVITE_CODE = process.env.BOOTSTRAP_INVITE_CODE || "PROCENT-START-2026";`. |
| **P9** | Brak `vercel.json` i crona; worker uruchamiany ręcznie | **POTWIERDZONE** | Brak pliku `vercel.json`. `jobs` przetwarzane tylko po wywołaniu `/api/worker` (brak cron ticka). |
| **P10** | Wyszukiwanie: jeden Text Search, brak siatki i paginacji | **POTWIERDZONE** | `src/lib/google-places.ts:168-185` — pojedynczy strzał do `places:searchText` z `pageSize: Math.min(maxResults, 20)`, brak podziału na komórki i brak obsługi saturacji. |
| **P11** | `page.tsx` ma ponad 7100 linii i ~93 `useState` | **POTWIERDZONE** | `src/app/page.tsx` ma **7327 linii** i 96 wystąpień `useState`. |
| **P12** | `.env.example` jest nieaktualny (SQLite, Netlify, SMS) | **POTWIERDZONE** | `.env.example` zawiera `sqlite:///leadmachine.db`, `SMSAPI_TOKEN`, `TELEGRAM_BOT_TOKEN`, `NETLIFY_*`. Brak `CRON_SECRET`, `SECRETS_ENCRYPTION_KEY`, `APP_BASE_URL`. |
| **P13** | Znaczniki czasu bez strefy (`withTimezone: false`) | **POTWIERDZONE** | `schema.ts:20,33,66...` — 33 kolumny `timestamp` używają `{ withTimezone: false }`. |
| **P14** | `LIVE_MODE`, `TEST_RECIPIENTS`, kill switch są globalne w env | **POTWIERDZONE** | `src/lib/send-service.ts:182-205` — sprawdza globalny plik `STOP`, `process.env.LIVE_MODE` oraz globalny rekord w `app_settings`. |
| **P15** | `companyScale` / `verifiedScale` przyjmuje domyślne `"mikro"` bez źródła | **POTWIERDZONE** | `src/app/api/scraper/route.ts:544` (`let verifiedScale = item.companyScale || "mikro"`), `l.588` (`industry: item.industry || (verifiedScale === "mikro" ? "Mikroprzedsiębiorstwo" : "MŚP")`). |
| **P16** | `contact_basis` domyślnie `inquiry`, jedno pole na lead | **POTWIERDZONE** | `schema.ts:65` — `contactBasis: varchar("contact_basis", { length: 50 }).default("inquiry")`. Brak podziału na kanały. |

---

## 2. Odpowiedzi na 10 pytań kontrolnych z Sekcji D (z dowodami z kodu)

1. **Czy zadanie telefoniczne powstaje dopiero po udanym wysłaniu (potwierdzenie SMTP), a nie po zakolejkowaniu lub zatwierdzeniu?**
   - **POTWIERDZONE.** W `src/lib/send-service.ts:571-594` wywołanie `scheduleCallTaskAfterEmail()` następuje **wyłącznie po** sekcji `// Successfully accepted by SMTP server!` i aktualizacji `messages.status = 'sent'`.
2. **Czy zadanie telefoniczne powstaje wyłącznie gdy telefon jest dopuszczony; co się dzieje przy `to_check`?**
   - **POTWIERDZONE.** W `src/lib/lead-tasks-service.ts:50-65`: jeśli `modules.compliancePke` jest włączone, a `lead.pkePhoneStatus !== "allowed"`, zadanie telefoniczne jest **blokowane** (`created: false`), a do `lead_events` trafia wpis audytowy. Status `needs_review` / `to_check` nie pozwala na utworzenie zadania telefonicznego.
3. **Czy blokada kanału bez dopuszczenia jest egzekwowana w `sendMessage`, a nie tylko w UI?**
   - **OBALONE (LUKA WYSYŁKI E-MAIL).** W `src/lib/send-service.ts` jest blokada dla `lead.isFixture`, kill switch, suppression list oraz okno czasowe, ale **brakuje sprawdzenia `pkeEmailStatus === 'allowed'`** przed fizycznym wysłaniem maila. Kontrola istniała tylko po stronie planowania telefonu! Wymaga dodania bramki PKE w `sendMessage`.
4. **Czy błąd lub zwrot maila wstrzymuje zadanie telefoniczne?**
   - **CZĘŚCIOWO POTWIERDZONE.** Przy błędzie SMTP w `src/lib/send-service.ts:545` wywoływane jest `cancelPendingTasksForLead({ reason: "Błąd wysyłki SMTP..." })`. Jednak dla asynchronicznego bounce (DSN odebranego przez IMAP w `mail-service.ts`) anulowanie zadań telefonicznych nie było dotąd podpięte.
5. **Czy odpowiedź, odmowa i wypisanie zatrzymują sekwencję i anulują otwarte zadania?**
   - **CZĘŚCIOWO.** `mail-service.ts` zmienia stan leada na `unsubscribed` / `replied_interested` / `replied_negative`, ale anulowanie otwartych `lead_tasks` przy wypisaniu przez IMAP wymagało jawnego wywołania `cancelPendingTasksForLead`.
6. **Czy ponowny import zachowuje blokady (suppression) i nie wysyła ponownie?**
   - **POTWIERDZONE.** `isSuppressed()` weryfikuje skróty SHA-256 w tabeli `suppression` tuż przed fizycznym wywołaniem transportu SMTP (`send-service.ts:258`), niezależnie od tego, kiedy i ile razy lead został zaimportowany.
7. **Czy tabele `lead_tasks` i `lead_deals` mają `tenant_id NOT NULL` oraz FK?**
   - **POTWIERDZONE.** W `src/lib/db/schema.ts` (na snapshotcie):
     - `leadTasks.tenantId`: `integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull()`.
     - `leadDeals.tenantId`: `integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull()`.
8. **Kto może potwierdzić wpłatę: czy istnieje kontrola uprawnienia (Ania), czy każdy zalogowany użytkownik?**
   - **OBALONE (LUKA BEZPIECZEŃSTWA).** W `src/app/api/deals/route.ts:89,111` każdy zalogowany użytkownik wysyłający `action: "confirm_payment"` może potwierdzić wpłatę. Brak kontroli roli lub uprawnienia `confirm_payment`.
9. **Czy dane z `seed-szumi-las.ts` są oznaczone jako fixture i czy test pokazuje, że nie mogą wejść do wysyłki?**
   - **OBALONE (LUKA DANYCH).** W `web/scripts/seed-szumi-las.ts` leady były wstawiane **bez flagi `isFixture: true`**. Oznacza to ryzyko, że próbne leady mogłyby zostać wysłane, gdyby podano prawdziwe maile. Wymaga poprawy w skrypcie seedującym.
10. **Czy stan "Brak kontaktu" jest obsługiwany jako pełnoprawny?**
    - **OBALONE.** W `src/lib/state-machine.ts` statusy to m.in. `new`, `needs_review`, `qualified`, `disqualified`. Brak dedykowanego stanu domenowego `no_contact` z akcją powrotu po uzupełnieniu danych.

---

## 3. Inwentaryzacja endpointów API (`src/app/api/**`)

| Endpoint | `requireUser()`? | Filtr `tenantId`? | Uwagi |
|---|---|---|---|
| `api/scraper` | TAK | **NIE** | Używa globalnego `app_settings` i globalnej bazy leadów |
| `api/qualify/[id]` | TAK | **NIE** | Wyszukuje leada tylko po `leads.id` |
| `api/settings/targeting` | TAK | **NIE** | Zapisuje w `app_settings` bez filtra tenanta |
| `api/settings/mail` | TAK | **NIE** | Zapisuje hasła w `process.env` w runtime |
| `api/settings/test-smtp` | TAK | **NIE** | Testuje globalne zmienne SMTP |
| `api/settings/sender-profile` | TAK | **NIE** | Zapisuje `sender_profile` w `app_settings` bez tenanta |
| `api/settings/test-imap` | TAK | **NIE** | Testuje globalne zmienne IMAP |
| `api/settings/test-google-api` | TAK | **NIE** | Testuje globalny klucz Google |
| `api/offers/[id]` | TAK | **NIE** | Brak weryfikacji `offer.tenantId == user.tenantId` |
| `api/pipeline` | TAK | TAK (`\|\| 1`) | Posiada fallback `user.tenantId \|\| 1` |
| `api/inbox/poll` | TAK | **NIE** | Odpytuje globalną skrzynkę pocztową |
| `api/auth/logout` | NIE | - | Publiczny endpoint czyszczenia ciasteczka sesji |
| `api/auth/register` | NIE | - | Publiczny endpoint rejestracji (podatny na P8) |
| `api/auth/me` | NIE | - | Samodzielnie czyta token sesji |
| `api/auth/users/[id]` | NIE | - | Weryfikacja sesji wewnątrz handlera |
| `api/auth/login` | NIE | - | Publiczny endpoint logowania |
| `api/auth/invitations` | NIE | - | Weryfikacja sesji wewnątrz handlera |
| `api/auth/invitations/[id]` | NIE | - | Weryfikacja sesji wewnątrz handlera |
| `api/leads` | TAK | TAK (`\|\| 1`) | Posiada fallback `user.tenantId \|\| 1` |
| `api/leads/[id]` | TAK | **NIE** | Zwraca/edytuje leada bez weryfikacji `tenantId` |
| `api/tenants` | TAK | TAK (`\|\| 1`) | Fallback `activeTenantId: user.tenantId \|\| 1` |
| `api/audit/[id]` | TAK | **NIE** | Odpala audyt po `leadId` bez sprawdzenia tenanta |
| `api/export` | TAK | **NIE** | Eksportuje wszystkie leady w bazie |
| `api/worker` | NIE | **NIE** | Endpoint wywoływany bez autoryzacji (brak tokenu CRON) |
| `api/outreach/send-all` | TAK | **NIE** | Pobiera leady do wysyłki bez filtra tenanta |
| `api/outreach/history` | TAK | TAK (`\|\| 1`) | Posiada fallback `user.tenantId \|\| 1` |
| `api/outreach/[id]` | TAK | **NIE** | Pobiera historię wiadomości leada bez sprawdzenia tenanta |
| `api/tasks` | TAK | TAK (`\|\| 1`) | Wprowadzony w snapshotcie |
| `api/deals` | TAK | TAK (`\|\| 1`) | Wprowadzony w snapshotcie |
| `api/tenants/switch` | TAK | TAK | Weryfikuje członkostwo |

---

## 4. Inwentaryzacja miejsc zmiany statusu leada

Wszystkie mutacje statusu leada w bazie przechodzą przez strażnika inwariantu `transitionLead()`:
- `src/app/api/pipeline/route.ts` (l. 66, 100, 178)
- `src/app/api/leads/[id]/route.ts` (l. 88)
- `src/app/api/audit/[id]/route.ts` (l. 27, 69)
- `src/lib/job-runner.ts` (l. 129, 142, 154, 216, 275)
- `src/lib/mail-service.ts` (l. 444, 479, 488, 497, 506)
- `src/lib/send-service.ts` (l. 347, 541, 578)

W kodzie nie ma bezpośrednich zapytań `db.update(leads).set({ status: ... })` z pominięciem `transitionLead()`, co potwierdza zachowanie Inwariantu 3.
