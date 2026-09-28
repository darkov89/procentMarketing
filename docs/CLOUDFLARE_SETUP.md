# Przewodnik Wystawienia Panelu UI na Cloudflare (CLOUDFLARE_SETUP.md)

System Lead Machine posiada panel kontrolny Streamlit przygotowany do bezpośredniej pracy za proxem / tunelem **Cloudflare** (zoptymalizowany pod WebSockety, brak konfliktów CORS i responsywny dark-mode).

---

## Opcja 1: Błyskawiczny publiczny tunel (Quick Tunnel) — bez logowania

Najszybsza metoda, aby przetestować panel online na telefonie lub z dowolnego komputera. Cloudflare generuje losową, darmową subdomenę z certyfikatem SSL:

```bash
./run_cloudflare_tunnel.sh
```

W terminalu pojawi się publiczny adres HTTPS, np.:
```
https://random-subdomain.trycloudflare.com
```
Po wejściu pod ten adres panel jest natychmiast dostępny w Internecie.

---

## Opcja 2: Stała domena z Cloudflare Zero Trust (Rekomendowane)

Jeśli chcesz mieć panel pod stałym adresem (np. `panel.procentmarketing.pl` lub `leadmachine.twojadomena.pl`) zabezpieczony darmowym logowaniem (kod PIN przesyłany na Twój e-mail):

### 1. Zaloguj się do Cloudflare w terminalu:
```bash
./.venv/bin/cloudflared tunnel login
```
Przeglądarka otworzy stronę Cloudflare — wybierz domenę (np. `procentmarketing.pl`).

### 2. Utwórz stały tunel:
```bash
./.venv/bin/cloudflared tunnel create leadmachine
```
Polecenie zwróci ID tunelu oraz wygeneruje plik credentials w `~/.cloudflared/<TUNNEL_ID>.json`.

### 3. Skonfiguruj plik `~/.cloudflared/config.yml`:
```yaml
tunnel: <TWÓJ_TUNNEL_ID>
credentials-file: /Users/Darek/.cloudflared/<TWÓJ_TUNNEL_ID>.json

ingress:
  - hostname: panel.procentmarketing.pl
    service: http://localhost:8501
  - service: http_status:404
```

### 4. Skieruj DNS w Cloudflare na tunel:
```bash
./.venv/bin/cloudflared tunnel route dns leadmachine panel.procentmarketing.pl
```

### 5. Uruchom tunel produkcyjny:
```bash
./.venv/bin/cloudflared tunnel run leadmachine
```

### 6. Bezpieczeństwo (Cloudflare Access / Zero Trust):
W darmowym panelu **Cloudflare Zero Trust** (`dash.teams.cloudflare.com`):
1. Przejdź do **Access** → **Applications** → **Add an application** (Self-hosted).
2. Wpisz domenę: `panel.procentmarketing.pl`.
3. Dodaj regułę (Policy): zezwalaj na dostęp wyłącznie dla Twojego adresu e-mail (`Include: Emails: twoj-email@procentmarketing.pl`).
4. Teraz przed wejściem do panelu Cloudflare automatycznie wyśle jednorazowy kod PIN na Twój telefon/mail — nikt niepowołany nie uzyska dostępu do bazy leadów!
