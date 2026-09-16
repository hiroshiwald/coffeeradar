import { TipLinkTreatment } from "@/components/TipLink";

interface TipLinkControlProps {
  enabled: boolean;
  url: string;
  busy: boolean;
  onUrlChange: (url: string) => void;
  onToggle: () => void;
  onSave: () => void;
}

/** The real header treatment, faded when off and never clickable. */
function TipLinkPreview({ enabled }: { enabled: boolean }) {
  return (
    <div className="mt-3 px-3.5 py-3 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center gap-2.5">
      <span className="text-[11px] uppercase tracking-[0.06em] text-gray-400 font-mono">Preview</span>
      <div className={enabled ? "opacity-100" : "opacity-[0.35]"}>
        <TipLinkTreatment href={null} />
      </div>
      <span className="ml-auto text-[11px] text-gray-400">
        {enabled ? "Home header, top right" : "Nothing renders while off"}
      </span>
    </div>
  );
}

export function TipLinkControl({ enabled, url, busy, onUrlChange, onToggle, onSave }: TipLinkControlProps) {
  return (
    <div className="mb-6 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
      <div className="flex items-center gap-3 mb-3">
        <p className="text-sm font-medium">Tip Link</p>
        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5e5b]" />
        <div className="ml-auto flex items-center gap-2.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">{enabled ? "Showing on site" : "Hidden"}</span>
          <button onClick={onToggle} disabled={busy} aria-label="Toggle tip link" className={`w-8 h-5 rounded-full transition-colors flex-shrink-0 ${enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-3.5" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 max-w-[780px]">
        When on, the home header reads “Found something good? Leave a tip on Ko-Fi.” Off hides it on every page,
        including the footer line. The URL still has to pass{" "}
        <code className="text-[11px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">getTipUrl()</code> — https
        only, otherwise nothing renders.
      </p>
      <div className="flex gap-3 items-center">
        <input type="url" placeholder="https://ko-fi.com/yourhandle" value={url} onChange={(e) => onUrlChange(e.target.value)} disabled={busy} className="flex-[2] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm" />
        <button onClick={onSave} disabled={busy} className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm disabled:opacity-50">Save</button>
      </div>
      <TipLinkPreview enabled={enabled} />
    </div>
  );
}
