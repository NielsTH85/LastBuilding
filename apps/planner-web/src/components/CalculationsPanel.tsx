import { useEffect, useMemo, useState } from "react";
import { useBuildStore } from "../store/useBuildStore";
import type { StatBreakdown } from "@eob/build-model";
import { getGameData, getUniqueItem } from "@eob/game-data";

function formatStat(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type GroupId = "offense" | "enemy" | "defense" | "resources" | "attributes" | "ailments" | "other";
type Importance = "core" | "secondary" | "advanced";

const CORE_STAT_IDS = new Set([
  "armor",
  "health",
  "ward",
  "effective_health",
  "average_hit",
  "cast_speed",
  "crit_chance",
  "expected_dps",
  "mana_regen",
]);

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

function getImportance(statId: string): Importance {
  if (CORE_STAT_IDS.has(statId)) return "core";

  if (
    statId.includes("dps_factor") ||
    statId.startsWith("enemy_") ||
    statId.includes("_estimate") ||
    statId.includes("raw") ||
    statId.includes("_debug")
  ) {
    return "advanced";
  }

  const group = getGroup(statId);
  if (group === "attributes" || group === "resources" || group === "defense" || group === "offense") {
    return "secondary";
  }

  return "advanced";
}

function fmt(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString();
}

function fmtSigned(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${fmt(value)}`;
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

// ── Detail panel ───────────────────────────────────────────────────────
function DetailPanel({ row, delta }: { row: StatBreakdown; delta: number | undefined }) {
  const [expandedGroups, setExpandedGroups] = useState<Set<SourceGroup>>(
    new Set(["Items", "Skills"]),
  );
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

  const groupedAgg = useMemo(() => {
    const result = new Map<SourceGroup, Array<{ name: string; total: number }>>();
    for (const group of SOURCE_GROUP_ORDER) {
      const byName = new Map<string, number>();
      for (const s of grouped[group]) {
        const name = resolveSourceName(s.sourceType, s.sourceId, s.sourceName);
        byName.set(name, (byName.get(name) ?? 0) + s.value);
      }
      const rows = [...byName.entries()]
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
      result.set(group, rows);
    }
    return result;
  }, [grouped]);

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
              {fmtSigned(delta)}
            </span>
          )}
        </div>
      </div>

      {/* Calculation Pipeline */}
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Breakdown
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
              const agg = groupedAgg.get(group) ?? [];
              if (sources.length === 0) return null;
              const isExpanded = expandedGroups.has(group);
              const groupTotal = sources.reduce((sum, s) => sum + s.value, 0);
              return (
                <div key={group}>
                  <button
                    onClick={() => toggleGroup(group)}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-xs hover:bg-slate-800/60"
                  >
                    <span className="text-slate-300">
                      {SOURCE_GROUP_ICONS[group]} {group} ({agg.length})
                    </span>
                    <span className="font-mono text-slate-500">
                      {isExpanded ? "▾" : "▸"} {fmtSigned(groupTotal)}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-0.5 space-y-0.5">
                      {agg.map((s, idx) => (
                        <div
                          key={`${s.name}-${idx}`}
                          className="flex items-center justify-between rounded px-2 py-0.5 text-xs"
                        >
                          <span className="truncate text-slate-400">{s.name}</span>
                          <span className="shrink-0 ml-2 font-mono text-emerald-300">
                            {fmtSigned(s.total)}
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
  const skills = useBuildStore((s) => s.build.skills);
  const activeSkillId = useBuildStore((s) => s.activeSkillId);
  const setActiveSkillId = useBuildStore((s) => s.setActiveSkillId);
  const [query, setQuery] = useState("");
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const gameData = useMemo(() => getGameData(), []);
  const skillOptions = useMemo(
    () =>
      skills.map((s) => {
        const def = gameData.skills.find((sk) => sk.id === s.skillId);
        return { id: s.skillId, name: def?.name ?? s.skillId };
      }),
    [skills, gameData],
  );

  useEffect(() => {
    if (skillOptions.length === 0) return;
    const hasActive = activeSkillId && skillOptions.some((s) => s.id === activeSkillId);
    if (!hasActive) setActiveSkillId(skillOptions[0]!.id);
  }, [activeSkillId, setActiveSkillId, skillOptions]);

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
        if (!showAdvanced && getImportance(b.statId) !== "core") return false;
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
  }, [snapshot.breakdowns, query, showAdvanced]);

  const summaryStats = useMemo(
    () => [
      { label: "DPS", statId: "expected_dps", value: snapshot.stats.expected_dps ?? 0 },
      { label: "EHP", statId: "effective_health", value: snapshot.stats.effective_health ?? 0 },
      { label: "Ward", statId: "ward", value: snapshot.stats.ward ?? 0 },
      { label: "Mana Regen", statId: "mana_regen", value: snapshot.stats.mana_regen ?? 0 },
    ],
    [snapshot.stats],
  );

  // Find the selected breakdown
  const selectedRow = useMemo(() => {
    if (!selectedStat) return null;
    return snapshot.breakdowns.find((b) => b.statId === selectedStat) ?? null;
  }, [snapshot.breakdowns, selectedStat]);

  return (
    <div className="flex h-full gap-0">
      {/* ── Left panel: stat list ────────────────────────────── */}
      <div className="flex w-64 shrink-0 flex-col border-r border-slate-700/60">
        {skillOptions.length > 0 && (
          <div className="border-b border-slate-700/60 p-2">
            <select
              className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
              value={activeSkillId ?? skillOptions[0]?.id ?? ""}
              onChange={(e) => setActiveSkillId(e.target.value)}
            >
              {skillOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search */}
        <div className="border-b border-slate-700/60 p-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Search stats..."
            className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500"
          />
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={showAdvanced}
              onChange={(e) => setShowAdvanced(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-500 bg-slate-800"
            />
            Show advanced stats
          </label>
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
        <div className="sticky top-0 z-10 mb-4 rounded-lg border border-slate-700/70 bg-slate-900/95 p-3 backdrop-blur">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Build Summary
          </div>
          <div className="grid grid-cols-2 gap-2">
            {summaryStats.map((s) => (
              <div key={s.statId} className="rounded border border-slate-700/50 bg-slate-800/50 px-2 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">{s.label}</div>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-mono text-sm text-amber-300">{fmt(s.value)}</div>
                  {deltaMap.get(s.statId) !== undefined && deltaMap.get(s.statId) !== 0 && (
                    <div
                      className={`text-[10px] font-mono ${
                        (deltaMap.get(s.statId) ?? 0) > 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {fmtSigned(deltaMap.get(s.statId) ?? 0)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
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
