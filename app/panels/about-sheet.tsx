import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
export function AboutSheet({
  about,
  setAbout,
}: {
  about: boolean;
  setAbout: (open: boolean) => void;
}) {
  return (
    <Sheet open={about} onOpenChange={setAbout}>
      <SheetContent className="about-sheet glass">
        <SheetTitle className="structure-title">个人信息</SheetTitle>
        <SheetDescription>开发者 · 周永强</SheetDescription>
        <div className="about-copy">
          <h3>联系邮箱</h3>
          <a href="mailto:zhouyongqiang2706@gmail.com">zhouyongqiang2706@gmail.com</a>
          <h3>数据来源</h3>
          <p>
            <a href="https://github.com/ashemag/human-atlas" target="_blank" rel="noreferrer">
              Human Atlas（GitHub）
            </a>
          </p>
          <p>三维解剖数据：© The Database Center for Life Science，依据 CC BY 4.0 许可提供。</p>
          <p>补充肌肉、关节、血管、神经、淋巴结及腺体模型：Z-Anatomy，依据 CC BY-SA 4.0 许可改编。包含骨骼配准及局部分离处理。</p>
          <a href={`${import.meta.env.BASE_URL}ATTRIBUTION.md`} target="_blank" rel="noreferrer">
            数据来源与许可
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
