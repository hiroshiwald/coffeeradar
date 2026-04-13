import { useState } from "react";

interface AddFeedFormProps {
  busy: boolean;
  doAction: (action: string, payload: Record<string, string>) => Promise<void>;
}

export function AddFeedForm({ busy, doAction }: AddFeedFormProps) {
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newWebsite, setNewWebsite] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newUrl) return;
    await doAction("add", { name: newName, url: newUrl, website: newWebsite || newUrl });
    setNewName("");
    setNewUrl("");
    setNewWebsite("");
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
      <p className="text-sm font-medium mb-3">Manual Add by Feed URL</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <input type="text" placeholder="Roaster name" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" required />
        <input type="url" placeholder="Feed URL (.atom or rss)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="flex-[2] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" required />
        <input type="url" placeholder="Website (optional)" value={newWebsite} onChange={(e) => setNewWebsite(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm disabled:opacity-50">Add</button>
      </div>
    </form>
  );
}
