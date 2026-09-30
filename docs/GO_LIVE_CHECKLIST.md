# Checklista Przejścia na Produkcję (GO-LIVE CHECKLIST)

Przed włączeniem trybu produkcyjnego (`LIVE_MODE=true` w `.env.local` oraz włączeniem flagi w panelu administratora) musisz zweryfikować i odhaczyć każdy z poniższych punktów:

## 1. Domena i Dostarczalność (Deliverability)
- [ ] Domena wysyłkowa jest **dedykowana** (np. `kontakt@procent-oferty.pl`, nie jest to główna domena agencyjna).
- [ ] Rekordy SPF, DKIM i DMARC (`p=none` lub `p=quarantine`) są poprawnie skonfigurowane w DNS domeny wysyłkowej.
- [ ] Domena przeszła proces rozgrzewki (warmup) lub limit dzienny jest ustawiony na max 5-10 maili/dzień w pierwszych dniach.
- [ ] Skrzynka pocztowa posiada poprawnie skonfigurowany nagłówek `List-Unsubscribe` oraz jednoznaczny link wypisania w stopce.
- [ ] Adres zwrotny i rekordy MX dla domeny wysyłkowej przyjmują pocztę (przetestowano odbiór odpowiedzi).

## 2. Prawne i RODO (Compliance)
- [ ] Sprawdzono rejestr pytań w `docs/COMPLIANCE.md` i skonsultowano podstawę przetwarzania z prawnikiem.
- [ ] W każdej wiadomości znajduje się jednoznaczna klauzula informacyjna (art. 14 RODO) oraz dane administratora (AM PROCENT Sp. z o.o., Legnica).
- [ ] Każda wiadomość oraz każda strona oferty `/o/[token]` zawiera działający link natychmiastowego opt-outu.
- [ ] Tabela `suppression` (z haszami SHA-256) poprawnie blokuje wysyłkę do wypisanych osób, domen i NIP-ów.
- [ ] Spełniony wymóg EU AI Act (Artykuł 14): proces generacji oparty na dowodach (`evidence_ids`), a wysyłka wymaga zatwierdzenia przez człowieka (`approval_mode="all"`).

## 3. Testy Techniczne i Bezpieczeństwo
- [ ] Wszystkie testy jednostkowe i integracyjne przechodzą:
  - `npm test` w katalogu `web/` (21 testów TS weryfikujących Inwarianty 1-7, kalendarz PL, scanner API i maszynę stanów).
  - `pytest` w katalogu głównym (35 testów Python).
- [ ] Typecheck i kompilacja produkcyjna przechodzą:
  - `npx tsc --noEmit` kończy się z kodem 0.
  - `npm run build` w katalogu `web/` generuje wszystkie 22 trasy bez błędów.
  - `npm run lint` kończy się bez błędów.
- [ ] Przetestowano `ChannelGate`: potwierdzono, że brak zgody w tabeli `consents` natychmiast blokuje wysyłkę SMS/WhatsApp.
- [ ] Przetestowano zachowanie awaryjne (Kill Switch): utworzenie pliku `STOP` w katalogu aplikacji natychmiast blokuje wszystkie wysyłki.
- [ ] Przetestowano wysyłkę w trybie testowym: co najmniej 3 wiadomości trafiły na skrzynkę `TEST_RECIPIENTS` z prefiksem `[TEST]` w temacie.

## 4. Dedykowane Strony Ofertowe (/o/[token])
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
