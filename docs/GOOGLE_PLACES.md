# Google Places API (New) - Dokumentacja, Cennik, Limity i Zasady Cache'owania

Dokument sporządzony w ramach Fazy 3 projektu **Lead Machine (Procent Marketing)** na podstawie oficjalnej dokumentacji Google Maps Platform (stan na 2026 r.).

---

## 1. Architektura API i Limity Zapytań (Text Search New)

- **Endpoint:** `https://places.googleapis.com/v1/places:searchText` (metoda POST).
- **Maksymalna liczba wyników na pojedyncze zapytanie:** **60 wyników** łącznie (twardy limit Google).
- **Paginacja:**
  - Parametr `pageSize`: od **1 do 20** (domyślnie 20).
  - Wartości > 20 są obcinane do 20 przez Google.
  - Kolejne strony pobierane przez przekazanie `nextPageToken` z odpowiedzi w polu `pageToken` kolejnego żądania.
  - Maksymalnie **3 strony po 20 wyników** per zapytanie.
- **Konsekwencja architektoniczna dla Lead Machine:**
  - Ponieważ pojedyncze zapytanie tekstowe zwraca maksymalnie 60 firm, przeszukanie całego miasta/regionu (np. "Wrocław - branża budowlana" mającego 500 firm) **wymaga podziału geograficznego na siatkę komórek** (`grid cells`).
  - Gdy komórka siatki zwróci 60 wyników (`saturated = true`), silnik wyszukiwania musi **automatycznie podzielić komórkę na 4 mniejsze podkomórki** (quad-tree split) i powtórzyć przeszukiwanie w celu uniknięcia utraty leadów.

---

## 2. Nagłówek `X-Goog-FieldMask` i Klasyfikacja SKU

Google Places API (New) wymaga podania nagłówka `X-Goog-FieldMask`. Brak nagłówka powoduje błąd `400 BAD REQUEST`.
Rozliczenie następuje na podstawie **najwyższego poziomu SKU** zawartego w żądanych polach:

1. **Text Search Essentials (IDs Only):**
   - Pola: `places.id`, `places.name` (format zasobu `places/ChIJ...`).
   - Służy do taniej enumeracji identyfikatorów.
2. **Text Search Pro (Podstawowe dane miejsca):**
   - Pola: `places.displayName`, `places.formattedAddress`, `places.location`, `places.types`, `places.rating`, `places.userRatingCount`.
   - Każde wywołanie z tymi polami nalicza stawkę **Text Search (Pro)**.
3. **Pola kontaktu (Dodatkowo płatne / Enterprise):**
   - Pola: `places.websiteUri`, `places.internationalPhoneNumber`, `places.nationalPhoneNumber`.
   - **Optymalizacja kosztowa Lead Machine:** W wyszukiwaniu po siatce (Text Search) pobieramy wyłącznie pola podstawowe (identyfikator, nazwa, adres, współrzędne, branża). Dopiero dla unikalnych firm, które przeszły filtr wstępny (deduplikacja i wykluczenia branżowe), pobieramy szczegóły kontaktu przez pojedyncze `Place Details` z minimalnym `FieldMask`.

---

## 3. Cennik i Estymata Kosztu

- Google Maps Platform stosuje model progów miesięcznych per billing account (darmowa pula na start) oraz rozliczenie pay-as-you-go za 1000 zapytań:
  - Text Search (Pro): orientacyjnie ok. $32 - $40 za 1000 żądań ($0.032 - $0.040 per request).
  - Place Details: rozliczane w zależności od żądanego zestawu pól.
- **Zasada Lead Machine:**
  - Cena za żądanie **nigdy nie jest zaszyta w kodzie aplikacji**.
  - Koszt estymowany jest z konfiguracji tenanta (`tenant_limits` / ustawienia platformy).
  - Wzór estymacji przed uruchomieniem zadania:
    $$\text{Szacowany koszt} = \text{Liczba komórek siatki} \times \text{Szacowana liczba stron (1 do 3)} \times \text{Stawka jednostkowa}$$
  - Przed startem użytkownik widzi estymatę liczby zapytań i kosztu.
  - Wywołanie `consume(tenantId, 'google_requests', count)` atomowo blokuje dalsze pobieranie w razie przekroczenia zdefiniowanego limitu tenanta.

---

## 4. Zasady Cache'owania i Retencji Danych Google (Terms of Service)

Regulamin Google Maps Platform nakłada ścisłe ograniczenia dotyczące przechowywania danych poza pamięcią podręczną:

1. **Identyfikatory miejsc (`place_id`):**
   - Dozwolone jest przechowywanie `place_id` **bezterminowo** w celach deduplikacji i relacji.
2. **Współrzędne geograficzne (Latitude / Longitude):**
   - Dozwolone jest tymczasowe przechowywanie przez maksymalnie **30 kolejnych dni kalendarzowych**. Po tym czasie współrzędne muszą zostać zaktualizowane lub usunięte.
3. **Pola dynamiczne (oceny, opinie, zdjęcia):**
   - Zakaz trwałego przechowywania i indeksowania jako własna baza danych. Służą wyłącznie do bezpośredniej oceny leada w danym runie.
4. **Data pobrania danych (`fetched_at`):**
   - Każdy rekord pochodzący z Google Places posiada jawne znaczniki `source = 'google_places'` oraz `fetched_at`, co zapewnia pełną audytowalność (provenance) oraz umożliwia automatyczną politykę odświeżania.
