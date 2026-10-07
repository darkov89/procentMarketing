# UI Migration Map (Faza 8)

Mapa funkcji monolitu `web/src/app/page.tsx` (7146 linii) → docelowe trasy. Przenosimy ekran po ekranie; po każdym przeniesieniu (i teście e2e) usuwamy odpowiadający kod z `page.tsx`.

| Obecnie w `page.tsx` | Docelowa trasa | Status |
|---|---|---|
| `activeTab="settings"` (SMTP/IMAP, klucze API, targetowanie, profil nadawcy) | `/settings` (`?tab=mail\|api\|targeting\|sender`) | ✅ (Dedicated modular route) |
| `activeTab="crm"` (tabela leadów, filtry, akcje masowe) | `/leads` | ✅ (Modular route + toolbar + table + pagination + bulk actions) |
| Drawer leada (`drawerTab=details\|audit\|offer\|email`) | `/leads/[id]?tab=dane\|dowody\|kontakt\|oferta\|korespondencja\|zadania\|historia` | ✅ (Dedicated Dossier route + 7 modular tabs) |
| `activeTab="review"` | `/leads?filter=needs_review` | ✅ (Handled via /leads?filter=needs_review) |
| `activeTab="generator"` (scraper / discovery) | `/discovery` | ✅ (Scale segmentation, Google Places Grid & Scraper) |
| `activeTab="import"` (CSV/XLSX) | `/leads/import` | ✅ (Auto column matching, preview table & batch insert) |
| `activeTab="outreach"` (zatwierdzanie i wysyłka partii) | `/outbox` | ✅ (Batch approval, AI Act Art. 14, send execution) |
| `activeTab="history"` (Baza Wysłanych, KPI) | `/outbox/history` | ✅ (Real-time KPI metrics, IMAP replies, B2B meetings table) |
| KPI / statystyki | `/dashboard` | ✅ (RSC na `calculateDashboardMetrics`) |

## Wspólne elementy
- Słownik statusów: `src/lib/status-meta.ts` ✅
- Komponenty UI: `src/components/ui/` (`StatCard` ✅; przycisk, pole, tabela, badge, pusty stan, dialog, drawer, toast ⏳)

## Kryteria końcowe
`page.tsx` < 150 linii (lub `/` → redirect `/dashboard`), komponenty ≤ ~400 linii, brak globalnego `useState`, maks. 3 kliknięcia do 10 kluczowych akcji.
