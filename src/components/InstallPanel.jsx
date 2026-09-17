import { Download, Loader2, RotateCcw, X, CheckCircle2 } from "lucide-react";
import { statusStyles } from "@/lib/bridge";

export default function InstallPanel({
  phase,
  selectedCount,
  progress,
  results,
  onInstall,
  onCancel,
  onReset,
  onFinish,
}) {
  const running = phase === "running";
  const done = phase === "done";

  // Overall progress: each completed app counts as 100%, current app uses its percent
  const completedCount = results.filter(
    (r) => r.status === "installed" || r.status === "already-installed",
  ).length;
  const overallPercent =
    progress.total > 0
      ? Math.round(((completedCount + (progress.percent || 0) / 100) / progress.total) * 100)
      : 0;

  return (
    <div className="border-t border-slate-800 bg-slate-900/80 px-6 py-4">
      {running && (
        <div className="mb-4 space-y-3">
          {/* Overall progress */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
              <span>
                {completedCount} of {progress.total} complete
              </span>
              <span className="font-medium text-slate-200">{overallPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-[width] duration-300"
                style={{ width: `${overallPercent}%` }}
              />
            </div>
          </div>

          {/* Per-app progress */}
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
              <span className="truncate pr-4">{progress.message || "Working..."}</span>
              <span className="shrink-0">{progress.percent || 0}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800/60">
              <div
                className="h-full rounded-full bg-slate-500 transition-[width] duration-300"
                style={{ width: `${progress.percent || 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {done && results.length > 0 && (
        <div className="mb-4 max-h-28 space-y-1 overflow-y-auto text-xs">
          {results.map((result) => (
            <div key={result.id} className="flex items-center justify-between gap-3">
              <span className="truncate text-slate-300">{result.name}</span>
              <span className={statusStyles[result.status] ?? "text-slate-400"}>
                {result.status}
                {result.error ? `: ${result.error}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">
          {running
            ? `Installing ${progress.name || "app"}...`
            : done
              ? `${results.length} app${results.length === 1 ? "" : ""} processed`
              : `${selectedCount} app${selectedCount === 1 ? "" : "s"} selected`}
        </p>

        <div className="flex items-center gap-3">
          {running && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 px-4 py-2 text-sm text-rose-300 transition-colors hover:bg-rose-500/10"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          )}

          {done && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" />
              Install more
            </button>
          )}

          {done && (
            <button
              type="button"
              onClick={onFinish}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <CheckCircle2 className="h-4 w-4" />
              Finish
            </button>
          )}

          {!running && !done && (
            <button
              type="button"
              onClick={onInstall}
              disabled={selectedCount === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400"
            >
              {selectedCount === 0 ? (
                <Download className="h-4 w-4" />
              ) : (
                <Loader2 className="h-4 w-4" />
              )}
              Install {selectedCount > 0 ? `(${selectedCount})` : "Selected"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
