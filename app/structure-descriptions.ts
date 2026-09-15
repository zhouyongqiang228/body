import descriptions from "./data/structure-descriptions.json";
import vascularDescriptions from "./data/vascular-descriptions.json";

/** Each FMA concept has its own materialized row, independent of display-system colors. */
const table: Record<string, { name: string; description: string }> = { ...descriptions, ...vascularDescriptions };
export function structureDescription(id: string) {
  return table[id]?.description ?? "";
}

/** Keep anatomical directions such as 前/后/内侧 in the name, move only laterality. */
export function structureTitle(name: string) {
  // 左侧脑室 means “left lateral ventricle”: 侧 is part of 侧脑室, not a side suffix.
  const prefix = name.match(/^([左右])(?:侧(?!脑室))?(.*)$/);
  if (prefix) return { name: prefix[2], side: prefix[1] };
  // Some source labels put laterality inside the name (胸腺左叶、阴茎左背动脉).
  const sides = [...new Set(name.match(/[左右]/g))];
  if (sides.length === 1)
    return { name: name.replace(/[左右](?:侧(?!脑室))?/g, ""), side: sides[0] };
  return { name, side: "" };
}
