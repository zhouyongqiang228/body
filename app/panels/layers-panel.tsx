import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
const organs: SystemId[] = [
  "cardiac",
  "respiratory",
  "digestive",
  "urinary",
  "endocrine",
  "reproductive",
];
export function LayersPanel({ open, visible, counts, visibleCount, onVisible, onClose }: Props) {
  const systems = SYSTEMS.filter((s) => counts[s.id] > 0);
  const presets = [
    { label: "全部", ids: systems.map((s) => s.id) },
    { label: "骨骼", ids: ["skeletal"] as SystemId[] },
    { label: "内脏", ids: organs },
  ];
  return (
    <section className={`layers-panel glass ${open ? "mobile-open" : ""}`} aria-label="解剖层次">
      <div className="panel-heading">
        <span>系统</span>
        <Button
          variant="ghost"
          className="mobile-only icon-button"
          onClick={onClose}
          aria-label="关闭系统面板"
        >
          <X size={18} />
        </Button>
        <Badge variant="secondary" className="desktop-only small-number">
          {systems.length}
        </Badge>
      </div>
      <div className="layer-presets">
        {presets.map((p) => (
          <Button
            key={p.label}
            variant="ghost"
            disabled={!systems.length}
            aria-pressed={
              p.ids.length > 0 &&
              visible.length === p.ids.length &&
              p.ids.every((id) => visible.includes(id))
            }
            onClick={() => onVisible(p.ids)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="system-list">
        {systems.map((s) => (
          <div className={`system-row ${visible.includes(s.id) ? "enabled" : ""}`} key={s.id}>
            <Button
              variant="ghost"
              className="system-name"
              title={`仅显示${s.name}`}
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
        <Button variant="ghost" onClick={() => onVisible([])}>
          全部隐藏
        </Button>
      </div>
    </section>
  );
}
