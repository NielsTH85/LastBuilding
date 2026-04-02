import { useEffect, useMemo, useRef, useState } from "react";
import { useBuildStore } from "../store/useBuildStore";
import {
  getImportedPassiveTrees,
  getNodeStatDescriptions,
  type PassiveTreeDef,
  type PassiveNodeDef,
} from "@eob/game-data";

const NODE_RADIUS = 22;

/** Map tree IDs to background image filenames (downloaded from maxroll CDN). */
const TREE_BACKGROUNDS: Record<string, string> = {
  "primalist-base": "/images/tree-bg/primalist.webp",
  beastmaster: "/images/tree-bg/beastmaster.webp",
  shaman: "/images/tree-bg/shaman.webp",
  druid: "/images/tree-bg/druid.webp",
  "mage-base": "/images/tree-bg/mage.webp",
  sorcerer: "/images/tree-bg/sorcerer.webp",
  spellblade: "/images/tree-bg/spellblade.webp",
  runemaster: "/images/tree-bg/runemaster.webp",
  "sentinel-base": "/images/tree-bg/sentinel.webp",
  voidknight: "/images/tree-bg/voidknight.webp",
  forgeguard: "/images/tree-bg/forgeguard.webp",
  paladin: "/images/tree-bg/paladin.webp",
  "acolyte-base": "/images/tree-bg/acolyte.webp",
  necromancer: "/images/tree-bg/necromancer.webp",
  lich: "/images/tree-bg/lich.webp",
  warlock: "/images/tree-bg/warlock.webp",
  "rogue-base": "/images/tree-bg/rogue.webp",
  bladedancer: "/images/tree-bg/bladedancer.webp",
  marksman: "/images/tree-bg/marksman.webp",
  falconer: "/images/tree-bg/falconer.webp",
};

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function NodeTooltip({
  node,
  allocated,
  x,
  y,
}: {
  node: PassiveNodeDef;
  allocated: number;
  x: number;
  y: number;
}) {
  const stats = getNodeStatDescriptions(node.id);
  return (
    <div
      className="pointer-events-none fixed z-50 max-w-xs rounded border border-slate-600 bg-slate-800 px-3 py-2 shadow-lg"
      style={{ left: x + 16, top: y - 8 }}
    >
      <div className="mb-1 text-sm font-semibold text-amber-300">{node.name}</div>
      <div className="mb-1 text-xs text-slate-400">
        {allocated}/{node.maxPoints} points
      </div>
      {stats.length > 0 && (
        <ul className="mb-1 space-y-0.5">
          {stats.map((s, i) => (
            <li key={i} className={`text-xs ${s.downside ? "text-red-400" : "text-slate-200"}`}>
              {s.value} {s.statName}
            </li>
          ))}
        </ul>
      )}
      {node.description && (
        <p className="text-xs italic text-slate-400">{node.description}</p>
      )}
    </div>
  );
}

function getNodeCenter(node: PassiveNodeDef): { cx: number; cy: number } {
  return { cx: node.position.x, cy: -node.position.y };
}

function PassiveNode({
  node,
  allocated,
  onAllocate,
  onDeallocate,
  onHover,
  onLeave,
  onMouseMove,
}: {
  node: PassiveNodeDef;
  allocated: number;
  onAllocate: () => void;
  onDeallocate: () => void;
  onHover: () => void;
  onLeave: () => void;
  onMouseMove: (e: React.MouseEvent) => void;
}) {
  const { cx, cy } = getNodeCenter(node);
  const isFull = allocated >= node.maxPoints;
  const hasPoints = allocated > 0;

  const strokeColor = isFull ? "#f59e0b" : hasPoints ? "#fbbf24" : "#475569";
  let fill = "#1e293b";
  if (isFull) fill = "#f59e0b";
  else if (hasPoints) fill = "#3b82f6";

  return (
    <g
      className="cursor-pointer"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onMouseMove={onMouseMove}
      onClick={(e) => {
        e.preventDefault();
        if (e.shiftKey || e.button === 2) {
          onDeallocate();
        } else {
          onAllocate();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onDeallocate();
      }}
    >
      {node.icon ? (
        <>
          {/* Dark background circle */}
          <circle cx={cx} cy={cy} r={NODE_RADIUS} fill="#0f172a" stroke={strokeColor} strokeWidth={2} />
          <clipPath id={`clip-${node.id}`}>
            <circle cx={cx} cy={cy} r={NODE_RADIUS - 2} />
          </clipPath>
          <image
            href={node.icon}
            x={cx - NODE_RADIUS + 2}
            y={cy - NODE_RADIUS + 2}
            width={(NODE_RADIUS - 2) * 2}
            height={(NODE_RADIUS - 2) * 2}
            clipPath={`url(#clip-${node.id})`}
            className="pointer-events-none"
            style={{ opacity: hasPoints ? 1 : 0.5 }}
          />
        </>
      ) : (
        <>
          <circle cx={cx} cy={cy} r={NODE_RADIUS} fill={fill} stroke={strokeColor} strokeWidth={2} />
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="pointer-events-none select-none fill-white text-[9px] font-medium"
          >
            {node.name.length > 10 ? node.name.slice(0, 9) + "…" : node.name}
          </text>
        </>
      )}
      {/* Allocation badge */}
      <circle
        cx={cx + NODE_RADIUS * 0.65}
        cy={cy + NODE_RADIUS * 0.65}
        r={8}
        fill="#0f172a"
        stroke={strokeColor}
        strokeWidth={1.5}
      />
      <text
        x={cx + NODE_RADIUS * 0.65}
        y={cy + NODE_RADIUS * 0.65 + 3}
        textAnchor="middle"
        className="pointer-events-none select-none fill-white text-[7px] font-bold"
      >
        {allocated}/{node.maxPoints}
      </text>
    </g>
  );
}

function TreeEdges({ tree }: { tree: PassiveTreeDef }) {
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const nodeMap = new Map(tree.nodes.map((n) => [n.id, n]));

  for (const node of tree.nodes) {
    for (const preId of node.prerequisites) {
      const parent = nodeMap.get(preId);
      if (!parent) continue;
      const from = getNodeCenter(parent);
      const to = getNodeCenter(node);
      edges.push({ x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy });
    }
  }

  return (
    <>
      {edges.map((e, i) => (
        <line
          key={i}
          x1={e.x1}
          y1={e.y1}
          x2={e.x2}
          y2={e.y2}
          stroke="#475569"
          strokeWidth={2}
        />
      ))}
    </>
  );
}

/**
 * Build a sorted list of { pts, x } columns from the tree's masteryRequirement
 * values and their actual node x-positions.
 */
function getTreeColumns(tree: PassiveTreeDef) {
  const groups = new Map<number, number[]>();
  for (const n of tree.nodes) {
    const req = n.masteryRequirement ?? 0;
    let xs = groups.get(req);
    if (!xs) { xs = []; groups.set(req, xs); }
    xs.push(n.position.x);
  }
  return [...groups.entries()]
    .map(([pts, xs]) => ({ pts, x: xs.reduce((a, b) => a + b, 0) / xs.length }))
    .sort((a, b) => a.pts - b.pts);
}

/** Interpolate an x-position for a given point value among the columns. */
function columnX(columns: { pts: number; x: number }[], points: number): number {
  if (columns.length === 0) return 0;
  const first = columns[0]!;
  const last = columns[columns.length - 1]!;
  if (points <= first.pts) return first.x;
  if (points >= last.pts) return last.x;
  for (let i = 0; i < columns.length - 1; i++) {
    const a = columns[i]!, b = columns[i + 1]!;
    if (points >= a.pts && points <= b.pts) {
      const t = (points - a.pts) / (b.pts - a.pts);
      return a.x + t * (b.x - a.x);
    }
  }
  return last.x;
}

function SvgProgressBar({
  baseVB,
  tree,
  pointsSpent,
}: {
  baseVB: ViewBox;
  tree: PassiveTreeDef;
  pointsSpent: number;
}) {
  const columns = getTreeColumns(tree);
  if (columns.length < 2) return null;

  const thresholds = columns.filter((c) => c.pts > 0);
  const maxPoints = columns[columns.length - 1]!.pts;
  const firstX = columns[0]!.x;
  const lastX = columns[columns.length - 1]!.x;

  // Bar spans the same x-range as the node columns
  const barY = baseVB.y + baseVB.h + 10;
  const barH = 8;
  const pad = 20;
  const barX = firstX - pad;
  const barW = lastX - firstX + pad * 2;
  const fillEnd = columnX(columns, pointsSpent);
  const fillW = Math.max(0, fillEnd - barX);
  const diamondR = 5;

  return (
    <g className="pointer-events-none">
      {/* Track background */}
      <rect x={barX} y={barY} width={barW} height={barH} rx={4} fill="#0f172a" stroke="#78350f" strokeWidth={1} opacity={0.8} />
      {/* Fill */}
      {fillW > 0 && (
        <rect x={barX} y={barY} width={fillW} height={barH} rx={4} fill="#d97706" opacity={0.9} />
      )}
      {/* Tick marks at each threshold column */}
      {thresholds.map((col) => (
        <line
          key={col.pts}
          x1={col.x}
          y1={barY}
          x2={col.x}
          y2={barY + barH}
          stroke="#334155"
          strokeWidth={0.5}
        />
      ))}
      {/* Threshold diamonds */}
      {thresholds.map((col) => {
        const cy = barY + barH / 2;
        const reached = pointsSpent >= col.pts;
        return (
          <g key={col.pts}>
            <rect
              x={col.x - diamondR}
              y={cy - diamondR}
              width={diamondR * 2}
              height={diamondR * 2}
              fill={reached ? "#f59e0b" : "#1e293b"}
              stroke={reached ? "#fbbf24" : "#64748b"}
              strokeWidth={1}
              transform={`rotate(45 ${col.x} ${cy})`}
            />
            <text
              x={col.x}
              y={barY + barH + 12}
              textAnchor="middle"
              className={`select-none text-[6px] font-bold ${reached ? "fill-amber-300" : "fill-slate-500"}`}
            >
              {col.pts}
            </text>
          </g>
        );
      })}
      {/* Points counter */}
      <text
        x={firstX + (lastX - firstX) / 2}
        y={barY + barH + (thresholds.length > 0 ? 22 : 12)}
        textAnchor="middle"
        className="select-none text-[6px] fill-slate-400"
      >
        <tspan className={pointsSpent > 0 ? "fill-amber-300" : ""}>{pointsSpent}</tspan>
        <tspan> / {maxPoints}</tspan>
      </text>
    </g>
  );
}

function SvgVerticalProgressBar({
  baseVB,
  tree,
  pointsSpent,
}: {
  baseVB: ViewBox;
  tree: PassiveTreeDef;
  pointsSpent: number;
}) {
  const columns = getTreeColumns(tree);
  if (columns.length < 2) return null;

  const maxPoints = columns[columns.length - 1]!.pts;
  const lineX = columnX(columns, pointsSpent);
  const lineTop = baseVB.y;
  const lineBottom = baseVB.y + baseVB.h + 10;
  const diamondR = 5;

  return (
    <g className="pointer-events-none">
      {/* Vertical sweep line */}
      <line
        x1={lineX}
        y1={lineTop}
        x2={lineX}
        y2={lineBottom}
        stroke="#d97706"
        strokeWidth={2}
        opacity={0.85}
      />
      {/* Top diamond */}
      <rect
        x={lineX - diamondR}
        y={lineTop - diamondR - 2}
        width={diamondR * 2}
        height={diamondR * 2}
        fill={pointsSpent >= maxPoints ? "#f59e0b" : "#1e293b"}
        stroke={pointsSpent >= maxPoints ? "#fbbf24" : "#64748b"}
        strokeWidth={1}
        transform={`rotate(45 ${lineX} ${lineTop - 2})`}
      />
      {/* Bottom diamond (sits on horizontal bar) */}
      <rect
        x={lineX - diamondR}
        y={lineBottom - diamondR + 2}
        width={diamondR * 2}
        height={diamondR * 2}
        fill={pointsSpent > 0 ? "#f59e0b" : "#1e293b"}
        stroke={pointsSpent > 0 ? "#fbbf24" : "#64748b"}
        strokeWidth={1}
        transform={`rotate(45 ${lineX} ${lineBottom + 2})`}
      />
    </g>
  );
}

function PassiveTreeView({ tree }: { tree: PassiveTreeDef }) {
  const build = useBuildStore((s) => s.build);
  const allocate = useBuildStore((s) => s.allocatePassive);
  const deallocate = useBuildStore((s) => s.deallocatePassive);
  const preview = useBuildStore((s) => s.previewPassive);
  const clearPreview = useBuildStore((s) => s.clearPreview);

  const allocationMap = new Map(build.passives.map((p) => [p.nodeId, p.points]));

  const pointsSpent = useMemo(() => {
    let sum = 0;
    for (const node of tree.nodes) {
      sum += allocationMap.get(node.id) ?? 0;
    }
    return sum;
  }, [tree.nodes, allocationMap]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<ViewBox | null>(null);
  const [tooltip, setTooltip] = useState<{ node: PassiveNodeDef; x: number; y: number } | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startVB: ViewBox;
  } | null>(null);


  // Base viewBox from node bounds (stable for a given tree)
  const baseVB = useMemo<ViewBox>(() => {
    const xs = tree.nodes.map((n) => n.position.x);
    const ys = tree.nodes.map((n) => -n.position.y);
    const pad = 50;
    const x = Math.min(...xs) - pad;
    const y = Math.min(...ys) - pad;
    return {
      x,
      y,
      w: Math.max(...xs) - x + pad,
      h: Math.max(...ys) - y + pad,
    };
  }, [tree.nodes]);

  const vb = viewBox ?? baseVB;

  // Scroll-wheel zoom toward cursor (non-passive so we can preventDefault)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;

      setViewBox((prev) => {
        const cur = prev ?? baseVB;
        const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
        const newW = Math.max(baseVB.w * 0.2, Math.min(baseVB.w * 2, cur.w * factor));
        const newH = Math.max(baseVB.h * 0.2, Math.min(baseVB.h * 2, cur.h * factor));
        const cursorX = cur.x + mx * cur.w;
        const cursorY = cur.y + my * cur.h;
        return { x: cursorX - mx * newW, y: cursorY - my * newH, w: newW, h: newH };
      });
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, [baseVB]);

  // Reset zoom when switching trees
  useEffect(() => setViewBox(null), [tree.id]);

  const bgHref = TREE_BACKGROUNDS[tree.id];

  return (
    <>
    <div className="relative flex h-full">
    <svg
      ref={svgRef}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className="h-full min-w-0 flex-1 cursor-grab rounded bg-slate-950/50 active:cursor-grabbing"
      onMouseDown={(e) => {
        if (e.button === 0 || e.button === 1) {
          e.preventDefault();
          dragRef.current = { startX: e.clientX, startY: e.clientY, startVB: { ...vb } };
        }
      }}
      onMouseMove={(e) => {
        const drag = dragRef.current;
        if (!drag || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          setViewBox({
            ...drag.startVB,
            x: drag.startVB.x - (dx / rect.width) * drag.startVB.w,
            y: drag.startVB.y - (dy / rect.height) * drag.startVB.h,
          });
        }
      }}
      onMouseUp={() => { dragRef.current = null; }}
      onMouseLeave={() => { dragRef.current = null; }}
      onDoubleClick={() => setViewBox(null)}
    >
      {bgHref && (
        <image
          href={bgHref}
          x={baseVB.x}
          y={baseVB.y}
          width={baseVB.w}
          height={baseVB.h}
          preserveAspectRatio="xMidYMid slice"
          opacity={0.4}
          className="pointer-events-none"
        />
      )}
      <TreeEdges tree={tree} />
      {tree.nodes.map((node) => {
        const pts = allocationMap.get(node.id) ?? 0;
        return (
          <PassiveNode
            key={node.id}
            node={node}
            allocated={pts}
            onAllocate={() => allocate(node.id, Math.min(pts + 1, node.maxPoints))}
            onDeallocate={() => {
              if (pts > 0) deallocate(node.id);
            }}
            onHover={() => {
              if (pts < node.maxPoints) preview(node.id, pts + 1);
              setTooltip((prev) => prev ? { ...prev, node } : null);
            }}
            onLeave={() => {
              clearPreview();
              setTooltip(null);
            }}
            onMouseMove={(e) => {
              setTooltip({ node, x: e.clientX, y: e.clientY });
            }}
          />
        );
      })}
      <SvgProgressBar baseVB={baseVB} tree={tree} pointsSpent={pointsSpent} />
      <SvgVerticalProgressBar baseVB={baseVB} tree={tree} pointsSpent={pointsSpent} />
    </svg>
    </div>
    {tooltip && (
      <NodeTooltip
        node={tooltip.node}
        allocated={allocationMap.get(tooltip.node.id) ?? 0}
        x={tooltip.x}
        y={tooltip.y}
      />
    )}
    </>
  );
}

export default function PassiveTree() {
  const classId = useBuildStore((s) => s.build.character.classId);

  const trees = useMemo(
    () => getImportedPassiveTrees(classId),
    [classId],
  );

  const [activeTreeId, setActiveTreeId] = useState(trees[0]?.id ?? "");
  const passives = useBuildStore((s) => s.build.passives);
  const totalPoints = passives.reduce((sum, p) => sum + p.points, 0);

  // Count points per tree
  const pointsPerTree = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of passives) {
      const colonIdx = p.nodeId.indexOf(":");
      const treeId = colonIdx >= 0 ? p.nodeId.slice(0, colonIdx) : "";
      counts.set(treeId, (counts.get(treeId) ?? 0) + p.points);
    }
    return counts;
  }, [passives]);

  // Reset active tab when class/mastery changes
  useEffect(() => {
    setActiveTreeId(trees[0]?.id ?? "");
  }, [trees]);

  const activeTree = trees.find((t) => t.id === activeTreeId) ?? trees[0];

  return (
    <div className="flex h-full flex-col">
      {/* Sub-tab bar for trees */}
      <div className="flex items-center gap-4 border-b border-slate-700 pb-1">
        <span className="text-xs text-slate-500">
          Points: <span className="font-mono text-slate-300">{totalPoints}</span>
        </span>
        {trees.map((tree) => {
          const pts = pointsPerTree.get(tree.id) ?? 0;
          return (
            <button
              key={tree.id}
              onClick={() => setActiveTreeId(tree.id)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                activeTreeId === tree.id
                  ? "border-b-2 border-purple-400 text-purple-300"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tree.name.replace(/ Passives$/, "")}
              {pts > 0 && (
                <span className="ml-1 text-[10px] text-amber-400">{pts}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tree canvas — fills remaining space */}
      <div className="min-h-0 flex-1 pt-2">
        {activeTree && <PassiveTreeView tree={activeTree} />}
      </div>
    </div>
  );
}
