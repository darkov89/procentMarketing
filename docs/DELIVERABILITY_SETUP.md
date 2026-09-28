# Przewodnik Konfiguracji Dostarczalności Poczty (DELIVERABILITY_SETUP.md)

Aby Twoje wiadomości trafiały prosto do skrzynki odbiorczej (Inbox), a nie do spamu, wykonaj poniższe kroki na swojej domenie dedykowanej do wysyłki.

---

## 1. Złota Zasada Domeny
- **NIGDY** nie wysyłaj cold maili z głównej domeny biznesowej (`procentmarketing.pl`).
- Zarejestruj domenę alternatywną, np. `procent-marketing.pl`, `procentb2b.pl` lub `procent-kontakt.pl`.
- Skonfiguruj przekierowanie 301 z domeny wysyłkowej na główną domenę agencji `https://procentmarketing.pl/`.

---

## 2. Rekordy DNS: SPF, DKIM i DMARC

### A. Rekord SPF (TXT)
Określa serwery uprawnione do wysyłania poczty z Twojej domeny.
- Dla Google Workspace:
  ```txt
  v=spf1 include:_spf.google.com ~all
  ```
- Dla własnego serwera SMTP (np. cyberfolks):
  ```txt
  v=spf1 ip4:TWÓJ_ADRES_IP include:_spf.twojhosting.pl ~all
  ```

### B. Rekord DKIM (TXT)
Klucz kryptograficzny potwierdzający autentyczność nadawcy.
- Wygeneruj selektor DKIM w panelu dostawcy poczty (Google Workspace Admin lub cPanel/DirectAdmin).
- Dodaj wygenerowany rekord TXT w strefie DNS domeny, np.:
  ```txt
  google._domainkey.twoja-domena.pl.  TXT  "v=DKIM1; k=rsa; p=MIIBIjANBgkq..."
  ```

### C. Rekord DMARC (TXT)
Zabezpiecza przed podszywaniem się pod domenę i raportuje błędy dostarczalności.
- Dodaj rekord TXT dla poddomeny `_dmarc`:
  ```txt
  _dmarc.twoja-domena.pl.  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc-raporty@twoja-domena.pl; pct=100; sp=quarantine"
  ```
  *(W pierwszych 7 dniach można ustawić `p=none`, następnie przejść na `p=quarantine`).*

---

## 3. Plan Rozgrzewki Skrzynki (Email Warmup)

Nowa domena i nowa skrzynka nie posiadają reputacji w filtrach Google / Microsoft.
Stosuj ścisły harmonogram zwiększania wolumenu:

| Dzień | Maks. liczba maili/dzień | Odstęp między mailami |
|---|---|---|
| Dni 1–3 | 5 maili | 30–60 minut |
| Dni 4–7 | 10 maili | 15–30 minut |
| Dni 8–14 | 20 maili | 10–20 minut |
| Od dnia 15 | 30 maili (limit docelowy) | 5–15 minut |

W systemie Lead Machine harmonogram ten jest automatycznie wymuszany przez moduł wysyłki.

---

## 4. Wytyczne Treści Antyspamowej
1. **Format**: Czysty tekst (`plain text`) lub maksymalnie uproszczony HTML bez ciężkich ramek i stylów inline.
2. **Zero pikseli śledzących**: Niewidoczne piksele 1x1 są często flagowane przez filtry korporacyjne.
3. **Maksymalnie jeden link**: Link prowadzący wyłącznie do dedykowanej oferty `https://oferta.twoja-domena.pl/o/<slug>`.
4. **Nagłówek `List-Unsubscribe`**: Umożliwia klientowi poczty natychmiastowe wypisanie bez zgłaszania jako spam.
5. **Długość tekstu**: Zwięzła treść (~70–90 słów), konkretna obserwacja z Legnicy, brak natarczywych wezwań ("KUP TERAZ", "OKAZJA").
