# 解剖数据归属与致谢

BodyParts3D，© The Database Center for Life Science，依据 CC Attribution 4.0 International 许可发布。

- 许可证：https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html（更新于 2025-02-27）
- 数据集：https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- 许可证条款：https://creativecommons.org/licenses/by/4.0/
- 源几何数据：`isa_BP3D_4.0_obj_99.zip`，BodyParts3D 4.0。
- 英文名称与关系：来自同一存档中的 IS-A 与 PART-OF 概念表、元素表和包含关系表。
- 论文：Mitsuhashi 等（2009），BodyParts3D：面向解剖学概念的三维结构数据库。https://doi.org/10.1093/nar/gkn613

适配处理：将坐标轴和单位从毫米/Z-up 转换为米/Y-up；将模型平移至展台静置；使用 meshoptimizer 简化几何体，每个结构的相对误差上限为 0.2%；将法线量化为有符号 16 位整数；打包为二进制分块；并为本界面整理显示系统分组和配色。基础源数据包含 2,234 个独立 OBJ 网格；补丁保留所有原始网格身份，左右腹外斜肌及腹白线采用下述补充几何，并在清单中保留原几何记录。合并后的层级结构包含 3,432 个带名称的 FMA 概念，这些概念可能对应多个网格。清单文件保留了源数据身份信息。

源 OBJ 注释提到较早的 CC BY-SA 2.1 Japan 许可证。上方链接所指向的官方现行数据库许可证取代了该历史文本，并明确允许依据 CC BY 4.0 进行再发布和改编。

BodyParts3D 以 TARO MRI 和解剖学插图修订为基础，呈现成年男性参考解剖结构。它并不涵盖所有可能的人体解剖结构或个体差异。本界面仅供教育用途，不是临床工具。

## 肌肉与关节补充数据（当前版本）

Z-Anatomy — The open source atlas of anatomy，CC BY-SA 4.0。依上游要求同时保留归属：BodyParts3D — The Database Center for Life Science — CC BY-SA 2.1 Japan（上游的历史归属文字）。基础 BodyParts3D 数据的现行许可仍见本文件开头。

- 固定源版本：[LluisV/Z-Anatomy / 6c7f9016bd5899ac8edafd31b9900c151df42ed6](https://github.com/LluisV/Z-Anatomy/tree/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models)。
- 源文件：`MuscularSystem100.fbx`、`Joints100.fbx`；`SkeletalSystem100.fbx` 仅提供配准参照。
- [上游模型许可及归属](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/License.txt)。
- [CC BY-SA 4.0 许可条款](https://creativecommons.org/licenses/by-sa/4.0/)。
- 适配者：本项目贡献者。处理包括读取 FBX 世界坐标、厘米转米、对应骨骼及长骨两端的相似变换配准、各解剖区域共享的有界仿射变换、焊接重合顶点、重算法线、中文命名、二进制分块和 gzip 压缩。左右髌韧带从源股直肌远端肌腱材质区域分离，近端分界参考源髌韧带起点标记。
- 衍生补充网格 `models/supplement-*.bin`、其 gzip 版本及相应衍生网格记录按 CC BY-SA 4.0 发布。每个结构在 `atlas.json` 的 `source` 字段保留源文件、网格名、源 ID、SHA-256 和许可；替换的腹外斜肌保留原几何记录。应用代码继续使用 MIT 许可证。
- 本次新增126个独立结构，替换左右腹外斜肌和腹白线。源材料中的耳、肾等带有 NC 限制的其他资产未被引入。
- 此补充模型用于教育展示，几何配准及局部分离尚未经过专业解剖审校。腹直肌鞘、TFCC半月板同源体和尺侧腕伸肌腱鞘底尚无独立补充网格；TFCC分组仅表示已收录的组成。

## 重要血管补充数据

本次从同一固定版本 Z-Anatomy 的 `Resources/Models/FBX/CardioVascular41.fbx` 提取44个新增血管网格及8条主干的补充片段。源 Git blob 为 `aa5bbcb63ae6e9ace8051111b3a85ea87f00c4f3`，SHA-256 为 `ed7d049117cc944a8c47a416b16ade642cbd1392bbcce3c677450d3234dbf680`。

- 归属：Z-Anatomy — The open source atlas of anatomy — CC-BY-SA 4.0；BodyParts3D — The Database Center for Life Science — CC-BY-SA 2.1 Japan（上游要求的历史归属文字）。
- 来源：[固定版本的心血管模型](https://github.com/LluisV/Z-Anatomy/blob/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models/FBX/CardioVascular41.fbx)。
- 适配：FBX 世界坐标提取、厘米转米、重合顶点合并、头颈区域配准、源片段截取及横断面对齐、局部端部适配、重算法线、中文命名、二进制与 gzip 打包。旧主干几何记录在 `vascularOriginal` 字段保存。
- 衍生几何 `models/vascular-*.bin` 及 gzip、补充清单和几何配准记录按 CC BY-SA 4.0 发布。包含原主干的组合网格作为整体按该许可发布；其他基础模型与应用代码许可不变。
- 没有导入此源包之外的耳、肾等 NC 资源。模型接合使用重叠表面，未验证血管腔连续性，未经过专业解剖审校；明确缺失及方法见 [血管补丁说明](../docs/vascular-supplement.md)。

## 历史女性参考资源

仓库的早期版本曾包含女性参考解剖数据：Kristen Browne 和 Heidi Schlehlein，Human Reference Atlas / HuBMAP，*3D Reference Organ Set for Female v1.5*（2023）。CC BY 4.0。几何数据已针对本查看器进行适配。

- 源 DOI：https://doi.org/10.48539/HBM352.BTSQ.586
- 数据集：https://lod.humanatlas.io/ref-organ/united-female/v1.5
- 原始 GLB：https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.5/assets/3d-vh-f-united.glb
- 许可证：https://creativecommons.org/licenses/by/4.0/

适配处理：将原生米/Y-up 坐标映射到展台；焊接重合顶点并对源法线取平均；按每个结构 0.2% 的相对误差上限简化几何体；并量化法线。本界面的配色和显示系统经过整理。全部 888 个源网格均得到呈现，1,073 个源节点可作为单独概念或复合概念进行选择。

这是一个包含全身表面和部分器官（包括女性生殖系统）的参考组合模型。其骨骼与肌肉覆盖并不完整，不代表每个人体结构，也不是某一位个体的扫描结果。其中 8 个胎盘/脐带结构归入“妊娠参考”系统，默认隐藏。
