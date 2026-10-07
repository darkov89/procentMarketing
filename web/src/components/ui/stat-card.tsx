import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}

export function StatCard({ label, value, hint, href }: StatCardProps) {
  const body = (
    <div className="rounded-xl border border-[#28354D] bg-[#141C2E] p-4 shadow-sm transition-all hover:border-[#FFE600]/80 hover:bg-[#19233A] group">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] group-hover:text-[#CBD5E1] transition-colors">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black text-white group-hover:text-[#FFE600] transition-colors">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-[#64748B] group-hover:text-[#94A3B8] transition-colors">
          {hint}
        </div>
      ) : null}
    </div>
  );
  return href ? (
    <Link
      href={href}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE600] rounded-xl transition-transform hover:-translate-y-0.5"
    >
      {body}
    </Link>
  ) : (
    body
  );
}
