const noop = () => () => {};

const fallback = {
  getSoftwareList: async () => [],
  getOfflineStatus: async () => ({ directory: "", exists: false, count: 0, files: [] }),
  install: async () => [],
  cancel: async () => true,
  hasWinget: async () => false,
  isElevated: async () => false,
  onProgress: noop,
  onItemDone: noop,
  onComplete: noop,
};

export const bridge = globalThis.installer ?? fallback;

export const isDesktop = Boolean(globalThis.installer);

export const sourceLabels = {
  offline: { label: "Offline", className: "bg-indigo-500/15 text-indigo-300" },
  download: { label: "Download", className: "bg-sky-500/15 text-sky-300" },
  winget: { label: "winget", className: "bg-amber-500/15 text-amber-300" },
  unavailable: { label: "Unavailable", className: "bg-rose-500/15 text-rose-300" },
};

export const statusStyles = {
  queued: "text-slate-300",
  downloading: "text-sky-300",
  installing: "text-amber-300",
  installed: "text-emerald-400",
  "already-installed": "text-emerald-400",
  failed: "text-rose-400",
  cancelled: "text-slate-400",
};