import { useMemo, useState } from "react";
import { useBuildStore } from "../store/useBuildStore";
import type { StatBreakdown } from "@eob/build-model";
import { getGameData, getUniqueItem } from "@eob/game-data";

function formatStat(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type GroupId = "offense" | "enemy" | "defense" | "resources" | "attributes" | "ailments" | "other";

const GROUP_ORDER: GroupId[] = [
  "offense",
  "defense",
  "resources",
  "attributes",
  "ailments",
  "enemy",
  "other",
];

const GROUP_LABELS: Record<GroupId, string> = {
  offense: "Offense",
  enemy: "Enemy & Target",
  defense: "Defense",
  resources: "Resources & Sustain",
  attributes: "Attributes",
  ailments: "Ailments",
  other: "Other",
};

const GROUP_ICONS: Record<GroupId, string> = {
  offense: "⚔️",
  enemy: "👁️",
  defense: "🛡️",
  resources: "💧",
  attributes: "📊",
  ailments: "🔥",
  other: "📋",
};

function getGroup(statId: string): GroupId {
  if (
    statId.includes("expected_dps") ||
    statId.includes("average_hit") ||
    statId.includes("crit") ||
    statId.includes("attack_speed") ||
    statId.includes("cast_speed") ||
    statId.includes("damage") ||
    statId.includes("penetration") ||
    statId.includes("dps_factor")
  ) {
    return "offense";
  }

  if (
    statId.startsWith("enemy_") ||
    statId.includes("damage_taken") ||
    statId.includes("resistance_shred") ||
    statId.includes("target_taken") ||
    statId.includes("resistance")
  ) {
    return "enemy";
  }

  if (
    statId === "armor" ||
    statId === "dodge_rating" ||
    statId === "block_chance" ||
    statId === "endurance" ||
    statId === "effective_health" ||
    statId === "less_damage_taken"
  ) {
    return "defense";
  }

  if (
    statId.includes("mana") ||
    statId.includes("ward") ||
    statId.includes("health_regen") ||
    statId.includes("movement_speed") ||
    statId.includes("cooldown") ||
    statId === "health"
  ) {
    return "resources";
  }

  if (["strength", "dexterity", "intelligence", "vitality", "attunement"].includes(statId)) {
    return "attributes";
  }

  if (
    statId.includes("chance") ||
    statId.includes("freeze") ||
    statId.includes("chill") ||
    statId.includes("shock") ||
    statId.includes("bleed") ||
    statId.includes("poison") ||
    statId.includes("ignite") ||
    statId.includes("stun")
  ) {
    return "ailments";
  }

  return "other";
}

function fmt(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString();
}

// ── Operation color helpers ────────────────────────────────────────────
const OP_COLORS: Record<string, { text: string; border: string; bg: string; label: string }> = {
  base: {
    text: "text-slate-300",
    border: "border-slate-600",
    bg: "bg-slate-700/40",
    label: "Base",
  },
  add: {
    text: "text-emerald-300",
    border: "border-emerald-700",
    bg: "bg-emerald-900/30",
    label: "Added",
  },
  increased: {
    text: "text-sky-300",
    border: "border-sky-700",
    bg: "bg-sky-900/30",
    label: "Increased",
  },
  more: {
    text: "text-fuchsia-300",
    border: "border-fuchsia-700",
    bg: "bg-fuchsia-900/30",
    label: "More",
  },
};

// ── Source grouping ────────────────────────────────────────────────────
type SourceGroup = "Items" | "Skills" | "Passives" | "Other";
const SOURCE_GROUP_ORDER: SourceGroup[] = ["Items", "Skills", "Passives", "Other"];
const SOURCE_GROUP_ICONS: Record<SourceGroup, string> = {
  Items: "🗡️",
  Skills: "✨",
  Passives: "🌀",
  Other: "📋",
};

function getSourceGroup(sourceType: string): SourceGroup {
  if (
    sourceType === "item" ||
    sourceType === "implicit" ||
    sourceType === "affix" ||
    sourceType === "unique" ||
    sourceType === "idol"
  )
    return "Items";
  if (sourceType === "skill" || sourceType === "skillNode") return "Skills";
  if (sourceType === "passive") return "Passives";
  return "Other";
}

// ── Source name resolution ─────────────────────────────────────────────
const _gameData = getGameData();

/** Build lookup maps once for fast name resolution. */
const _itemBaseNames = new Map(_gameData.itemBases.map((b) => [b.id, b.name]));
const _idolNames = new Map(_gameData.idols.map((i) => [i.id, i.name]));
const _passiveNodeNames = new Map(
  _gameData.passiveTrees.flatMap((t) => t.nodes.map((n) => [n.id, n.name])),
);
const _skillNodeNames = new Map(
  _gameData.skills.flatMap((s) => s.tree.nodes.map((n) => [n.id, `${s.name} — ${n.name}`])),
);
const _affixNames = new Map(_gameData.affixes.map((a) => [a.id, a.name]));

function resolveSourceName(sourceType: string, sourceId: string, sourceName: string): string {
  // Unique items: sourceId = "unique-{id}"
  const uniqueMatch = sourceId.match(/^unique-(\d+)$/);
  if (uniqueMatch) {
    const uid = Number(uniqueMatch[1]!);
    const def = getUniqueItem(uid);
    if (def) return def.name;
  }

  // Passive nodes
  if (sourceType === "passive") {
    const nodeName = _passiveNodeNames.get(sourceId);
    if (nodeName) return nodeName;
  }

  // Skill nodes
  if (sourceType === "skill" || sourceType === "skillNode") {
    const nodeName = _skillNodeNames.get(sourceId);
    if (nodeName) return nodeName;
  }

  // Base class stats
  if (sourceType === "base") {
    return formatStat(sourceId);
  }

  // Idol affixes from maxroll import: sourceName like "idol:377-affix-242-t1"
  const idolAffixMatch = sourceName.match(/^idol:\d+-affix-(\d+)-t\d+/);
  if (idolAffixMatch) {
    const idolName = _idolNames.get(sourceId) ?? _itemBaseNames.get(sourceId);
    const affixName = _affixNames.get(`affix-${idolAffixMatch[1]!}`);
    if (idolName && affixName) return `${idolName} — ${affixName}`;
    if (affixName) return affixName;
  }

  // Affixes on items: sourceName like "affix-{id}-t{tier}" or with "-x{n}" suffix
  const affixMatch = sourceName.match(/^(affix-\d+)-t\d+/);
  if (affixMatch) {
    const itemName = _itemBaseNames.get(sourceId);
    const affixName = _affixNames.get(affixMatch[1]!);
    if (itemName && affixName) return `${itemName} — ${affixName}`;
    if (affixName) return affixName;
  }

  // Idol implicit modifiers (standard idol path)
  if (sourceType === "idol") {
    const idolName = _idolNames.get(sourceId) ?? _itemBaseNames.get(sourceId);
    if (idolName) return idolName;
  }

  // Item implicits: sourceName like "{baseId}-impl-{stat}"
  if (sourceType === "implicit") {
    const itemName = _itemBaseNames.get(sourceId);
    if (itemName) return itemName;
  }

  // Item base fallback
  const itemName = _itemBaseNames.get(sourceId);
  if (itemName) return itemName;

  // Fallback: try to make the sourceName more readable
  return sourceName || sourceId;
}

// ── Contribution bar ───────────────────────────────────────────────────
function ContributionBar({ row }: { row: StatBreakdown }) {
  const total =
    Math.abs(row.base) + Math.abs(row.added) + Math.abs(row.increased) + Math.abs(row.more);
  if (total === 0) return null;

  const segments = [
    { key: "base", value: Math.abs(row.base), color: "bg-slate-500" },
    { key: "add", value: Math.abs(row.added), color: "bg-emerald-500" },
    { key: "increased", value: Math.abs(row.increased), color: "bg-sky-500" },
    { key: "more", value: Math.abs(row.more), color: "bg-fuchsia-500" },
  ].filter((s) => s.value > 0);

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      {segments.map((s) => (
        <div
          key={s.key}
          className={`${s.color} opacity-70`}
          style={{ width: `${(s.value / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────
function DetailPanel({ row, delta }: { row: StatBreakdown; delta: number | undefined }) {
  const [expandedGroups, setExpandedGroups] = useState<Set<SourceGroup>>(new Set());
  const [showRaw, setShowRaw] = useState(false);

  const afterAdd = row.base + row.added;
  const afterIncreased = afterAdd * (1 + row.increased / 100);

  // Group sources
  const grouped = useMemo(() => {
    const groups: Record<SourceGroup, typeof row.sources> = {
      Items: [],
      Skills: [],
      Passives: [],
      Other: [],
    };
    for (const s of row.sources) {
      groups[getSourceGroup(s.sourceType)].push(s);
    }
    return groups;
  }, [row.sources]);

  const toggleGroup = (g: SourceGroup) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Headline */}
      <div>
        <h2 className="text-lg font-semibold text-slate-100">{formatStat(row.statId)}</h2>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="text-3xl font-bold text-amber-300">{fmt(row.final)}</span>
          {delta !== undefined && delta !== 0 && (
            <span
              className={`text-sm font-semibold ${delta > 0 ? "text-green-400" : "text-red-400"}`}
            >
              {delta > 0 ? "▲" : "▼"} {delta > 0 ? "+" : ""}
              {fmt(delta)}
            </span>
          )}
        </div>
        <div className="mt-2">
          <ContributionBar row={row} />
        </div>
      </div>

      {/* Calculation Pipeline */}
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Calculation Pipeline
        </h3>
        <div className="space-y-1.5">
          {[
            { op: "base", label: "Base", value: row.base, suffix: "" },
            { op: "add", label: "+ Added", value: row.added, suffix: "" },
            { op: "increased", label: "× Increased", value: row.increased, suffix: "%" },
            { op: "more", label: "× More", value: row.more, suffix: "%" },
          ].map((step) => (
            <div key={step.op} className="flex items-center justify-between">
              <span className={`text-sm ${OP_COLORS[step.op]?.text ?? "text-slate-300"}`}>
                {step.label}
              </span>
              <span className={`font-mono text-sm ${OP_COLORS[step.op]?.text ?? "text-slate-300"}`}>
                {fmt(step.value)}
                {step.suffix}
              </span>
            </div>
          ))}
          <div className="border-t border-slate-700/60 pt-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-amber-300">= Final</span>
              <span className="font-mono text-sm font-semibold text-amber-300">
                {fmt(row.final)}
              </span>
            </div>
          </div>
        </div>

        {/* Raw calculation toggle */}
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="mt-2 text-[10px] text-slate-500 hover:text-slate-300"
        >
          {showRaw ? "▾ Hide raw calculation" : "▸ Show raw calculation"}
        </button>
        {showRaw && (
          <div className="mt-1 rounded border border-slate-800 bg-slate-950/60 p-2 font-mono text-[11px] text-slate-400">
            <div>(base + added) = {fmt(afterAdd)}</div>
            <div>after increased = {fmt(afterIncreased)}</div>
            <div>final = {fmt(row.final)}</div>
          </div>
        )}
      </div>

      {/* Sources */}
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Sources
        </h3>
        {row.sources.length === 0 ? (
          <p className="text-xs italic text-slate-500">
            No direct modifier sources (derived or baseline stat).
          </p>
        ) : (
          <div className="space-y-1">
            {SOURCE_GROUP_ORDER.map((group) => {
              const sources = grouped[group];
              if (sources.length === 0) return null;
              const isExpanded = expandedGroups.has(group);
              return (
                <div key={group}>
                  <button
                    onClick={() => toggleGroup(group)}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-xs hover:bg-slate-800/60"
                  >
                    <span className="text-slate-300">
                      {SOURCE_GROUP_ICONS[group]} {group}
                    </span>
                    <span className="text-slate-500">
                      {isExpanded ? "▾" : "▸"} {sources.length}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-0.5 space-y-0.5">
                      {sources.map((s, idx) => (
                        <div
                          key={`${s.sourceId}-${idx}`}
                          className="flex items-center justify-between rounded px-2 py-0.5 text-xs"
                        >
                          <span
                            className="truncate text-slate-400"
                            title={`${s.sourceType}: ${s.sourceId}`}
                          >
                            {resolveSourceName(s.sourceType, s.sourceId, s.sourceName)}
                          </span>
                          <span
                            className={`shrink-0 ml-2 font-mono ${OP_COLORS[s.operation]?.text ?? "text-slate-300"}`}
                          >
                            {s.operation === "add" ? "+" : s.operation === "increased" ? "%" : "×"}
                            {fmt(s.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────
export default function CalculationsPanel() {
  const snapshot = useBuildStore((s) => s.snapshot);
  const previewDelta = useBuildStore((s) => s.previewDelta);
  const [query, setQuery] = useState("");
  const [selectedStat, setSelectedStat] = useState<string | null>(null);

  const deltaMap = useMemo(() => {
    const map = new Map<string, number>();
    if (previewDelta) {
      for (const d of previewDelta) map.set(d.statId, d.diff);
    }
    return map;
  }, [previewDelta]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = [...snapshot.breakdowns]
      .filter((b) => {
        if (!q) return true;
        return b.statId.toLowerCase().includes(q) || formatStat(b.statId).toLowerCase().includes(q);
      })
      .sort((a, b) => a.statId.localeCompare(b.statId));

    const byGroup: Record<GroupId, typeof filtered> = {
      offense: [],
      enemy: [],
      defense: [],
      resources: [],
      attributes: [],
      ailments: [],
      other: [],
    };

    for (const row of filtered) {
      byGroup[getGroup(row.statId)].push(row);
    }

    return byGroup;
  }, [snapshot.breakdowns, query]);

  // Find the selected breakdown
  const selectedRow = useMemo(() => {
    if (!selectedStat) return null;
    return snapshot.breakdowns.find((b) => b.statId === selectedStat) ?? null;
  }, [snapshot.breakdowns, selectedStat]);

  return (
    <div className="flex h-full gap-0">
      {/* ── Left panel: stat list ────────────────────────────── */}
      <div className="flex w-64 shrink-0 flex-col border-r border-slate-700/60">
        {/* Search */}
        <div className="border-b border-slate-700/60 p-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Search stats..."
            className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500"
          />
        </div>

        {/* Stat groups */}
        <div className="flex-1 overflow-y-auto">
          {GROUP_ORDER.map((groupId) => {
            const rows = grouped[groupId];
            if (rows.length === 0) return null;

            return (
              <div key={groupId} className="border-b border-slate-800/60">
                <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
                  <span className="text-xs">{GROUP_ICONS[groupId]}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {GROUP_LABELS[groupId]}
                  </span>
                </div>
                {rows.map((row) => {
                  const delta = deltaMap.get(row.statId);
                  const isSelected = selectedStat === row.statId;
                  return (
                    <button
                      key={row.statId}
                      onClick={() => setSelectedStat(row.statId)}
                      className={`flex w-full items-center justify-between px-3 py-1 text-left text-xs transition-colors hover:bg-slate-800/60 ${
                        isSelected ? "bg-slate-800 text-slate-100" : "text-slate-300"
                      }`}
                    >
                      <span className="truncate">{formatStat(row.statId)}</span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="font-mono text-slate-200">{fmt(row.final)}</span>
                        {delta !== undefined && delta !== 0 && (
                          <span
                            className={`font-mono text-[10px] ${delta > 0 ? "text-green-400" : "text-red-400"}`}
                          >
                            {delta > 0 ? "+" : ""}
                            {fmt(delta)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right panel: detail ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedRow ? (
          <DetailPanel row={selectedRow} delta={deltaMap.get(selectedStat!)} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-500">
              Select a stat from the left to see its breakdown
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
