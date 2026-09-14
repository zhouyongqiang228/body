import { useRef } from "react";
import { ArrowUpRight, ChevronRight, Focus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  SYSTEMS,
  EXPLANATIONS,
  explanation,
  type Concept,
  type Part,
  type SceneState,
} from "../anatomy";
interface Props {
  details: boolean;
  setDetails: (open: boolean) => void;
  chosen: Concept | null;
  selectedParts: Part[];
  state: SceneState;
  choosePart: (id: string) => void;
  onToggleIsolate: () => void;
  onClear: () => void;
}
export function DetailSheet({
  details,
  setDetails,
  chosen,
  selectedParts,
  state,
  choosePart,
  onToggleIsolate,
  onClear,
}: Props) {
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const selected = selectedParts[0],
    system = SYSTEMS.find((s) => s.id === selected?.system);
  return (
    <Sheet
      open={details && selectedParts.length > 0}
      modal={false}
      disablePointerDismissal
      onOpenChange={setDetails}
    >
      <SheetContent
        showOverlay={false}
        initialFocus={detailTitle}
        className={`detail-sheet glass ${state.isolate ? "is-isolated" : ""}`}
        showCloseButton={true}
      >
        <div className="detail-header">
          <div className="detail-accent" style={{ background: system?.color }} />
          <div className="eyebrow">{system?.name ?? "解剖结构"}</div>
          <SheetTitle ref={detailTitle} tabIndex={-1} className="structure-title">
            {chosen?.name}
          </SheetTitle>
        </div>
        <div className="detail-scroll" key={`${chosen?.id}-${state.isolate}`}>
          <SheetDescription className="structure-description">
            {chosen && selected ? explanation(chosen.name, selected.system) : ""}
          </SheetDescription>
          {chosen && !EXPLANATIONS[chosen.name.toLowerCase()] && (
            <span className="context-note">系统概览 · 结构信息来自原始解剖数据</span>
          )}
          <div className="structure-meta">
            <span>
              图谱编号<strong>{chosen?.id}</strong>
            </span>
            <span>
              选中结构数<strong>{state.selected.length.toLocaleString()}</strong>
            </span>
          </div>
          {selectedParts.length > 1 && (
            <div className="member-list">
              <h3>包含的结构</h3>
              {selectedParts.slice(0, 50).map((p) => (
                <Button variant="ghost" key={p.id} onClick={() => choosePart(p.id)}>
                  <span>{p.name}</span>
                  <ChevronRight size={14} />
                </Button>
              ))}
              {selectedParts.length > 50 && <p>另有 {selectedParts.length - 50} 个三维结构。</p>}
            </div>
          )}
          <a
            className="source-link"
            href="https://lifesciencedb.jp/bp3d/"
            target="_blank"
            rel="noreferrer"
          >
            查看解剖学数据来源 <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="detail-actions">
          <Button
            className={`primary-action ${state.isolate ? "active" : ""}`}
            onClick={() => onToggleIsolate()}
          >
            <Focus size={18} />
            {state.isolate ? "显示周围结构" : "孤立显示此结构"}
            <ChevronRight size={16} />
          </Button>
          <Button variant="ghost" className="secondary-action" onClick={onClear}>
            清除选择
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
