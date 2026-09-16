import { redirect } from "next/navigation";
import { checkSiteAuth } from "@/lib/authGuard";
import { resolveTipUrl } from "@/lib/tipLink";
import { readTipLinkSettings } from "@/lib/tipLinkStore";
import CoffeeTable from "@/components/CoffeeTable";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { authorized } = await checkSiteAuth();
  if (!authorized) redirect("/login");

  // Resolved here, on the server, so the header link and the footer line read
  // one decision and the owner toggle applies without a redeploy.
  const tipUrl = resolveTipUrl(await readTipLinkSettings());

  return (
    <main>
      <CoffeeTable tipUrl={tipUrl} />
    </main>
  );
}
