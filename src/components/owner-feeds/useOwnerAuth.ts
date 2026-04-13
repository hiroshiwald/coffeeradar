import { useCallback, useEffect, useState } from "react";
import { SiteUserInfo } from "@/lib/types";

export function useOwnerAuth() {
  const [siteUsers, setSiteUsers] = useState<SiteUserInfo[]>([]);
  const [protectionEnabled, setProtectionEnabled] = useState(false);
  const [authStatusMessage, setAuthStatusMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const fetchSiteAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/site-auth");
      const data = await res.json();
      setSiteUsers(data.users ?? []);
      setProtectionEnabled(data.protectionEnabled ?? false);
    } catch (err) {
      console.error("Failed to fetch site auth:", err);
    }
  }, []);

  useEffect(() => {
    fetchSiteAuth();
  }, [fetchSiteAuth]);

  async function doAuthAction(action: string, payload: Record<string, unknown>) {
    setAuthBusy(true);
    setAuthStatusMessage("");
    const res = await fetch("/api/admin/site-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAuthStatusMessage(data.error ?? "Action failed.");
    } else {
      if (data.users) setSiteUsers(data.users);
      if (typeof data.protectionEnabled === "boolean") setProtectionEnabled(data.protectionEnabled);
      setAuthStatusMessage(data.message ?? "Saved.");
    }
    setAuthBusy(false);
  }

  return { siteUsers, protectionEnabled, authStatusMessage, authBusy, doAuthAction };
}
