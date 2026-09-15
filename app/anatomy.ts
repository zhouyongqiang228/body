export type SystemId =
  | "skeletal"
  | "muscular"
  | "arterial"
  | "venous"
  | "nervous"
  | "digestive"
  | "respiratory"
  | "urinary"
  | "reproductive"
  | "lymphatic"
  | "endocrine"
  | "integumentary"
  | "connective"
  | "sensory"
  | "cardiac";
export const SYSTEMS: { id: SystemId; name: string; color: string; description: string }[] = [
  {
    id: "skeletal",
    name: "骨骼",
    color: "#e2d9ba",
    description:
      "骨骼构成人体的支撑框架，保护内脏，并为肌肉提供附着点。骨组织还储存矿物质并参与血细胞生成。",
  },
  {
    id: "muscular",
    name: "肌肉",
    color: "#a85b50",
    description: "骨骼肌通过牵拉附着点产生运动；与肌腱协同完成关节活动、维持姿势并产热。",
  },
  {
    id: "cardiac",
    name: "心脏",
    color: "#b96760",
    description: "心脏是由四个心腔组成的肌性泵。心脏瓣膜引导血液沿肺循环和体循环向前流动。",
  },
  {
    id: "sensory",
    name: "感觉器官",
    color: "#b0c8ce",
    description:
      "这些结构参与视觉、听觉和平衡觉等特殊感觉。其特化组织感受刺激，并与神经系统协作传递信息。",
  },
  {
    id: "arterial",
    name: "动脉",
    color: "#c05245",
    description:
      "心脏推动血液在循环系统中流动。动脉将血液从心脏输送至各组织；在肺循环中则输送至肺。",
  },
  {
    id: "venous",
    name: "静脉",
    color: "#527c9f",
    description:
      "静脉将血液回流至心脏。浅、深静脉网络汇集组织血液；肺静脉则将富含氧的血液从肺带回心脏。",
  },
  {
    id: "nervous",
    name: "神经系统",
    color: "#d8b565",
    description:
      "脑、脊髓和周围神经负责传导与处理信号，支持感觉、运动、协调以及机体功能的自主调节。",
  },
  {
    id: "respiratory",
    name: "呼吸系统",
    color: "#b98991",
    description:
      "气道将空气引入肺，在肺内完成氧和二氧化碳在气体与血液之间的交换。呼吸依靠呼吸肌造成的压力变化。",
  },
  {
    id: "digestive",
    name: "消化系统",
    color: "#b8916b",
    description:
      "消化道分解食物、吸收营养物质和水，并推动残渣向前通过；消化腺等附属器官提供胆汁和消化酶。",
  },
  {
    id: "urinary",
    name: "泌尿系统",
    color: "#b47961",
    description:
      "肾脏滤过血液并调节体液、电解质及酸碱平衡。尿液经输尿管进入膀胱，随后通过尿道排出。",
  },
  {
    id: "lymphatic",
    name: "淋巴系统",
    color: "#879f7c",
    description: "淋巴管将多余的组织液回流至血液循环；淋巴结及其他淋巴器官参与免疫监视和免疫应答。",
  },
  {
    id: "endocrine",
    name: "内分泌系统",
    color: "#c5a09a",
    description: "内分泌器官将激素释放入血，协调代谢、生长、应激反应和生殖等生理过程。",
  },
  {
    id: "reproductive",
    name: "生殖系统",
    color: "#bda098",
    description: "此处展示的男性生殖结构参与精子的生成、成熟与输送，并参与性激素的产生。",
  },
  {
    id: "integumentary",
    name: "体表",
    color: "#ba9b7d",
    description: "体表为外部解剖结构提供参照。皮肤及其附属器构成保护屏障，并参与感觉和体温调节。",
  },
  {
    id: "connective",
    name: "结缔组织",
    color: "#aec3bb",
    description:
      "软骨、韧带及其他结缔组织负责支撑、连接和分隔各结构，并参与关节稳定和机械负荷分配。",
  },
];
export interface Part {
  id: string;
  name: string;
  conceptId: string;
  system: SystemId;
  chunk: number;
  positions: number;
  normals: number;
  indices: number;
  vertexCount: number;
  indexCount: number;
  bounds: [number[], number[]];
  source?: { dataset: string; license: string; file: string; mesh: string; id: number; sha256: string; phase: number };
}
export interface Concept {
  id: string;
  name: string;
  elements: string[];
}
export interface Atlas {
  version: string;
  sex?: "male";
  source?: string;
  scope?: string;
  parts: Part[];
  concepts: Concept[];
  chunks: { url: string; bytes: number; gzip?: string; gzipBytes?: number }[];
  triangles: number;
}
export type View = "three-quarter" | "front" | "back" | "side";
export interface SceneState {
  inspectorOpen?: boolean;
  explode: number;
  visible: SystemId[];
  selected: string[];
  isolate: boolean;
  view: View;
  rotate: boolean;
  reset: number;
  hidden: string[];
}
export const DEFAULT_VISIBLE: SystemId[] = [
  "cardiac",
  "sensory",
  "skeletal",
  "muscular",
  "arterial",
  "venous",
  "nervous",
  "respiratory",
  "digestive",
  "urinary",
  "lymphatic",
  "endocrine",
  "reproductive",
  "connective",
];
/** 常用英文检索词仅用于兼容输入，不会在界面中展示。 */
export const SEARCH_ALIASES: Record<string, string> = {
  tfcc: "tfcc",
  temporalis: "颞肌",
  masseter: "咬肌",
  "external oblique": "腹外斜肌",
  "internal oblique": "腹内斜肌",
  "transversus abdominis": "腹横肌",
  meniscus: "半月板",
  acl: "前交叉韧带",
  pcl: "后交叉韧带",
  heart: "心脏",
  brain: "脑",
  liver: "肝脏",
  stomach: "胃",
  spleen: "脾",
  pancreas: "胰腺",
  "urinary bladder": "膀胱",
  trachea: "气管",
  diaphragm: "膈肌",
  femur: "股骨",
  artery: "动脉",
  arteries: "动脉",
  vein: "静脉",
  veins: "静脉",
  bone: "骨",
  bones: "骨",
  muscle: "肌",
  muscles: "肌",
  nerve: "神经",
  nerves: "神经",
  cartilage: "软骨",
  ligament: "韧带",
  tendon: "肌腱",
  skull: "颅骨",
  rib: "肋骨",
  vertebra: "椎骨",
  vertebrae: "椎骨",
  lung: "肺",
  lungs: "肺",
  kidney: "肾",
  kidneys: "肾",
  esophagus: "食管",
  oesophagus: "食管",
  intestine: "肠",
  colon: "结肠",
  bladder: "膀胱",
  uterus: "子宫",
  ovary: "卵巢",
  testis: "睾丸",
  prostate: "前列腺",
  eye: "眼",
  ear: "耳",
  tongue: "舌",
  skin: "皮肤",
};
