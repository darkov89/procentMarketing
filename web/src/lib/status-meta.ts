/**
 * Jeden słownik statusów leada (Faza 8): etykieta + klasy kolorów.
 * Używany przez wszystkie widoki — nie definiuj etykiet statusów lokalnie.
 */
export interface StatusMeta {
  label: string;
  className: string;
}

export const STATUS_META: Record<string, StatusMeta> = {
  new: { label: "Nowy", className: "bg-slate-100 text-slate-700" },
  researched: { label: "Zweryfikowany", className: "bg-sky-100 text-sky-800" },
  qualified: { label: "Zakwalifikowany", className: "bg-indigo-100 text-indigo-800" },
  approved: { label: "Zatwierdzony", className: "bg-violet-100 text-violet-800" },
  offer_ready: { label: "Oferta gotowa", className: "bg-fuchsia-100 text-fuchsia-800" },
  in_sequence: { label: "W sekwencji", className: "bg-amber-100 text-amber-800" },
  replied: { label: "Odpowiedź", className: "bg-emerald-100 text-emerald-800" },
  in_talks: { label: "Rozmowa", className: "bg-teal-100 text-teal-800" },
  pledged: { label: "Deklaracja", className: "bg-lime-100 text-lime-800" },
  paid: { label: "Wpłata potwierdzona", className: "bg-green-100 text-green-800" },
  won: { label: "Wygrany", className: "bg-green-100 text-green-800" },
  lost: { label: "Utracony", className: "bg-zinc-200 text-zinc-700" },
  rejected: { label: "Odrzucony", className: "bg-zinc-200 text-zinc-700" },
  blocked: { label: "Zablokowany", className: "bg-red-100 text-red-800" },
  unsubscribed: { label: "Wypisany", className: "bg-red-100 text-red-800" },
  bounced: { label: "Bounce", className: "bg-red-100 text-red-800" },
  audit_failed: { label: "Audyt nieudany", className: "bg-orange-100 text-orange-800" },
};

export function getStatusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? { label: status, className: "bg-slate-100 text-slate-700" };
}
