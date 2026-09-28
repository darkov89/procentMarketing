# Lead Machine - Procent Marketing

Autonomiczny system B2B dla agencji **Procent Marketing** (Legnica), automatyzujący pozyskiwanie lokalnych leadów, mini-audyt marketingowy, generowanie dedykowanych ofert i komunikację z potencjalnymi klientami.

---

## Szybki Start

### 1. Wymagania i instalacja
- Python 3.12+
- `uv` (Fast Python package manager)

```bash
# Instalacja zależności
uv pip install -e ".[dev]"

# Skopiowanie pliku konfiguracyjnego
cp .env.example .env
```

### 2. Dostępne Polecenia CLI
```bash
# Skanowanie i import leadów z pliku próbki (dry-run generuje leads.xlsx bez zapisu do bazy)
leadmachine scan --input path/to/leads.csv --dry-run

# Import leadów z walidacją geo i rejestracją w SQLite
leadmachine scan --input path/to/leads.csv

# Eksport bieżącej bazy do pliku Excel
leadmachine export --output leads.xlsx

# Sprawdzenie statusu suppression list / wyczyszczenie danych leada (RODO)
leadmachine suppress --email kontakt@firma.pl --reason "opt-out"
leadmachine forget --nip 1234567890
```

---

## Główne Zasady Bezpieczeństwa
- `LIVE_MODE=false` domyślnie — brak możliwości przypadkowego wysłania wiadomości na zewnątrz.
- Wymóg zatwierdzenia każdej oferty i maila w panelu Streamlit (`approval_mode=all`).
- Twardy `ChannelGate` blokujący wysyłkę SMS/WhatsApp w przypadku braku odnotowanej zgody.
- Zob. [`AGENTS.md`](./AGENTS.md) oraz [`docs/GO_LIVE_CHECKLIST.md`](./docs/GO_LIVE_CHECKLIST.md).
