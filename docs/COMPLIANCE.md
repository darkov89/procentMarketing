# Rejestr Zgodności i Otwarte Pytania do Konsultacji Prawnej (COMPLIANCE.md)

Poniższy dokument rejestruje status formalno-prawny przetwarzania danych, podstawy prawne oraz listę pytań do skonsultowania z radcą prawnym / IOD.

---

## 1. Zidentyfikowane Podstawy Prawne

### A. E-mail B2B do osób prowadzących działalność gospodarczą i spółek
- **Stan faktyczny**: Pozyskanie publicznie dostępnego firmowego adresu e-mail (ze strony WWW firmy lub publicznych rejestrów CEIDG/KRS) i wysłanie indywidualnie przygotowanej oferty biznesowej z możliwością bezpłatnej konsultacji.
- **RODO**: Art. 6 ust. 1 lit. f RODO (Prawnie uzasadniony interes administratora w postaci marketingu bezpośredniego własnych usług B2B).
- **Obowiązek informacyjny**: Art. 14 RODO (pozyskanie danych w sposób inny niż od osoby, której dane dotyczą) zawarty bezpośrednio w stopce pierwszej wiadomości oraz na stronie dedykowanej oferty.
- **Ustawa o świadczeniu usług drogą elektroniczną (u.ś.u.d.e.) / Prawo Komunikacji Elektronicznej (PKE)**:
  - Wiadomość kierowana jest na publiczny adres firmowy o charakterze ogólnym/kontaktowym.
  - Treść nie ma charakteru agresywnego spamu masowego, lecz spersonalizowanego audytu lokalnego (relacja B2B).
  - W każdej wiadomości zapewniony jest natychmiastowy i bezwarunkowy opt-out.

### B. SMS i WhatsApp
- **Twarda blokada systemowa (`ChannelGate`)**:
  - Zgodnie z art. 172 Prawa Telekomunikacyjnego / PKE, używanie telekomunikacyjnych urządzeń końcowych i automatycznych systemów wywołujących dla celów marketingu bezpośredniego wymaga **uprzedniej wyraźnej zgody**.
  - W systemie Lead Machine kanały SMS i WhatsApp są domyślnie **zablokowane**.
  - Wysyłka jest możliwa **wyłącznie** po uzyskaniu aktywnej zgody (np. pozostawienie numeru w formularzu rezerwacji na stronie oferty lub bezpośrednia pisemna prośba klienta w odpowiedzi na e-mail).

---

## 2. Pytania do Konsultacji z Radcą Prawnym

Przed skalowaniem wolumenu wysyłek zaleca się uzyskanie pisemnej opinii prawnej w następujących kwestiach:

1. **Kwalifikacja pierwszej wiadomości B2B**:
   - *Pytanie*: Czy wysłanie zaproszenia na 15-minutową bezpłatną konsultację z linkiem do spersonalizowanego audytu na adres kontaktowy jednoosobowej działalności gospodarczej (JDG) kwalifikuje się jako prawnie uzasadniony interes (art. 6 ust. 1 lit. f RODO), czy wymaga wcześniejszej zgody na przesłanie informacji handlowej?
2. **Brzmienie klauzuli informacyjnej z art. 14 RODO**:
   - *Pytanie*: Czy skrócona klauzula informacyjna w stopce maila z odesłaniem do pełnej polityki prywatności na `procentmarketing.pl/assets/PolitykaPrywatności-RODO.pdf` jest wystarczająca w świetle najnowszych wytycznych Prezesa UODO?
3. **Retencja danych w rejestrze `suppression`**:
   - *Pytanie*: Czy w przypadku skorzystania przez odbiorcę z prawa do sprzeciwu / żądania usunięcia danych (art. 17 RODO), administrator ma prawo zachować haszowany adres e-mail / telefon na liście suppression wyłącznie w celu zapobieżenia ponownej wysyłce w przyszłości? (Stanowisko doktryny: tak, jako realizacja obowiązku nienaruszania woli odbiorcy).
4. **Odpowiedzi ze skrzynek imiennych pracowników**:
   - *Pytanie*: W jaki sposób traktować sytuację, w której odpowiedź na maila firmowego wysyła konkretny pracownik ze swojej imiennej skrzynki (np. dyrektor marketingu)?

---

## 3. Techniczna Egzekucja Zgodności (RODO / PKE Architecture)

System implementuje mechanizmy privacy-by-design oraz techniczne wsparcie dla praw osób, których dane dotyczą:

1. **Obowiązek Informacyjny (Art. 14 RODO)**:
   - Każda pierwsza wiadomość wychodząca zawiera w stopce jawną informację o tożsamości administratora, podstawie przetwarzania (art. 6 ust. 1 lit. f RODO) oraz bezwarunkowy link lub instrukcję opt-out.
2. **Prawo Dostępu do Danych (Art. 15 RODO - Eksport Danych)**:
   - Dedykowany endpoint `GET /api/gdpr/export?leadId={id}` (oraz `?email={email}`) zwraca całościowy profil przetwarzanych danych: rekord leada, powiązane kontakty, historię wysłanych wiadomości, uprawnienia kanałowe i audyt zdarzeń w formacie JSON.
   - Endpoint jest zabezpieczony uwierzytelnieniem (`requireUser()`) i twardą izolacją tenanta.
3. **Prawo do Usunięcia Danych (Art. 17 RODO - Prawo do Bycia Zapomnianym)**:
   - Dedykowany endpoint `POST /api/gdpr/erase` realizuje procedurę trwałego usunięcia:
     - Dane osobowe w tabelach `leads` oraz `contacts` podlegają natychmiastowej anonimizacji (zastąpienie nazw i identyfikatorów zanonimizowanymi placeholderami).
     - Otwarte zadania są anulowane (`tasks.status = 'cancelled'`), a aktywne przebiegi sekwencji zatrzymane (`sequence_runs.status = 'stopped'`).
     - **Nieodwracalne skróty kryptograficzne**: Adres e-mail, domena, telefon i NIP są haszowane algorytmem SHA-256 i zapisywane w tabelach `blocks` oraz `suppression`. Dzięki temu identyfikatory nie są przetrzymywane w formie jawnej, a system trwale uniemożliwia ponowny kontakt nawet w przypadku ponownego zaimportowania zewnętrznych baz danych.
4. **Minimalizacja Danych i Retencja (Art. 5 ust. 1 lit. c RODO)**:
   - Okresowe zadanie w tle (`cleanup` w `registry.ts`) automatycznie czyści obszerne surowe zrzuty HTML i teksty audytowe (`audits.rawEvidence`) dla leadów w stanach terminalnych (`lost`, `disqualified`, `unsubscribed`) starszych niż zdefiniowany czas retencji tenanta (domyślnie 90 dni).
5. **Egzekucja Zgód Komunikacji Elektronicznej (PKE / art. 172 PT)**:
   - Wszystkie kanały bezpośrednie (telefon, SMS, WhatsApp) są kontrolowane przez tabelę `channel_permissions`.
   - Domyślny stan uprawnienia to `to_check`.
   - Brak zatwierdzonego statusu `yes` uniemożliwia wygenerowanie zadania telefonicznego w sekwencji – system tworzy zamiast tego zadanie weryfikacji uprawnień (`verify_channel`) dla człowieka.

