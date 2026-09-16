import { useCallback, useEffect, useState } from "react";
import { TipLinkSettings } from "@/lib/tipLink";

interface UseOwnerTipLinkParams {
  setStatusMessage: (message: string) => void;
}

interface SaveResult {
  ok: boolean;
  message: string;
}

/** One POST to the admin route. Kept out of the hook so the hook stays about state. */
async function postTipLink(settings: TipLinkSettings): Promise<SaveResult> {
  try {
    const res = await fetch("/api/admin/tip-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, message: data.error ?? "Tip link save failed." };
    return { ok: true, message: data.message ?? "Saved." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Tip link save failed." };
  }
}

export function useOwnerTipLink({ setStatusMessage }: UseOwnerTipLinkParams) {
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchTipLink = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tip-link");
      if (!res.ok) throw new Error(`/api/admin/tip-link responded ${res.status}`);
      const data = await res.json();
      setEnabled(data.enabled === true);
      setUrl(typeof data.url === "string" ? data.url : "");
    } catch (err) {
      // Say so rather than leave the card showing an empty URL as if it were stored.
      console.error("Failed to fetch tip link settings:", err);
      setStatusMessage("Could not load the tip link settings.");
    }
  }, [setStatusMessage]);

  useEffect(() => {
    // Not awaited on purpose: fetchTipLink handles its own failure and never rejects.
    fetchTipLink();
  }, [fetchTipLink]);

  async function save(next: TipLinkSettings): Promise<boolean> {
    setBusy(true);
    setStatusMessage("");
    const result = await postTipLink(next);
    setStatusMessage(result.message);
    setBusy(false);
    return result.ok;
  }

  // Optimistic: the switch moves now and goes back if the POST rejects it.
  async function toggle(): Promise<void> {
    const next = !enabled;
    setEnabled(next);
    const ok = await save({ enabled: next, url });
    if (!ok) setEnabled(!next);
  }

  async function saveUrl(): Promise<void> {
    await save({ enabled, url });
  }

  return { enabled, url, busy, setUrl, toggle, saveUrl };
}
