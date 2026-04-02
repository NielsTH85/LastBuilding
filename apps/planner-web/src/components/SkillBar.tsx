import { useEffect, useMemo, useRef, useState } from "react";
import { useBuildStore } from "../store/useBuildStore";
import {
  getImportedSkills,
  getNodeStatDescriptions,
  type SkillDef,
  type SkillNodeDef,
} from "@eob/game-data";

const NODE_R = 20;

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function normalizeSkillId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveSkillDef(skillId: string, allSkills: SkillDef[]): SkillDef | undefined {
  const exact = allSkills.find((s) => s.id === skillId);
  if (exact) return exact;

  const norm = normalizeSkillId(skillId);
  const byNorm = allSkills.find((s) => normalizeSkillId(s.id) === norm);
  if (byNorm) return byNorm;

  // Legacy compatibility: allow prefix/suffix drift (e.g. glacier vs glacier-xy).
  return allSkills.find((s) => {
    const sid = normalizeSkillId(s.id);
    return sid.startsWith(norm) || norm.startsWith(sid);
  });
}

/** Map class/mastery IDs to background images. */
const SKILL_TREE_BGS: Record<string, string> = {
  primalist: "/images/tree-bg/primalist.webp",
  beastmaster: "/images/tree-bg/beastmaster.webp",
  shaman: "/images/tree-bg/shaman.webp",
  druid: "/images/tree-bg/druid.webp",
  mage: "/images/tree-bg/mage.webp",
  sorcerer: "/images/tree-bg/sorcerer.webp",
  spellblade: "/images/tree-bg/spellblade.webp",
  runemaster: "/images/tree-bg/runemaster.webp",
  sentinel: "/images/tree-bg/sentinel.webp",
  voidknight: "/images/tree-bg/voidknight.webp",
  forgeguard: "/images/tree-bg/forgeguard.webp",
  paladin: "/images/tree-bg/paladin.webp",
  acolyte: "/images/tree-bg/acolyte.webp",
  necromancer: "/images/tree-bg/necromancer.webp",
  lich: "/images/tree-bg/lich.webp",
  warlock: "/images/tree-bg/warlock.webp",
  rogue: "/images/tree-bg/rogue.webp",
  bladedancer: "/images/tree-bg/bladedancer.webp",
  marksman: "/images/tree-bg/marksman.webp",
  falconer: "/images/tree-bg/falconer.webp",
};

function SkillNodeTooltip({
  node,
  allocated,
  x,
  y,
}: {
  node: SkillNodeDef;
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
      {node.maxPoints > 0 && (
        <div className="mb-1 text-xs text-slate-400">
          {allocated}/{node.maxPoints} points
        </div>
      )}
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

function getCenter(node: SkillNodeDef) {
  return { cx: node.position.x, cy: -node.position.y };
}

function SkillNodeCircle({
  node,
  allocated,
  onAllocate,
  onDeallocate,
  onHover,
  onLeave,
  onMouseMove,
}: {
  node: SkillNodeDef;
  allocated: number;
  onAllocate: () => void;
  onDeallocate: () => void;
  onHover: () => void;
  onLeave: () => void;
  onMouseMove: (e: React.MouseEvent) => void;
}) {
  const { cx, cy } = getCenter(node);
  const isRoot = node.maxPoints === 0;
  const isFull = !isRoot && allocated >= node.maxPoints;
  const has = allocated > 0;

  const strokeColor = isRoot ? "#a78bfa" : isFull ? "#a78bfa" : has ? "#8b5cf6" : "#475569";
  let fill = "#1e293b";
  if (isFull) fill = "#8b5cf6";
  else if (has) fill = "#3b82f6";

  const r = isRoot ? NODE_R * 1.4 : NODE_R;

  return (
    <g
      className={isRoot ? undefined : "cursor-pointer"}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onMouseMove={onMouseMove}
      onClick={isRoot ? undefined : () => onAllocate()}
      onContextMenu={isRoot ? undefined : (e) => {
        e.preventDefault();
        onDeallocate();
      }}
    >
      {node.icon ? (
        <>
          <circle cx={cx} cy={cy} r={r} fill="#0f172a" stroke={strokeColor} strokeWidth={isRoot ? 3 : 2} />
          <clipPath id={`clip-sk-${node.id}`}>
            <circle cx={cx} cy={cy} r={r - 2} />
          </clipPath>
          <image
            href={node.icon}
            x={cx - r + 2}
            y={cy - r + 2}
            width={(r - 2) * 2}
            height={(r - 2) * 2}
            clipPath={`url(#clip-sk-${node.id})`}
            className="pointer-events-none"
            style={{ opacity: isRoot || has ? 1 : 0.5 }}
          />
        </>
      ) : (
        <>
          <circle cx={cx} cy={cy} r={r} fill={fill} stroke={strokeColor} strokeWidth={isRoot ? 3 : 2} />
          <text x={cx} y={cy - 3} textAnchor="middle" className="pointer-events-none select-none fill-white text-[8px] font-medium">
            {node.name.length > 11 ? node.name.slice(0, 10) + "…" : node.name}
          </text>
        </>
      )}
      {!isRoot && (
        <>
          <circle
            cx={cx + NODE_R * 0.65}
            cy={cy + NODE_R * 0.65}
            r={7}
            fill="#0f172a"
            stroke={strokeColor}
            strokeWidth={1.5}
          />
          <text
            x={cx + NODE_R * 0.65}
            y={cy + NODE_R * 0.65 + 3}
            textAnchor="middle"
            className="pointer-events-none select-none fill-white text-[6px] font-bold"
          >
            {allocated}/{node.maxPoints}
          </text>
        </>
      )}
    </g>
  );
}

function SkillTreeView({ skill, buildSkillId }: { skill: SkillDef; buildSkillId?: string }) {
  const build = useBuildStore((s) => s.build);
  const allocateNode = useBuildStore((s) => s.allocateSkillNode);
  const previewNode = useBuildStore((s) => s.previewSkillNode);
  const clearPreview = useBuildStore((s) => s.clearPreview);

  const resolvedBuildSkillId = buildSkillId ?? skill.id;
  const skillAlloc = build.skills.find((s) => s.skillId === resolvedBuildSkillId);
  const nodeMap = new Map((skillAlloc?.allocatedNodes ?? []).map((n) => [n.nodeId, n.points]));
  const treeNodeMap = new Map(skill.tree.nodes.map((n) => [n.id, n]));
  const [tooltip, setTooltip] = useState<{ node: SkillNodeDef; x: number; y: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<ViewBox | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startVB: ViewBox;
  } | null>(null);

  // Base viewBox from node bounds (stable for a given skill tree)
  const baseVB = useMemo<ViewBox>(() => {
    const xs = skill.tree.nodes.map((n) => n.position.x);
    const ys = skill.tree.nodes.map((n) => -n.position.y);
    const pad = 50;
    const x = Math.min(...xs) - pad;
    const y = Math.min(...ys) - pad;
    return {
      x,
      y,
      w: Math.max(...xs) - x + pad,
      h: Math.max(...ys) - y + pad,
    };
  }, [skill.tree.nodes]);

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

  // Reset zoom when switching skills
  useEffect(() => setViewBox(null), [skill.id]);

  const bgHref = SKILL_TREE_BGS[skill.masteryId ?? skill.classId] ?? SKILL_TREE_BGS[skill.classId];

  return (
    <div className="flex flex-col h-full">
      <h4 className="mb-1 text-xs font-semibold text-purple-300">{skill.name} Tree</h4>
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="h-full w-full cursor-grab rounded bg-slate-950/50 active:cursor-grabbing"
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
        {/* edges */}
        {skill.tree.nodes.map((node) =>
          node.prerequisites.map((preId) => {
            const parent = treeNodeMap.get(preId);
            if (!parent) return null;
            const from = getCenter(parent);
            const to = getCenter(node);
            return (
              <line key={`${preId}-${node.id}`} x1={from.cx} y1={from.cy} x2={to.cx} y2={to.cy} stroke="#475569" strokeWidth={2} />
            );
          }),
        )}
        {/* nodes */}
        {skill.tree.nodes.map((node) => {
          const pts = nodeMap.get(node.id) ?? 0;
          return (
            <SkillNodeCircle
              key={node.id}
              node={node}
              allocated={pts}
              onAllocate={() => allocateNode(resolvedBuildSkillId, node.id, Math.min(pts + 1, node.maxPoints))}
              onDeallocate={() => {
                if (pts > 0) allocateNode(resolvedBuildSkillId, node.id, pts - 1);
              }}
              onHover={() => {
                if (pts < node.maxPoints) previewNode(resolvedBuildSkillId, node.id, pts + 1);
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
      {tooltip && (
        <SkillNodeTooltip
          node={tooltip.node}
          allocated={nodeMap.get(tooltip.node.id) ?? 0}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}
    </div>
  );
}

export default function SkillBar() {
  const build = useBuildStore((s) => s.build);
  const addSkillAction = useBuildStore((s) => s.addSkill);
  const removeSkillAction = useBuildStore((s) => s.removeSkill);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const classId = build.character.classId;

  const allSkills = useMemo(
    () => getImportedSkills(classId),
    [classId],
  );

  const equippedSkillIds = build.skills.map((s) => s.skillId);
  const availableSkills = allSkills.filter((s) => !equippedSkillIds.includes(s.id));
  const activeSkillDef = selectedSkill ? resolveSkillDef(selectedSkill, allSkills) : undefined;

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase text-slate-400">Skills ({equippedSkillIds.length}/5)</h3>

      {/* Skill bar */}
      <div className="mb-3 flex gap-2">
        {build.skills.map((s) => {
          const def = resolveSkillDef(s.skillId, allSkills);
          return (
            <button
              key={s.skillId}
              onClick={() => setSelectedSkill(s.skillId === selectedSkill ? null : s.skillId)}
              onContextMenu={(e) => {
                e.preventDefault();
                removeSkillAction(s.skillId);
                if (selectedSkill === s.skillId) setSelectedSkill(null);
              }}
              className={`flex items-center gap-1.5 rounded border px-2 py-1.5 text-xs font-medium transition-colors ${
                selectedSkill === s.skillId
                  ? "border-purple-500 bg-purple-900/40 text-purple-200"
                  : "border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500"
              }`}
            >
              {def?.icon && (
                <img src={def.icon} alt="" className="h-5 w-5 rounded-sm" />
              )}
              {def?.name ?? s.skillId}
            </button>
          );
        })}

        {/* Add skill dropdown */}
        {equippedSkillIds.length < 5 && availableSkills.length > 0 && (
          <select
            className="rounded border border-dashed border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-400"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                addSkillAction(e.target.value);
                setSelectedSkill(e.target.value);
              }
            }}
          >
            <option value="">+ Add skill</option>
            {availableSkills.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Skill tree */}
      {selectedSkill && activeSkillDef && (
        <SkillTreeView skill={activeSkillDef} buildSkillId={selectedSkill} />
      )}
      {(!selectedSkill || !activeSkillDef) && equippedSkillIds.length > 0 && (
        <p className="text-xs text-slate-500 italic">Click a skill to view its tree.</p>
      )}
      {equippedSkillIds.length === 0 && (
        <p className="text-xs text-slate-500 italic">Add a skill to get started.</p>
      )}
    </div>
  );
}
