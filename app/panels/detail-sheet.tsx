import { useRef } from "react";
import { ChevronRight, Focus, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { type Concept, type Part, type SceneState } from "../anatomy";
import { structureDescription, structureTitle } from "@/app/structure-descriptions";
interface Props {
  details: boolean;
  setDetails: (open: boolean) => void;
  chosen: Concept | null;
  selectedParts: Part[];
  state: SceneState;
  onToggleIsolate: () => void;
  onClear: () => void;
  onHide: () => void;
}
export function DetailSheet({
  details,
  setDetails,
  chosen,
  selectedParts,
  state,
  onToggleIsolate,
  onClear,
  onHide,
}: Props) {
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const title = structureTitle(chosen?.name ?? "");
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
          <SheetTitle ref={detailTitle} tabIndex={-1} className="structure-title">
            {title.name}
            {title.side && <small className="structure-side">{title.side}</small>}
          </SheetTitle>
        </div>
        <div className="detail-scroll" key={chosen?.id}>
          <SheetDescription className="structure-description">
            {chosen ? structureDescription(chosen.id) : ""}
          </SheetDescription>
        </div>
        <div className="detail-actions">
          <Button
            className={`primary-action ${state.isolate ? "active" : ""}`}
            onClick={onToggleIsolate}
          >
            <Focus size={18} />
            {state.isolate ? "显示周围结构" : "孤立显示此结构"}
            <ChevronRight size={16} />
          </Button>
          <Button variant="ghost" className="secondary-action" onClick={onClear}>
            清除选择
          </Button>
          <Button variant="ghost" className="secondary-action" onClick={onHide}>
            <EyeOff size={16} />
            隐藏此结构
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
