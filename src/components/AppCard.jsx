import { Check, Clock, Loader2, AlertTriangle } from "lucide-react";

const badgeFor = (status) => {
  switch (status) {
    case "installed":
      return {
        label: "Installed",
        className: "bg-emerald-500/15 text-emerald-400",
        icon: Check,
      };
    case "already-installed":
      return {
        label: "Already installed",
        className: "bg-emerald-500/15 text-emerald-400",
        icon: Check,
      };
    case "failed":
      return {
        label: "Failed",
        className: "bg-rose-500/15 text-rose-400",
        icon: AlertTriangle,
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-slate-600/30 text-slate-400",
        icon: Clock,
      };
    case "downloading":
      return {
        label: "Downloading",
        className: "bg-sky-500/15 text-sky-300",
        icon: Loader2,
      };
    case "installing":
      return {
        label: "Installing",
        className: "bg-amber-500/15 text-amber-300",
        icon: Loader2,
      };
    case "queued":
      return {
        label: "Queued",
        className: "bg-slate-600/30 text-slate-300",
        icon: Clock,
      };
    default:
      return null;
  }
};

export default function AppCard({ app, selected, status, onToggle, disabled }) {
  const badge = badgeFor(status);
  const BadgeIcon = badge?.icon;
  const busy = status === "downloading" || status === "installing";

  return (
    <button
      type="button"
      onClick={() => onToggle(app.id)}
      disabled={disabled}
      className={`group relative flex h-full flex-col rounded-xl border p-4 text-left transition-all ${
        selected
          ? "border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/40"
          : "border-slate-800 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-800/60"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">{app.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100">{app.name}</p>
          <p className="truncate text-xs text-slate-500">{app.publisher}</p>
        </div>

        <span
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
            selected ? "border-sky-400 bg-sky-500 text-white" : "border-slate-600"
          }`}
        >
          {selected && <Check className="h-3.5 w-3.5" />}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-xs text-slate-400">{app.description}</p>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-slate-500">{app.size}</span>
        {badge ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${badge.className}`}
          >
            <BadgeIcon className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
            {badge.label}
          </span>
        ) : (
          app.installed && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
              Detected
            </span>
          )
        )}
      </div>
    </button>
  );
}