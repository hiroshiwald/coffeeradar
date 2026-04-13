import { Dispatch, SetStateAction, useState } from "react";
import { FeedSuggestion } from "@/lib/types";

interface UseOwnerCronParams {
  setSuggestions: Dispatch<SetStateAction<FeedSuggestion[]>>;
  fetchSources: () => Promise<void>;
  setStatusMessage: (msg: string) => void;
}

export function useOwnerCron({ setSuggestions, fetchSources, setStatusMessage }: UseOwnerCronParams) {
  const [rescanning, setRescanning] = useState(false);
  const [cronRunning, setCronRunning] = useState(false);

  async function handleRescanFailed() {
    setRescanning(true);
    setStatusMessage("Triaging failed feeds...");
    const res = await fetch("/api/admin/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rescan_failed" }),
    });
    const data = await res.json();
    if (data.suggestions) setSuggestions(data.suggestions);
    if (res.ok) {
      const results: Array<{ status: string }> = data.results ?? [];
      const adds = results.filter((r) => r.status === "recommend_add").length;
      const dels = results.filter((r) => r.status === "recommend_deletion").length;
      const manual = results.filter((r) => r.status === "manual_review").length;
      setStatusMessage(
        `Triaged ${data.scanned ?? 0} failed feeds: ${adds} recommend add, ${dels} recommend deletion, ${manual} manual review.`,
      );
    } else {
      setStatusMessage(data.error ?? "Rescan failed.");
    }
    setRescanning(false);
  }

  async function handleRunCron() {
    setCronRunning(true);
    setStatusMessage("Running cron job...");
    const res = await fetch("/api/cron");
    const data = await res.json();
    if (res.ok) {
      setStatusMessage(`Cron done: ${data.inserted} coffees inserted, ${data.healthy}/${data.total} feeds healthy.`);
      // Intentional detach: refresh sources in background so cron button re-enables immediately
      fetchSources().catch(err => console.error("Post-cron source refresh failed:", err));
    } else {
      setStatusMessage(data.error ?? "Cron failed.");
    }
    setCronRunning(false);
  }

  return { rescanning, cronRunning, handleRescanFailed, handleRunCron };
}
