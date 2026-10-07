import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; status?: string; filter?: string }>;
}) {
  const params = await searchParams;

  if (params.leadId) {
    redirect(`/leads/${params.leadId}`);
  }

  if (params.status || params.filter) {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.filter) q.set("filter", params.filter);
    redirect(`/leads?${q.toString()}`);
  }

  redirect("/dashboard");
}
