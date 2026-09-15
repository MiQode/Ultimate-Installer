import { Search, RefreshCw, SlidersHorizontal } from "lucide-react";

export default function TopBar({
  query,
  onQueryChange,
  onRefresh,
  loading,
  total,
  installedCount,
}) {
  return (
    <header className="flex items-center gap-4 border-b border-slate-800 bg-slate-900/60 px-6 py-4">
      <div>
        <h1 className="text-base font-semibold text-slate-100">
          {total} applications available
        </h1>
        <p className="text-xs text-slate-500">{installedCount} already installed</p>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search applications..."
            className="w-64 rounded-lg border border-slate-700 bg-slate-950/60 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-sky-500"
          />
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Rescan
        </button>
      </div>
    </header>
  );
}