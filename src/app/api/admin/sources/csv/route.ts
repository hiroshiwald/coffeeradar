import { NextResponse } from "next/server";
import { listMasterSources } from "@/lib/sourceStore";

export const dynamic = "force-dynamic";

function csvEscape(value: string): string {
  const str = value ?? "";
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export async function GET() {
  const sources = await listMasterSources();
  const header = ["name", "url", "website", "enabled"];
  const lines = [
    header.join(","),
    ...sources.map((s) => [s.name, s.url, s.website, s.enabled === false ? "false" : "true"].map(csvEscape).join(",")),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="feed-sources.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
