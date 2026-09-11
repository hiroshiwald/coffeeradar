import { redirect } from "next/navigation";
import { checkSiteAuth } from "@/lib/authGuard";
import { listEnabledMasterSources } from "@/lib/sourceStore";
import RoasterIndex from "@/components/RoasterIndex";

export const dynamic = "force-dynamic";

export default async function RoastersPage() {
  const { authorized } = await checkSiteAuth();
  if (!authorized) redirect("/login");

  // listEnabledMasterSources owns the Turso-vs-JSON decision and runs initDb
  // first, which the page's own loader used to skip.
  const sources = await listEnabledMasterSources();

  return <RoasterIndex sources={sources} />;
}
