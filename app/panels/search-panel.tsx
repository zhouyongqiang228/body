import { useMemo, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { SYSTEMS, SEARCH_ALIASES, type Atlas, type Concept } from "../anatomy";

function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const pieces = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {pieces.map((piece, i) =>
        piece.toLowerCase() === term.toLowerCase() ? <mark key={i}>{piece}</mark> : piece,
      )}
    </>
  );
}

interface Props {
  atlas: Atlas | null;
  query: string;
  onQuery: (query: string) => void;
  onChoose: (concept: Concept) => void;
  onClose: () => void;
}
export function SearchPanel({ atlas, query, onQuery, onChoose, onClose }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const raw = query.toLowerCase().trim(),
    term = SEARCH_ALIASES[raw] ?? raw;
  const systems = useMemo(() => {
    const parts = new Map(atlas?.parts.map((p) => [p.id, p.system]));
    return new Map(
      atlas?.concepts.map((c) => {
        const ids = new Set(c.elements.map((id) => parts.get(id)));
        return [
          c.id,
          SYSTEMS.filter((s) => ids.has(s.id))
            .map((s) => s.name)
            .join("、"),
        ];
      }),
    );
  }, [atlas]);
  const matches = useMemo(() => {
    if (!atlas) return [];
    if (!term)
      return [
        "FMA7088",
        "FMA50801",
        "FMA7197",
        "FMA7148",
        "FMA7196",
        "FMA7198",
        "FMA15900",
        "FMA7394",
      ]
        .map((id) => atlas.concepts.find((c) => c.id === id))
        .filter((c): c is Concept => !!c);
    return atlas.concepts
      .filter((c) => c.name.toLowerCase().includes(term) || c.id.toLowerCase().includes(raw))
      .sort(
        (a, b) =>
          Number(b.name.toLowerCase() === term) - Number(a.name.toLowerCase() === term) ||
          a.name.length - b.name.length,
      );
  }, [atlas, term, raw]);
  const results = useMemo(() => matches.slice(0, 80), [matches]);
  const clear = () => {
    onQuery("");
    input.current?.focus();
  };
  return (
    <section className="search-panel glass" aria-label="查找解剖结构">
      <div className="panel-heading">
        <span>查找结构</span>
        <Button variant="ghost" className="icon-button" onClick={onClose} aria-label="关闭搜索">
          <X size={18} />
        </Button>
      </div>
      <Combobox<Concept>
        modal={false}
        items={results}
        value={null}
        onValueChange={(value) => {
          if (value) onChoose(value);
        }}
        inputValue={query}
        onInputValueChange={onQuery}
        itemToStringLabel={(c) => c.name}
        filter={null}
        open
        onOpenChange={(open, details) => {
          const target = details.event.target;
          if (details.reason === 'outside-press' && target instanceof Element && target.closest('.search-panel')) return;
          if (!open) onClose();
        }}
      >
        <ComboboxInput
          ref={input}
          autoFocus
          placeholder="例如：心脏、股骨、颅神经……"
          aria-label="搜索已命名的解剖结构"
          showTrigger={false}
        />
        <ComboboxContent className="anatomy-search-results">
          <ComboboxEmpty className="search-empty">
            <span>{atlas ? "没有找到匹配的结构。" : "正在读取解剖结构目录。"}</span>
          </ComboboxEmpty>
          <ComboboxList>
            {(c: Concept) => (
              <ComboboxItem key={c.id} value={c}>
                <span className="search-result-copy">
                  <span className="search-result-name">
                    <Highlight text={c.name} term={term} />
                  </span>
                  <span className="search-result-meta">
                    {systems.get(c.id)} · <Highlight text={c.id} term={raw} />
                  </span>
                </span>
                <span className="small-number">{c.elements.length} 个结构</span>
              </ComboboxItem>
            )}
          </ComboboxList>
          <div className="search-summary">
            <span role="status">
              {!atlas ? "目录加载中" : raw ? `找到 ${matches.length} 项${matches.length > 80 ? "，显示前 80 项" : ""}` : "常用结构"}
            </span>
            {query && <Button variant="ghost" onClick={clear}>清空搜索</Button>}
          </div>
        </ComboboxContent>
      </Combobox>
      <p className="search-note">↑↓ 选择 · Enter 查看 · Esc 关闭</p>
    </section>
  );
}
