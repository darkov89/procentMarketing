import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const { leadId } = await searchParams;

  if (leadId) {
    redirect(`/leads/${leadId}`);
  }

  redirect("/dashboard");
}
