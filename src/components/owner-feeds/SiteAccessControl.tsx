import { useState } from "react";
import { SiteUserInfo } from "@/lib/types";

interface SiteAccessControlProps {
  siteUsers: SiteUserInfo[];
  protectionEnabled: boolean;
  authStatusMessage: string;
  busy: boolean;
  onAuthAction: (action: string, payload: Record<string, unknown>) => Promise<void>;
}

export function SiteAccessControl({
  siteUsers, protectionEnabled, authStatusMessage, busy, onAuthAction,
}: SiteAccessControlProps) {
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername || !newPassword) return;
    await onAuthAction("add_user", { username: newUsername, password: newPassword });
    setNewUsername("");
    setNewPassword("");
  }

  return (
    <div className="mb-8 p-4 rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Site Access Control</h2>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${protectionEnabled ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
          {protectionEnabled ? "ON" : "OFF"}
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        {protectionEnabled ? "Site is password-protected. Visitors must log in." : "Site is public. Anyone can access it."}
        {" "}Automatically enabled when <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">OWNER_PASSWORD</code> is set.
      </p>
      {protectionEnabled && siteUsers.length === 0 && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-3 font-medium">
          Warning: Protection is enabled but no users exist. Nobody will be able to access the site.
        </p>
      )}
      {authStatusMessage && <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">{authStatusMessage}</p>}
      <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row gap-3 mb-4">
        <input type="text" placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} autoComplete="off" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" required disabled={busy} />
        <input type="password" placeholder="Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" required disabled={busy} />
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm disabled:opacity-50">Add User</button>
      </form>
      {siteUsers.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800/50">
          {siteUsers.map((user) => (
            <div key={user.username} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <span className="text-sm font-medium">{user.username}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">added {new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
              <button onClick={() => onAuthAction("remove_user", { username: user.username })} disabled={busy} className="text-xs text-red-400 hover:text-red-600 transition">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
