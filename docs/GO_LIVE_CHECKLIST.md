# Checklista Przejścia na Produkcję (GO-LIVE CHECKLIST)

Przed włączeniem trybu produkcyjnego (`LIVE_MODE=true` w `.env.local` oraz włączeniem flagi w panelu administratora) należy zweryfikować i odhaczyć każdy z poniższych punktów:

## 1. Domena i Dostarczalność (Deliverability)
- [ ] Domena wysyłkowa jest **dedykowana** (np. `kontakt@procent-oferty.pl`, nie jest to główna domena agencyjna).
- [ ] Rekordy SPF, DKIM i DMARC (`p=none` lub `p=quarantine`) są poprawnie skonfigurowane w DNS domeny wysyłkowej (potwierdzone audytem w panelu lub teście `email-module.test.ts`).
- [ ] Domena przeszła proces rozgrzewki (warmup) lub limit dzienny i godzinowy jest ustawiony ostrożnie (max 5-10 maili/dzień w pierwszych dniach).
- [ ] Skrzynka pocztowa posiada poprawnie skonfigurowany nagłówek `List-Unsubscribe` oraz jednoznaczny link wypisania w stopce.
- [ ] Adres zwrotny i rekordy MX dla domeny wysyłkowej przyjmują pocztę (potwierdzony test odbioru i klasyfikacji intencji przez IMAP poller).

## 2. Prawne i RODO (Compliance)
- [ ] Sprawdzono rejestr pytań w `docs/COMPLIANCE.md` i skonsultowano podstawę przetwarzania z prawnikiem.
- [ ] W każdej wiadomości znajduje się jednoznaczna klauzula informacyjna (art. 14 RODO) oraz dane administratora (np. AM PROCENT Sp. z o.o., Legnica).
- [ ] Każda wiadomość oraz każda strona oferty `/o/[token]` zawiera działający link natychmiastowego opt-outu.
- [ ] Tabela `blocks` i `suppression` (ze skrótami SHA-256) poprawnie blokuje wysyłkę do wypisanych osób, domen, telefonów i NIP-ów.
- [ ] Przetestowano endpointy RODO: eksport danych (`GET /api/gdpr/export`) oraz prawo do bycia zapomnianym (`POST /api/gdpr/erase`).
- [ ] Spełniony wymóg EU AI Act (Artykuł 14): proces generacji oparty na dowodach (`evidence_ids`), a wysyłka wymaga zatwierdzenia przez człowieka (`approval_mode="all"` lub `approve_batch`).

## 3. Testy Techniczne i Bezpieczeństwo
- [ ] Pełny zestaw testów jednostkowych i integracyjnych przechodzi:
  - `npm test` w katalogu `web/` — 108 testów TypeScript przechodzi w 100% (pokrycie Inwariantów 1–7, scenariuszy akceptacyjnych A1–A12, kalendarza PL, skanera API, kolejki zadań i RLS).
- [ ] Typecheck i kompilacja produkcyjna przechodzą z zerem błędów:
  - `npx tsc --noEmit` kończy się z kodem 0.
  - `npm run build` w katalogu `web/` generuje wszystkie 35 tras bez błędów.
  - `npm run lint` kończy się bez błędów.
- [ ] Przetestowano `ChannelGate`: potwierdzono, że brak zgody w `channel_permissions` (status inny niż `yes`) blokuje wysyłkę SMS/WhatsApp oraz tworzy zadanie `verify_channel` zamiast telefonu.
- [ ] Przetestowano zachowanie awaryjne (Kill Switch): utworzenie pliku `STOP` w katalogu aplikacji lub włączenie flagi w bazie natychmiast blokuje wszystkie wysyłki.
- [ ] Przetestowano wysyłkę w trybie testowym: co najmniej 3 wiadomości trafiły na skrzynkę `TEST_RECIPIENTS` z prefiksem `[TEST]` w temacie.

## 4. Dedykowane Strony Ofertowe (/o/[token]) — o ile włączone w playbooku
- [ ] Oferty serwowane są natywnie przez Next.js pod adresem `/o/[token]` (bezpieczny token $\ge 22$ znaków, random hex).
- [ ] Każda strona oferty posiada nagłówki i znaczniki `<meta name="robots" content="noindex, nofollow">`.
- [ ] Daty wygaśnięcia ofert (`expiresAt`, 60 dni) są ustawione, a po wygaśnięciu wyświetlany jest elegancki komunikat.
- [ ] Link do rezerwacji spotkań w kalendarzu (np. Cal.com / Google Calendar) działa i prowadzi do właściwego terminarza.

---

Dopiero po odhaczeniu powyższych punktów przestaw:
```env
LIVE_MODE=true
```
w pliku `.env.local` oraz zatwierdź włączenie wysyłki live w panelu Ustawień.
