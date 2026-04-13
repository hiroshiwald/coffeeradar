import { Dispatch, SetStateAction, useState } from "react";
import { FeedSource, FeedSuggestion } from "@/lib/types";

interface UseOwnerActionsParams {
  setSources: (s: FeedSource[]) => void;
  setSuggestions: Dispatch<SetStateAction<FeedSuggestion[]>>;
}

export function useOwnerActions({ setSources, setSuggestions }: UseOwnerActionsParams) {
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  async function doAction(action: string, payload: Record<string, string>) {
    setBusy(true);
    setStatusMessage("");
    const res = await fetch("/api/admin/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json();
    if (data.sources) setSources(data.sources);
    if (!res.ok) setStatusMessage(data.error ?? "Action failed.");
    else if (data.discovery?.message) setStatusMessage(data.discovery.message);
    else setStatusMessage("Saved.");
    setBusy(false);
  }

  function dismissSuggestion(oldUrl: string) {
    setSuggestions((prev) => prev.filter((s) => s.sourceUrl !== oldUrl));
  }

  return { busy, statusMessage, setStatusMessage, doAction, dismissSuggestion };
}
