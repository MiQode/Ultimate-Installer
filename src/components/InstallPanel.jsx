import { Download, Loader2, RotateCcw, X } from "lucide-react";
import { statusStyles } from "@/lib/bridge";

export default function InstallPanel({
  phase,
  selectedCount,
  progress,
  results,
  onInstall,
  onCancel,
  onReset,
}) {
  const running = phase === "running";

  return (
    <div className="border-t border-slate-800 bg-slate-900/80 px-6 py-4">
      {running && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span className="truncate pr-4">{progress.message || "Working..."}</span>
            <span>
              App {Math.min(progress.index + 1, progress.total)} of {progress.total}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-[width] duration-300"
              style={{ width: `${progress.percent || 0}%` }}
            />
          </div>
        </div>
      )}

      {phase === "done" && results.length > 0 && (
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
            ? "Installation in progress — you can keep selecting apps."
            : `${selectedCount} app${selectedCount === 1 ? "" : "s"} selected`}
        </p>

        <div className="flex items-center gap-3">
          {running ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 px-4 py-2 text-sm text-rose-300 transition-colors hover:bg-rose-500/10"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          ) : (
            <>
              {phase === "done" && (
                <button
                  type="button"
                  onClick={onReset}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800"
                >
                  <RotateCcw className="h-4 w-4" />
                  Clear
                </button>
              )}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}