import { ArrowUpRight } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { Atlas } from "../anatomy";
export function AboutSheet({
  atlas,
  about,
  setAbout,
}: {
  atlas: Atlas | null;
  about: boolean;
  setAbout: (open: boolean) => void;
}) {
  return (
    <Sheet open={about} onOpenChange={setAbout}>
      <SheetContent className="about-sheet glass">
        <div className="eyebrow">来源与范围</div>
        <SheetTitle className="structure-title">看见人体。</SheetTitle>
        <SheetDescription>探索 BodyParts3D 中的成年男性参考解剖结构。</SheetDescription>
        <div className="about-copy">
          <p>
            <strong>男性 · BodyParts3D</strong>
            <br />
            {atlas
              ? `成年男性参考解剖数据包含 ${atlas.parts.length.toLocaleString()} 个独立网格和 ${atlas.concepts.length.toLocaleString()} 个已命名概念。`
              : "正在读取解剖结构目录。"}
          </p>
          <p>
            本参考图谱不涵盖人体的所有结构或变异。一个命名概念可能包含多个结构片段；每个原始网格只渲染一次。
          </p>
          <p>
            颜色和系统分组用于辅助探索。几何模型已针对网页显示进行简化，简短说明仅提供一般性科普信息。本图谱用于解剖学参考，不是诊断或外科工具。
          </p>
          <h3>数据来源</h3>
          <p>
            BodyParts3D，© The Database Center for Life Science，依据 CC Attribution 4.0
            International 许可协议提供。
          </p>
          <a
            className="published-site-link"
            href="https://lll888666.github.io/human-atlas-chinese/"
            target="_blank"
            rel="noreferrer"
          >
            打开中文版在线网站 <ArrowUpRight size={14} />
          </a>
          <a
            href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
            target="_blank"
            rel="noreferrer"
          >
            数据集许可协议 <ArrowUpRight size={14} />
          </a>
          <a
            href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html"
            target="_blank"
            rel="noreferrer"
          >
            原始几何数据与元数据 <ArrowUpRight size={14} />
          </a>
          <a
            href="https://academic.oup.com/nar/article/37/suppl_1/D782/1000752"
            target="_blank"
            rel="noreferrer"
          >
            阅读来源论文 <ArrowUpRight size={14} />
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
