import { flushSync } from "react-dom";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Info,
  Layers3,
  RotateCcw,
  Undo2,
  Redo2,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { registerAtlasTools } from "./agent-tools";
import {
  DEFAULT_VISIBLE,
  SYSTEMS,
  type Atlas,
  type Concept,
  type SceneState,
  type SystemId,
  type View,
} from "./anatomy";
import { AboutSheet } from "./panels/about-sheet";
import { DetailSheet } from "./panels/detail-sheet";
import { LayersPanel } from "./panels/layers-panel";
import { SearchPanel } from "./panels/search-panel";
import { SceneBoundary } from "./scene-boundary";

const initial: SceneState = {
  explode: 0,
  visible: DEFAULT_VISIBLE,
  selected: [],
  isolate: false,
  view: "three-quarter",
  rotate: false,
  reset: 0,
  hidden: [],
};
const views: { id: View; label: string; description: string }[] = [
  { id: "three-quarter", label: "斜前", description: "从斜前方查看人体" },
  { id: "front", label: "正面", description: "从正面查看人体" },
  { id: "side", label: "侧面", description: "从侧面查看人体" },
  { id: "back", label: "背面", description: "从背面查看人体" },
];
const noticeKey = "anatomy-learning-notice-dismissed";

export default function Home() {
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [state, setState] = useState(initial);
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"layers" | "search" | null>(null);
  const [details, setDetails] = useState(false);
  const [about, setAbout] = useState(false);
  const [query, setQuery] = useState("");
  const [hideHistory, setHideHistory] = useState<{ past: string[][]; future: string[][] }>({
    past: [],
    future: [],
  });
  const [chosen, setChosen] = useState<Concept | null>(null);
  const [notice, setNotice] = useState(() => {
    try {
      return localStorage.getItem(noticeKey) !== "1";
    } catch {
      return true;
    }
  });
  const searchButton = useRef<HTMLButtonElement>(null),
    layersButton = useRef<HTMLButtonElement>(null);
  // A new lazy component lets a failed module import be attempted again, too.
  const AnatomyScene = useMemo(() => lazy(() => import("./scene")), [attempt]);

  useEffect(() => {
    if (atlas) return;
    const abort = new AbortController();
    fetch(`${import.meta.env.BASE_URL}models/atlas.json`, { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error("无法加载解剖结构目录。请检查网络连接后重试。");
        return r.json();
      })
      .then((data) => {
        if (!abort.signal.aborted) setAtlas(data as Atlas);
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : "无法加载解剖结构目录。");
      });
    return () => abort.abort();
  }, [attempt, atlas]);

  const closePanel = useCallback(() => {
    setPanel(null);
    (panel === "layers" ? layersButton : searchButton).current?.focus();
  }, [panel]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        if (about) {
          setAbout(false);
          return;
        }
        if (panel) {
          e.preventDefault();
          closePanel();
          return;
        }
        if (details) setDetails(false);
      }
      const target = e.target;
      const editing =
        target instanceof HTMLElement &&
        (target.isContentEditable || !!target.closest('input,textarea,select,[role="textbox"]'));
      if (e.key === "/" && !editing && !about) {
        e.preventDefault();
        setPanel("search");
        setDetails(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [panel, details, about, closePanel]);

  const parts = useMemo(() => new Map(atlas?.parts.map((p) => [p.id, p])), [atlas]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        SYSTEMS.map((s) => [s.id, atlas?.parts.filter((p) => p.system === s.id).length ?? 0]),
      ),
    [atlas],
  );
  const selectedParts = state.selected.map((id) => parts.get(id)).filter((p) => !!p);
  const visibleCount =
    atlas?.parts.filter(
      (p) =>
        !state.hidden.includes(p.id) &&
        (state.isolate
          ? state.selected.includes(p.id)
          : state.visible.includes(p.system) || state.selected.includes(p.id)),
    ).length ?? 0;
  const choose = useCallback((c: Concept) => {
    setChosen(c);
    setState((s) => ({ ...s, selected: c.elements, isolate: false, rotate: false }));
    setDetails(true);
    setPanel(null);
  }, []);
  useEffect(() => {
    if (!atlas) return;
    return registerAtlasTools(atlas, (c) => flushSync(() => choose(c)));
  }, [atlas, choose]);
  const choosePart = (id: string) => {
    const p = parts.get(id);
    if (p) choose({ id: p.conceptId, name: p.name, elements: [id] });
  };
  const changeVisible = (visible: SystemId[]) => {
    setDetails(false);
    setChosen(null);
    setState((s) => ({ ...s, visible, selected: [], isolate: false }));
  };
  const hideSelected = () => {
    setHideHistory((h) => ({ past: [...h.past, state.hidden], future: [] }));
    setState((s) => ({
      ...s,
      hidden: [...new Set([...s.hidden, ...s.selected])],
      selected: [],
      isolate: false,
    }));
    setChosen(null);
    setDetails(false);
  };
  const undoHide = () => {
    const previous = hideHistory.past.at(-1);
    if (!previous) return;
    setHideHistory((h) => ({ past: h.past.slice(0, -1), future: [state.hidden, ...h.future] }));
    setState((s) => ({ ...s, hidden: previous, selected: [], isolate: false }));
    setChosen(null);
    setDetails(false);
  };
  const redoHide = () => {
    const next = hideHistory.future[0];
    if (!next) return;
    setHideHistory((h) => ({ past: [...h.past, state.hidden], future: h.future.slice(1) }));
    setState((s) => ({ ...s, hidden: next, selected: [], isolate: false }));
    setChosen(null);
    setDetails(false);
  };
  const reset = () => {
    setHideHistory({ past: [], future: [] });
    setState((s) => ({ ...initial, reset: s.reset + 1 }));
    setChosen(null);
    setDetails(false);
    setPanel(null);
  };
  const openPanel = (next: "layers" | "search") => {
    setDetails(false);
    setPanel((p) => (p === next ? null : next));
  };
  const openAbout = () => {
    setDetails(false);
    setPanel(null);
    setAbout(true);
  };
  const retry = () => {
    setProgress(0);
    setError("");
    setAttempt((n) => n + 1);
  };
  const dismissNotice = () => {
    setNotice(false);
    try {
      localStorage.setItem(noticeKey, "1");
    } catch {
      /* Keep dismissal for this visit when storage is unavailable. */
    }
  };

  return (
    <main className="studio" aria-busy={progress < 100 && !error}>
      {atlas && !error && (
        <SceneBoundary key={attempt} onError={setError}>
          <Suspense fallback={null}>
            <AnatomyScene
              atlas={atlas}
              state={{ ...state, inspectorOpen: details && selectedParts.length > 0 }}
              onSelect={choosePart}
              onProgress={setProgress}
              onError={setError}
            />
          </Suspense>
        </SceneBoundary>
      )}
      <div className="vignette" />
      <header className="identity">
        <div className="eyebrow">
          <span className="status-dot" />
          交互式人体解剖
        </div>
        <h1>
          人体图谱
          <Badge variant="outline" className="edition">
            三维
          </Badge>
        </h1>
        <div className="identity-meta">
          {atlas ? `${atlas.parts.length.toLocaleString()} 个三维结构` : "正在读取结构目录"}
        </div>
      </header>
      <nav className="top-actions" aria-label="探索面板">
        <Button
          ref={layersButton}
          variant="ghost"
          className="mobile-only icon-button"
          onClick={() => openPanel("layers")}
          aria-label="打开系统图层"
          aria-expanded={panel === "layers"}
        >
          <Layers3 size={18} />
        </Button>
        <Button
          ref={searchButton}
          variant="ghost"
          className={panel === "search" ? "active" : ""}
          onClick={() => openPanel("search")}
          aria-label="搜索解剖结构"
          aria-expanded={panel === "search"}
        >
          <Search size={18} />
          <span>查找结构</span>
          <kbd>/</kbd>
        </Button>
        <Button variant="ghost" className="icon-button" aria-label="个人信息" onClick={openAbout}>
          <Info size={18} />
        </Button>
      </nav>
      {notice && progress === 100 && !panel && !details && !about && (
        <aside className="learning-notice">
          <span>仅供学习参考，不用于诊断或手术。</span>
          <Button variant="ghost" size="icon-sm" onClick={dismissNotice} aria-label="关闭学习提示">
            <X size={14} />
          </Button>
        </aside>
      )}
      <LayersPanel
        open={panel === "layers"}
        visible={state.visible}
        counts={counts}
        visibleCount={visibleCount}
        onVisible={changeVisible}
        onClose={closePanel}
      />
      {panel === "search" && (
        <SearchPanel
          atlas={atlas}
          query={query}
          onQuery={setQuery}
          onChoose={choose}
          onClose={closePanel}
        />
      )}
      <TooltipProvider delay={300}>
        <nav className="view-controls glass" aria-label="模型工具栏">
          {views.map((v) => (
            <Tooltip key={v.id}>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    className={state.view === v.id ? "active" : ""}
                    aria-pressed={state.view === v.id}
                    onClick={() =>
                      setState((s) => ({ ...s, view: v.id, reset: s.reset + 1, rotate: false }))
                    }
                    aria-label={v.description}
                  />
                }
              >
                <span>{v.label}</span>
              </TooltipTrigger>
              <TooltipContent>{v.description}</TooltipContent>
            </Tooltip>
          ))}
          <i />
          <Button
            variant="ghost"
            aria-label="撤销隐藏"
            title="撤销隐藏"
            disabled={!hideHistory.past.length}
            onClick={undoHide}
          >
            <Undo2 size={18} />
          </Button>
          <Button
            variant="ghost"
            aria-label="重做隐藏"
            title="重做隐藏"
            disabled={!hideHistory.future.length}
            onClick={redoHide}
          >
            <Redo2 size={18} />
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  className="toolbar-reset"
                  onClick={reset}
                  aria-label="重置模型"
                />
              }
            >
              <RotateCcw size={16} />
              <span>重置</span>
            </TooltipTrigger>
            <TooltipContent>重置视角、图层并恢复所有已隐藏结构</TooltipContent>
          </Tooltip>
        </nav>
      </TooltipProvider>
      <div className="scene-caption">
        <span className="caption-line" />
        <span>
          {state.isolate ? (chosen?.name ?? "选定结构") : "成年男性 · 人体"}
        </span>
        <span className="caption-line" />
      </div>
      <footer className="studio-footer">
        <span>
          左键或中键平移 <b>·</b> 右键旋转 <b>·</b> 滚轮 / 双指缩放 <b>·</b> 点击结构查看详情
        </span>
        <Button variant="ghost" onClick={openAbout}>
          来源与致谢 <ArrowUpRight size={12} />
        </Button>
      </footer>
      {progress < 100 && !error && (
        <div className="loading glass" role="status">
          <Activity size={18} />
          <div>
            <strong>正在准备解剖模型</strong>
            <span>
              {atlas
                ? `${progress}% · 正在加载 ${atlas.parts.length.toLocaleString()} 个结构`
                : "正在读取解剖结构目录"}
            </span>
            <div className="loading-track">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="loading glass error" role="alert">
          <p>{error}</p>
          <Button variant="ghost" onClick={retry}>
            重试模型加载
          </Button>
        </div>
      )}
      <DetailSheet
        details={details}
        setDetails={setDetails}
        chosen={chosen}
        selectedParts={selectedParts}
        state={state}
        onHide={hideSelected}
        onToggleIsolate={() => setState((s) => ({ ...s, isolate: !s.isolate, explode: 0 }))}
        onClear={() => {
          setState((s) => ({ ...s, selected: [], isolate: false }));
          setChosen(null);
          setDetails(false);
        }}
      />
      <AboutSheet about={about} setAbout={setAbout} />
    </main>
  );
}
