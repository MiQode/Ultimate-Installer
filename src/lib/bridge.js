const noop = () => () => {};

const fallback = {
  getSoftwareList: async () => [],
  install: async () => [],
  cancel: async () => true,
  hasWinget: async () => false,
  onProgress: noop,
  onItemDone: noop,
  onComplete: noop,
};

export const bridge = globalThis.installer ?? fallback;

export const isDesktop = Boolean(globalThis.installer);

export const statusStyles = {
  queued: "text-slate-300",
  downloading: "text-sky-300",
  installing: "text-amber-300",
  installed: "text-emerald-400",
  "already-installed": "text-emerald-400",
  failed: "text-rose-400",
  cancelled: "text-slate-400",
};