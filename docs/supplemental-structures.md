# 肌肉与关节补丁

当前导入129个补充网格：新增126个结构，替换左右腹外斜肌和腹白线。模型总计2360个独立网格、3638个概念。旧结构ID保留，替换项在 `atlas.json` 的 `originalPart` 中保留原几何记录。

两个阶段的主要结构已可显示、搜索、选择、隔离和隐藏。下表明确区分已提供的模型与尚未独立建模的组织；不能据此宣称全部人体组织或完整TFCC已经补齐。

| 范围 | 当前实现 |
| --- | --- |
| 第一阶段：头面部 | 双侧颞肌、咬肌浅深部、翼内肌、翼外肌上/下头、口轮匝肌、颊肌、额腹、枕腹、眼轮匝肌眶/睑部、颧大/小肌、颏肌 |
| 第一阶段：腹壁 | 更新左右腹外斜肌和腹白线，新增腹内斜肌、腹横肌、腹股沟韧带；三层共享同一区域变换，系统面板可逐层隐藏 |
| 第一阶段：膝 | 双侧内外侧半月板、前后交叉韧带、内侧副韧带浅深部、外侧副韧带、髌内外侧支持带、髌韧带 |
| 第二阶段：腕 | 三角纤维软骨盘、掌背侧桡尺韧带、尺月韧带、尺三角韧带、舟月/月三角骨间韧带、腕伸肌支持带、尺侧腕伸肌腱鞘整体 |
| 第二阶段：其他主要韧带 | 肩部喙肩/喙肱/盂肱上中下韧带及盂唇；肘部桡骨环状及尺桡侧副韧带；髋部髂股/耻股/坐股韧带、股骨头韧带及髋臼唇；踝部距腓前后/跟腓/胫跟/胫舟/胫距后/胫腓前后韧带；脊柱前后纵、黄、棘上、棘间及项韧带 |

## 尚未独立补齐

- 腹直肌鞘：当前腹壁源模型没有独立命名的鞘网格，不能把任意平面壳体当作该结构。
- TFCC半月板同源体：本次源文件没有独立命名的对应网格。
- TFCC尺侧腕伸肌腱鞘底：源文件提供的是腱鞘整体，不能把它等同于鞘底。TFCC搜索分组只包含软骨盘、掌背侧桡尺韧带、尺月和尺三角韧带，并在详情明确完整性限制。

髌韧带并非源文件中独立命名的整块网格：它从股直肌网格远端 `Tendon` 材质区域分离，使用骨骼文件中的 `Patellar_ligamento[l/r]` 起点标记确定近端裁剪界限。此处理保留在来源字段和结构说明中，分离边界仍需专业解剖审校。

## 来源和许可

- 基础：BodyParts3D 4.0，现行CC BY 4.0。
- 补充：[Z-Anatomy固定版本](https://github.com/LluisV/Z-Anatomy/tree/6c7f9016bd5899ac8edafd31b9900c151df42ed6/Resources/Models)，CC BY-SA 4.0。
- 文件：`MuscularSystem100.fbx`（37,343,180字节）、`Joints100.fbx`（9,804,796字节）、`SkeletalSystem100.fbx`（41,339,660字节）。全部校验Git blob身份和SHA-256。
- 前两者提供补充网格，骨骼文件仅用于配准参照。骨骼文件的1952个网格包含注释和附着标记，不能计作1952块骨。
- `public/ATTRIBUTION.md` 和各网格的 `source` 字段保留归属、文件、原始网格名、源ID、SHA-256、许可和适配记录。补充几何及衍生网格记录按CC BY-SA 4.0发布，应用代码保留MIT许可。未引入上游耳、肾等NC资产。
- 新结构使用独立ZA命名空间，没有编造未经核实的FMA编号。

## 配准方法及限制

先提取95组同名骨骼自身的顶点，不把FBX子级标签或附着标记算入骨骼几何。长骨另分近端和远端区域，采用带离群点剔除的相似变换ICP；尺度、旋转或残差超出范围的候选不会用作参照。当前保留109个整骨/端部参照。

然后分别为头面、腹壁、脊柱及左右肩、肘、腕、髋、膝、踝计算共享的有界仿射变换。同一解剖区域的补充组织使用相同变换，因此腹壁三层的相对层次关系不被逐顶点变形破坏；变换必须保持正行列式。重算顶点法线后写入两个独立补充分块，保留基础分块。

`docs/supplemental-registration.json` 记录参照、剔除项、矩阵及误差。报告中的P95是留出采样点到目标采样顶点的距离，**不是**精确表面距离、软组织附着误差或专业解剖正确性证据。原始模型有形态和姿态差异；此次工作提供教育展示补丁，配准、纤维方向和髌韧带分离边界仍需专业审校。

## 重建

```sh
python3 scripts/fetch-supplemental-sources.py
python3 -m venv work/registration-env
work/registration-env/bin/pip install -r scripts/registration-requirements.txt
node scripts/prepare-supplemental.mjs
work/registration-env/bin/python scripts/register-supplemental.py
node scripts/build-supplemental-atlas.mjs
```

源文件及中间产物保存在忽略版本控制的 `work/z-anatomy`。导入器可重跑：先恢复替换项的原始记录并移除旧补充项，再生成确定的ID和数据，不会重复累加网格。

`scripts/supplemental-muscles.tsv` 和 `scripts/supplemental-joints.tsv` 维护来源名称、阶段、中文名称和说明。生成的 `app/data/supplemental-descriptions.json` 供原说明重建器使用，避免重建全量说明时丢失补充结构说明。

## 验证与预览

```sh
npm run check
npm run validate:atlas
npm run validate:supplemental
npm run validate:interactions
npm run build
npm run test:e2e
```

覆盖验证检查每个目标的精确来源、网格引用、侧别、概念、包围盒、散列和gzip内容；`--require-complete` 在上述未独立建模项仍存在时返回失败，避免把阶段性补丁误报为全部补齐。

逐项来源及范围见 `docs/supplemental-coverage.json`。渲染预览见 `docs/supplemental-preview/`；接触表以独立配色展示腹壁层次，实际查看器仍使用统一肌肉系统配色。预览截图用于检查几何显示，不等同于解剖专业审校。

### 本次验证结果（2026-09-15）

类型检查、基础图谱校验、补充覆盖校验、交互状态校验和生产构建均通过。浏览器测试9项均已通过：完整运行中8项通过，桌面完整流程在修正旧提示文案断言并为软件WebGL渲染增加时间预算后，单独复测通过。新增测试覆盖补充结构搜索/显示、TFCC完整性说明和腹壁逐层隐藏、撤销及重置。
