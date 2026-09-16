import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SYSTEMS, type SystemId } from "../anatomy";
interface Props {
  open: boolean;
  visible: SystemId[];
  counts: Record<string, number>;
  visibleCount: number;
  onVisible: (ids: SystemId[]) => void;
  onClose: () => void;
}
export function LayersPanel({ open, visible, counts, visibleCount, onVisible, onClose }: Props) {
  const systems = SYSTEMS.filter((s) => counts[s.id] > 0);
  const allVisible = systems.length > 0 && systems.every((s) => visible.includes(s.id));
  return (
    <section className={`layers-panel glass ${open ? "mobile-open" : ""}`} aria-label="解剖层次">
      <div className="panel-heading">
        <span>系统图层</span>
        <Button
          variant="ghost"
          className="layer-toggle-all"
          disabled={!systems.length}
          onClick={() => onVisible(allVisible ? [] : systems.map((s) => s.id))}
        >
          {allVisible ? "全部隐藏" : "全部显示"}
        </Button>
        <Button
          variant="ghost"
          className="mobile-only icon-button"
          onClick={onClose}
          aria-label="关闭系统面板"
        >
          <X size={18} />
        </Button>
      </div>
      <p className="panel-hint">点击名称单独查看，开关控制叠加</p>
      <div className="system-list">
        {systems.map((s) => (
          <div className={`system-row ${visible.includes(s.id) ? "enabled" : ""}`} key={s.id}>
            <Button
              variant="ghost"
              className="system-name"
              title={`仅显示${s.name}`}
              aria-label={`仅显示${s.name}`}
              aria-pressed={visible.length === 1 && visible.includes(s.id)}
              onClick={() => onVisible([s.id])}
            >
              <span className="system-dot" style={{ background: s.color }} />
              {s.name}
              <span className="system-count">{counts[s.id]}</span>
            </Button>
            <Switch
              checked={visible.includes(s.id)}
              onCheckedChange={(checked) =>
                onVisible(checked ? [...visible, s.id] : visible.filter((id) => id !== s.id))
              }
              aria-label={`显示${s.name}`}
            />
          </div>
        ))}
      </div>
      <div className="panel-foot">
        <span>当前显示 {visibleCount.toLocaleString()} 个结构</span>
      </div>
    </section>
  );
}
