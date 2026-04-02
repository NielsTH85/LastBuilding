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

/** Mastery skill unlock thresholds (points spent in a mastery tree). */
const MASTERY_SKILL_THRESHOLDS = [5, 15, 30, 40];

function VerticalProgressBar({ tree, pointsSpent }: { tree: PassiveTreeDef; pointsSpent: number }) {
  const maxPoints = tree.nodes.reduce((sum, n) => sum + n.maxPoints, 0);
  const fillPct = Math.min(100, (pointsSpent / maxPoints) * 100);

  return (
    <div className="relative ml-1 flex w-5 flex-col items-center py-1">
      {/* Top diamond */}
      <div
        className={`z-10 h-3 w-3 flex-shrink-0 rotate-45 border-2 ${
          pointsSpent >= maxPoints
            ? "border-amber-400 bg-amber-500"
            : "border-slate-500 bg-slate-800"
        }`}
      />
      {/* Track */}
      <div className="relative w-3 flex-1 rounded-full border border-amber-900/60 bg-slate-900/80">
        {/* Fill (from bottom up) */}
        <div
          className="absolute inset-x-0 bottom-0 rounded-full bg-gradient-to-t from-amber-700 via-amber-500 to-amber-400 transition-all duration-300"
          style={{ height: `${fillPct}%` }}
        />
        {/* Tick marks */}
        {Array.from({ length: maxPoints - 1 }).map((_, i) => {
          const pct = ((i + 1) / maxPoints) * 100;
          return (
            <div
              key={i}
              className="absolute left-0 h-px w-full bg-slate-700/50"
              style={{ bottom: `${pct}%` }}
            />
          );
        })}
      </div>
      {/* Bottom diamond */}
      <div
        className={`z-10 h-3 w-3 flex-shrink-0 rotate-45 border-2 ${
          pointsSpent > 0
            ? "border-amber-400 bg-amber-500"
            : "border-slate-500 bg-slate-800"
        }`}
      />
    </div>
  );
}

function PointProgressBar({ tree, pointsSpent }: { tree: PassiveTreeDef; pointsSpent: number }) {
  const maxPoints = tree.nodes.reduce((sum, n) => sum + n.maxPoints, 0);
  const isMastery = Boolean(tree.masteryId);
  const thresholds = isMastery ? MASTERY_SKILL_THRESHOLDS : [];

  return (
    <div className="relative mx-auto mt-2 w-full px-2">
      {/* Track background */}
      <div className="relative h-3 rounded-full border border-amber-900/60 bg-slate-900/80">
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-700 via-amber-500 to-amber-400 transition-all duration-300"
          style={{ width: `${Math.min(100, (pointsSpent / maxPoints) * 100)}%` }}
        />
        {/* Tick marks */}
        {Array.from({ length: maxPoints - 1 }).map((_, i) => {
          const pct = ((i + 1) / maxPoints) * 100;
          return (
            <div
              key={i}
              className="absolute top-0 h-full w-px bg-slate-700/50"
              style={{ left: `${pct}%` }}
            />
          );
        })}
      </div>

      {/* Threshold markers for mastery trees */}
      {thresholds.map((t) => {
        if (t > maxPoints) return null;
        const pct = (t / maxPoints) * 100;
        const reached = pointsSpent >= t;
        return (
          <div
            key={t}
            className="absolute -top-1"
            style={{ left: `calc(${pct}% + 0.5rem)`, transform: "translateX(-50%)" }}
          >
            {/* Diamond */}
            <div
              className={`h-4 w-4 rotate-45 border-2 ${
                reached
                  ? "border-amber-400 bg-amber-500"
                  : "border-slate-500 bg-slate-800"
              }`}
            />
            {/* Label */}
            <span
              className={`absolute left-1/2 top-5 -translate-x-1/2 text-[10px] font-bold ${
                reached ? "text-amber-300" : "text-slate-500"
              }`}
            >
              {t}
            </span>
          </div>
        );
      })}

      {/* Points counter */}
      <div className="mt-1 text-center text-[10px] text-slate-400">
        <span className={pointsSpent > 0 ? "text-amber-300" : ""}>{pointsSpent}</span>
        <span> / {maxPoints}</span>
      </div>
    </div>
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
    <div className="flex h-full">
    <svg
      ref={svgRef}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className="h-full min-w-0 flex-1 rounded bg-slate-950/50"
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          dragRef.current = { startX: e.clientX, startY: e.clientY, startVB: { ...vb } };
        }
      }}
      onMouseMove={(e) => {
        const drag = dragRef.current;
        if (!drag || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        setViewBox({
          ...drag.startVB,
          x: drag.startVB.x - ((e.clientX - drag.startX) / rect.width) * drag.startVB.w,
          y: drag.startVB.y - ((e.clientY - drag.startY) / rect.height) * drag.startVB.h,
        });
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
    </svg>
    {/* Vertical progress bar — right edge */}
    <VerticalProgressBar tree={tree} pointsSpent={pointsSpent} />
    </div>
    {tooltip && (
      <NodeTooltip
        node={tooltip.node}
        allocated={allocationMap.get(tooltip.node.id) ?? 0}
        x={tooltip.x}
        y={tooltip.y}
      />
    )}
    <PointProgressBar tree={tree} pointsSpent={pointsSpent} />
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
