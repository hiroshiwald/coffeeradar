import { useState } from "react";

interface QuickAddFormProps {
  busy: boolean;
  doAction: (action: string, payload: Record<string, string>) => Promise<void>;
}

export function QuickAddForm({ busy, doAction }: QuickAddFormProps) {
  const [storeName, setStoreName] = useState("");
  const [storeUrl, setStoreUrl] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!storeName || !storeUrl) return;
    await doAction("add_from_store", { name: storeName, storeUrl });
    setStoreName("");
    setStoreUrl("");
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
      <p className="text-sm font-medium mb-3">Quick Add by Roaster Store URL</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <input type="text" placeholder="Roaster name" value={storeName} onChange={(e) => setStoreName(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" required />
        <input type="url" placeholder="Store URL" value={storeUrl} onChange={(e) => setStoreUrl(e.target.value)} className="flex-[2] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" required />
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm disabled:opacity-50">Discover + Add</button>
      </div>
    </form>
  );
}
