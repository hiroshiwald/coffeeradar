import { redirect } from "next/navigation";
import { checkSiteAuth } from "@/lib/authGuard";
import CoffeeTable from "@/components/CoffeeTable";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { authorized } = await checkSiteAuth();
  if (!authorized) redirect("/login");

  return (
    <main>
      <CoffeeTable />
    </main>
  );
}
