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

## 3. Procedura Wykonywania Praw Osób (Opt-out / Forget)

1. **Opt-out (Sprzeciw wobec marketingu)**:
   - Każde kliknięcie w link wypisania lub wysłanie maila o treści odmownej natychmiast trafia do tabeli `suppression`.
   - Adres e-mail, telefon i domena są natychmiast blokowane we wszystkich pętlach wysyłkowych.
2. **Prawo do bycia zapomnianym (`leadmachine forget --email ... / --nip ...`)**:
   - Rekord leada, kontakty i audyt są trwale usuwane z tabel `leads`, `contacts`, `audits`, `offers`.
   - Identyfikatory w tabeli `suppression` zostają zabezpieczone w postaci jednokierunkowych skrótów kryptograficznych (SHA-256) bez możliwości odtworzenia danych osobowych.
