import AppLogo from "@/components/AppLogo";

export default function Sidebar({
  categories,
  activeCategory,
  onCategoryChange,
  selectedCount,
  version,
}) {
  return (
    <aside className="w-60 shrink-0 border-r border-slate-800 bg-slate-900/60 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">

          <AppLogo className="h-10 w-10 rounded-xl" />
          <div>
            <p className="text-sm font-semibold text-slate-100 leading-tight">
              Ultimate Installer
            </p>
            <p className="text-xs text-slate-500">v{version}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {categories.map(({ name, count }) => {
          const active = name === activeCategory;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onCategoryChange(name)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${active
                  ? "bg-sky-500/15 text-sky-300"
                  : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
                }`}
            >
              <span>{name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${active
                    ? "bg-sky-500/20 text-sky-200"
                    : "bg-slate-800 text-slate-500"
                  }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-5 py-4 text-xs text-slate-500">
        {selectedCount} selected
      </div>
    </aside>
  );
}
