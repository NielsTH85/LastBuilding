import type {
  PassiveNodeDef,
  PassiveTreeDef,
  PassiveTreeOrnamentDef,
} from "../types/class.js";
import type { Modifier } from "../modifiers.js";
import { mapStat, parseStatValue } from "./stat-mapping.js";
import weaverTreeData from "./weaver-tree.json" with { type: "json" };

interface RawWeaverStat {
  statName: string;
  value: string;
  property: number;
  tags: number;
  noScaling: boolean;
  downside: boolean;
}

interface RawWeaverRequirement {
  node: number;
  requirement: number;
}

interface RawTransform {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
  rotation?: {
    x?: number;
    y?: number;
    z?: number;
    w?: number;
  };
}

interface RawWeaverNode {
  maxPoints: number;
  nodeName: string;
  description: string;
  stats: RawWeaverStat[];
  requirements: RawWeaverRequirement[];
  transform?: RawTransform;
  icon?: number;
  weaverEffect?: number;
}

interface RawWeaverOrnament {
  sprite: number;
  transform?: RawTransform;
  color?: { a?: number };
}

interface RawWeaverTree {
  version: number;
  nodes: Record<string, RawWeaverNode>;
  ornaments?: RawWeaverOrnament[];
}

const rawWeaver = weaverTreeData as RawWeaverTree;

function toFallbackStatId(statName: string): string {
  return statName
    .toLowerCase()
    .replace(/[%()]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toFallbackOperation(statName: string): Modifier["operation"] {
  if (/\bmore\b/i.test(statName)) return "more";
  if (/\bincreased\b|\breduced\b|\bless\b/i.test(statName)) return "increased";
  return "add";
}

function convertWeaverNodeStats(nodeId: string, stats: RawWeaverStat[]): Modifier[] {
  const sourceId = `weaver:${nodeId}`;
  return stats.map((stat, idx) => {
    const mapped = mapStat(stat.statName, stat.value);
    const fallbackTarget = toFallbackStatId(stat.statName);
    const fallbackOperation = toFallbackOperation(stat.statName);

    let numericValue = parseStatValue(stat.value);
    const hasExplicitNumber = /-?\d+(?:\.\d+)?/.test(stat.value);
    if (!hasExplicitNumber) numericValue = stat.downside ? -1 : 1;

    return {
      id: `${sourceId}-s${idx}`,
      sourceType: "passive",
      sourceId,
      targetStat: (mapped?.targetStat ?? fallbackTarget) as Modifier["targetStat"],
      operation: mapped?.operation ?? fallbackOperation,
      value: numericValue * (mapped?.valueMul ?? 1),
    };
  });
}

function quaternionToDegrees(rotation: RawTransform["rotation"]): number | undefined {
  if (!rotation) return undefined;
  const z = rotation.z ?? 0;
  const w = rotation.w ?? 1;
  if (!Number.isFinite(z) || !Number.isFinite(w)) return undefined;
  const radians = 2 * Math.atan2(z, w);
  if (!Number.isFinite(radians)) return undefined;
  return (radians * 180) / Math.PI;
}

function convertOrnaments(input: RawWeaverOrnament[] | undefined): PassiveTreeOrnamentDef[] {
  if (!input) return [];
  return input.map((orn, idx) => ({
    id: `weaver-ornament-${idx}`,
    sprite: `/images/ornaments/${orn.sprite}.webp`,
    position: {
      x: orn.transform?.x ?? 0,
      y: orn.transform?.y ?? 0,
    },
    size: {
      width: orn.transform?.width ?? 64,
      height: orn.transform?.height ?? 64,
    },
    rotationDeg: quaternionToDegrees(orn.transform?.rotation),
    opacity: orn.color?.a ?? 0.8,
  }));
}

function mapWeaverSlot(weaverEffect: number | undefined): number | undefined {
  if (weaverEffect == null) return undefined;
  if (weaverEffect === 91) return 4;
  if (weaverEffect === 92) return 5;
  if (weaverEffect === 93) return 0;
  if (weaverEffect === 94) return 1;
  if (weaverEffect === 95) return 2;
  if (weaverEffect === 96) return 3;
  return undefined;
}

export function getImportedWeaverTree(): PassiveTreeDef {
  const nodes: PassiveNodeDef[] = Object.entries(rawWeaver.nodes).map(([id, node]) => ({
    id: `weaver:${id}`,
    treeId: "weaver",
    name: node.nodeName,
    description:
      node.description ||
      (node.stats ?? []).map((s) => `${s.statName} ${s.value}`).join(", ") ||
      node.nodeName,
    maxPoints: node.maxPoints,
    position: {
      x: node.transform?.x ?? 0,
      y: node.transform?.y ?? 0,
    },
    prerequisites: (node.requirements ?? []).map((r) => `weaver:${r.node}`),
    modifiersPerPoint: convertWeaverNodeStats(id, node.stats ?? []),
    masteryRequirement: 0,
    tags: ["weaver"],
    icon: node.icon != null ? `/icons/tree/${node.icon}.png` : undefined,
    weaverSlot: mapWeaverSlot(node.weaverEffect),
  }));

  return {
    id: "weaver",
    classId: "weaver",
    name: "Weaver Tree",
    nodes,
    ornaments: convertOrnaments(rawWeaver.ornaments),
  };
}
