# Checklista Przejścia na Produkcję (GO-LIVE CHECKLIST)

Przed ustawieniem `LIVE_MODE=true` w pliku `.env` musisz zweryfikować i odhaczyć każdy z poniższych punktów:

## 1. Domena i Dostarczalność (Deliverability)
- [ ] Domena wysyłkowa jest **dedykowana** (nie jest to główna domena `procentmarketing.pl`).
- [ ] Rekordy SPF, DKIM i DMARC (`p=none` lub `p=quarantine`) są poprawnie skonfigurowane w DNS domeny wysyłkowej.
- [ ] Domena przeszła proces rozgrzewki (warmup) lub limit dzienny jest ustawiony na max 5-10 maili/dzień w pierwszych dniach.
- [ ] Skrzynka pocztowa posiada poprawnie skonfigurowany nagłówek `List-Unsubscribe`.
- [ ] Adres zwrotny i MX dla domeny wysyłkowej przyjmuje pocztę (test wysłania maila na ten adres).

## 2. Prawne i RODO (Compliance)
- [ ] Sprawdzono rejestr pytań w `docs/COMPLIANCE.md` i skonsultowano podstawę przetwarzania z prawnikiem.
- [ ] W każdej wiadomości znajduje się jednoznaczna klauzula informacyjna (art. 14 RODO) oraz dane administratora (AM PROCENT Sp. z o.o., Legnica).
- [ ] Każda wiadomość oraz każda strona oferty zawiera działający link/przycisk natychmiastowego opt-outu.
- [ ] Baza `suppression` poprawnie blokuje wysyłkę do wypisanych osób i podmiotów.

## 3. Testy Techniczne i Bezpieczeństwo
- [ ] Wszystkie testy jednostkowe i integracyjne przechodzą (`pytest`).
- [ ] Przetestowano `ChannelGate`: potwierdzono, że brak zgody w tabeli `consents` rzuca wyjątek i uniemożliwia wysyłkę SMS/WhatsApp.
- [ ] Przetestowano zachowanie awaryjne: utworzenie pliku `STOP` w katalogu głównym natychmiast zatrzymuje pętlę wysyłki.
- [ ] Zweryfikowano działanie testowe: wysłano co najmniej 3 testowe maile na skrzynkę `TEST_RECIPIENTS` i sprawdzono ich formatowanie na urządzeniach mobilnych i desktopie.
- [ ] Zweryfikowano, że w wygenerowanych plikach ofertowych na Netlify nie ma żadnych kluczy API, haseł ani danych wrażliwych.

## 4. Oferty i Linki
- [ ] Link do rezerwacji spotkań w kalendarzu (np. Cal.com / Google Calendar) działa i prowadzi do właściwego terminarza.
- [ ] Wszystkie strony ofertowe posiadają znacznik `<meta name="robots" content="noindex, nofollow">`.
- [ ] Formularz opt-out na Netlify przekazuje zgłoszenia do panelu i bazy.

---
Dopiero po odhaczeniu powyższych punktów przestaw:
```env
LIVE_MODE=true
```
w pliku `.env` i uruchom pętlę wysyłkową.
