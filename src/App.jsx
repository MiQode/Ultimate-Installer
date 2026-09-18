import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import AppCard from "@/components/AppCard";
import InstallPanel from "@/components/InstallPanel";
import { bridge } from "@/lib/bridge";
import { version } from "../package.json";

const ALL = "All Apps";

const EMPTY_PROGRESS = { index: 0, total: 0, percent: 0, message: "" };

export default function App() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [selected, setSelected] = useState(new Set());
  const [statuses, setStatuses] = useState({});
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(EMPTY_PROGRESS);
  const [results, setResults] = useState([]);
  const [offline, setOffline] = useState({ count: 0, directory: "" });
  const [elevated, setElevated] = useState(false);

  const loadApps = useCallback(async () => {
    let list = [];
    let offlineStatus = { count: 0, directory: "" };
    let elev = false;
    try {
      const [l, o, e] = await Promise.allSettled([
        bridge.getSoftwareList(),
        bridge.getOfflineStatus(),
        bridge.isElevated(),
      ]);
      list = l.status === "fulfilled" ? l.value : [];
      offlineStatus = o.status === "fulfilled" ? o.value : { count: 0, directory: "" };
      elev = e.status === "fulfilled" ? e.value : false;
    } finally {
      const appList = Array.isArray(list) ? list : [];
      setApps(appList);
      setOffline(offlineStatus ?? { count: 0, directory: "" });
      setElevated(Boolean(elev));
      setLoading(false);
    }
  }, []);

  const isFirstLoad = useRef(true);

  useEffect(() => {
    const timer = setTimeout(loadApps, 0);
    return () => clearTimeout(timer);
  }, [loadApps]);

  useEffect(() => {
    if (isFirstLoad.current && apps.length > 0) {
      isFirstLoad.current = false;
      setSelected(new Set(apps.filter((a) => a.default && !a.installed).map((a) => a.id)));
    }
  }, [apps]);

  useEffect(() => {
    const offProgress = bridge.onProgress((payload) => {
      setProgress(payload);
      setStatuses((prev) => ({
        ...prev,
        [payload.id]: payload.phase === "done" ? prev[payload.id] : payload.phase,
      }));
    });

    const offDone = bridge.onItemDone((item) => {
      setResults((prev) => [...prev, item]);
      setStatuses((prev) => ({ ...prev, [item.id]: item.status }));
    });

    const offComplete = bridge.onComplete((list) => {
      setPhase("done");
      setResults(list);
      setProgress(EMPTY_PROGRESS);
      setSelected(new Set());
      setStatuses((prev) => {
        const next = { ...prev };
        for (const item of list) {
          next[item.id] = item.status;
        }
        return next;
      });
    });

    return () => {
      offProgress();
      offDone();
      offComplete();
    };
  }, []);

  const categories = useMemo(() => {
    const counts = new Map();
    for (const app of apps) {
      counts.set(app.category, (counts.get(app.category) ?? 0) + 1);
    }
    return [
      { name: ALL, count: apps.length },
      ...Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    ];
  }, [apps]);

  const visibleApps = useMemo(() => {
    const term = query.trim().toLowerCase();
    return apps.filter((app) => {
      const inCategory = activeCategory === ALL || app.category === activeCategory;
      if (!inCategory) return false;
      if (!term) return true;
      return `${app.name} ${app.publisher} ${app.description}`.toLowerCase().includes(term);
    });
  }, [apps, activeCategory, query]);

  const toggleApp = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(apps.filter((a) => !a.installed).map((a) => a.id)));
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const startInstall = async () => {
    const list = apps.filter((app) => selected.has(app.id));
    if (list.length === 0) return;

    setResults([]);
    setProgress({ ...EMPTY_PROGRESS, total: list.length });
    setPhase("running");

    await bridge.install(list);
  };

  const cancel = () => {
    bridge.cancel();
  };

  const reset = () => {
    setPhase("idle");
    setResults([]);
    setStatuses({});
    setSelected(new Set());
  };

  const finish = () => {
    bridge.close();
  };

  const installedCount = apps.filter((app) => app.installed).length;
  const running = phase === "running";

  return (
    <div className="flex h-full">
      <Sidebar
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        selectedCount={selected.size}
        version={version}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          query={query}
          onQueryChange={setQuery}
          onRefresh={loadApps}
          onSelectAll={selectAll}
          onClear={clearSelection}
          hasSelection={selected.size > 0}
          allSelected={selected.size === apps.filter((a) => !a.installed).length}
          loading={loading}
          total={apps.length}
          installedCount={installedCount}
          offline={offline}
          elevated={elevated}
        />

        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-sm text-slate-500">Scanning catalogue...</p>
          ) : visibleApps.length === 0 ? (
            <p className="text-sm text-slate-500">No applications match this view.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleApps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  selected={selected.has(app.id)}
                  status={statuses[app.id]}
                  onToggle={toggleApp}
                  disabled={running && statuses[app.id] !== undefined}
                />
              ))}
            </div>
          )}
        </main>

        <InstallPanel
          phase={phase}
          selectedCount={selected.size}
          progress={progress}
          results={results}
          onInstall={startInstall}
          onCancel={cancel}
          onReset={reset}
          onFinish={finish}
        />
      </div>
    </div>
  );
}