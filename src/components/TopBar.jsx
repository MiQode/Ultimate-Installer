import { Search, RefreshCw, HardDrive, Shield, ShieldAlert } from "lucide-react";

export default function TopBar({
  query,
  onQueryChange,
  onRefresh,
  loading,
  total,
  installedCount,
  offline,
  elevated,
}) {
  return (
    <header className="flex items-center gap-4 border-b border-slate-800 bg-slate-900/60 px-6 py-4">
      <div>
        <h1 className="text-base font-semibold text-slate-100">
          {total} applications available
        </h1>
        <p className="text-xs text-slate-500">{installedCount} already installed</p>
      </div>

      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
          elevated
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-amber-500/15 text-amber-300"
        }`}
        title={
          elevated
            ? "Running as administrator — installers will not prompt UAC"
            : "Not elevated — some installers may prompt for admin rights"
        }
      >
        {elevated ? <Shield className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
        {elevated ? "Admin" : "Standard"}
      </span>

      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${
          offline?.count > 0
            ? "bg-indigo-500/15 text-indigo-300"
            : "bg-slate-800 text-slate-500"
        }`}
        title={offline?.directory || "Offline installer repository"}
      >
        <HardDrive className="h-3.5 w-3.5" />
        {offline?.count > 0
          ? `Offline repo: ${offline.count} file${offline.count === 1 ? "" : "s"}`
          : "Offline repo empty"}
      </span>

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