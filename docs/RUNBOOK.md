# Instrukcja Operacyjna Właściciela (RUNBOOK: $\le 30$ min/dzień)

Niniejszy dokument opisuje procedurę codziennej pracy z systemem **Lead Machine (Procent Marketing)** tak, aby obsługa procesu pozyskiwania klientów zajmowała właścicielowi nie więcej niż **15–30 minut dziennie**.

---

## 1. Architektura Nadzoru Człowieka (Human-in-the-Loop)

Zgodnie z wymogami prawnymi (RODO, EU AI Act art. 14) oraz zasadą bezpieczeństwa reputacji domeny:
- **System wykonuje autonomicznie**: discovery firm, audyt technologiczny stron www, ocenę potencjału (scoring), generowanie ofert na bazie dowodów, tworzenie stron `/o/[token]`, planowanie follow-upów oraz klasyfikację przychodzących odpowiedzi e-mail.
- **Człowiek podejmuje kluczowe decyzje**: zatwierdza partię wygenerowanych ofert i wiadomości przed ich fizyczną wysyłką (`approval_mode="all"`).

---

## 2. Codzienny Rytuał Właściciela (15–30 minut)

### Krok 1: Logowanie i Przegląd Poranny (5 minut)
1. Otwórz panel na `http://localhost:3000` (lub domenie produkcyjnej).
2. Zaloguj się kontem administratora.
3. Sprawdź metryki na górnym pasku:
   - Liczba nowych odpowiedzi zainteresowanych (`Zainteresowani`),
   - Zaplanowane spotkania (`Spotkania`),
   - Wykorzystany limit dzienny (np. `14 / 25 wysłanych dzisiaj`).

### Krok 2: Zatwierdzenie Partii Ofert (10 minut)
1. Przejdź do zakładki **Do akceptacji** (leady w stanie `offer_ready` / `pending_approval`).
2. Szybki rzut oka na tabelę:
   - Czy branża i miasto odpowiadają kryteriom?
   - Czy audyt wykrył realne braki (np. brak GA4, brak responsywności, brak rezerwacji online)?
   - Kliknij ikonę podglądu oferty, aby zobaczyć stronę `/o/[token]`.
3. Akcja:
   - Zaznacz wszystkie wartościowe leady i kliknij zielony przycisk **"Zatwierdź zaznaczone do wysyłki"**.
   - Leady niespełniające kryteriów odrzuć przyciskiem **"Dyskwalifikuj"** (zostaną przeniesione do `disqualified` bez wysyłki).

### Krok 3: Obsługa Odpowiedzi z Inboxa (10 minut)
1. Przejdź do zakładki **Skrzynka / Dialogi** lub sprawdź leady oznaczone jako `replied_interested` / `needs_human`.
2. Klasyfikator AI automatycznie rozpoznaje intencję:
   - **`replied_interested`**: lead prosi o spotkanie lub ofertę -> wyślij link do kalendarza spotkań lub zadzwoń.
   - **`replied_question`**: lead dopytuje o szczegóły techniczne lub cennik -> odpowiedz na konkretne pytanie.
   - **`meeting_booked`**: spotkanie zarezerwowane w kalendarzu -> zmień status na `won` po podpisaniu umowy.
   - **`unsubscribed`**: system automatycznie dodaje podmiot do `suppression list` i blokuje dalszą komunikację.

---

## 3. Autonomiczne Działanie Silnika (W Tle)

Gdy partia leadów zostanie zatwierdzona:
1. **Background Worker (`/api/worker`)**:
   - Pobiera zadania z bazy metodą `FOR UPDATE SKIP LOCKED`.
   - Weryfikuje 16 zabezpieczeń `sendMessage()`:
     - Czy nie ma pliku `STOP`?
     - Czy jest polskie okno wysyłkowe (pn–pt 08:30–16:00, bez świąt ustawowych)?
     - Czy adres nie znajduje się na liście suppression?
     - Czy dzienny limit wysyłek nie został wyczerpany?
2. **Harmonogram Follow-upów**:
   - Wiadomość 1 (Inicjalna) -> po zatwierdzeniu.
   - Follow-up 1 -> po 3 dniach roboczych braku odpowiedzi.
   - Follow-up 2 -> po kolejnych 5 dniach roboczych braku odpowiedzi.
   - Follow-up 3 (Ostatni) -> po kolejnych 7 dniach roboczych braku odpowiedzi.
   - Po 7 dniach roboczych ciszy od Follow-up 3 -> lead automatycznie przechodzi do stanu `lost` z powodem `followup_exhausted` i wchodzi w 90-dniowy cooldown.
   - **Maksymalnie 4 wiadomości wychodzące na lead** (twarda blokada systemowa Inwariant 7).

---

## 4. Procedury Awaryjne (Kill Switch)

W przypadku problemu technicznego lub konieczności natychmiastowego wstrzymania wszystkich wysyłek:

### Opcja A: Plikowy Kill Switch (Błyskawiczny)
W katalogu aplikacji utwórz plik o nazwie `STOP`:
```bash
touch STOP
```
*Efekt*: Wszystkie operacje wysyłkowe `sendMessage()` zostają natychmiast zablokowane z kodem błędu Kill Switch.

Aby wznowić wysyłkę:
```bash
rm STOP
```

### Opcja B: Kill Switch w Panelu Administratora
1. Przejdź do zakładki **Ustawienia** -> **Wysyłka i Bezpieczeństwo**.
2. Kliknij przełącznik **Awaryjny Kill Switch (Zatrzymaj wysyłkę)**.
3. Zmiana zapisywana jest natychmiast w tabeli `app_settings` i blokuje wysyłki w całej aplikacji.

---

## 5. Kluczowe Metryki Sukcesu (KPI)

System skupia się na jednej kluczowej metryce biznesowej:
$$\text{Główny cel: } \mathbf{\text{Liczba zakwalifikowanych spotkań handlowych (Qualified Meetings Booked)}}$$

Metryki wspierające:
- **Dostarczalność (Deliverability)**: wskaźnik bounce $< 2\%$, brak zgłoszeń spamu.
- **Response Rate**: odsetek odpowiedzi $\ge 8\%$.
- **Positive Reply Rate**: odsetek zainteresowanych $\ge 3\%$.
- **Czas pracy właściciela**: $\le 30$ minut na dobę.
