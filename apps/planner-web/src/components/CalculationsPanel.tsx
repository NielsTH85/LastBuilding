import { useMemo, useState } from "react";
import { useBuildStore } from "../store/useBuildStore";

function formatStat(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type GroupId =
  | "offense"
  | "enemy"
  | "defense"
  | "resources"
  | "attributes"
  | "ailments"
  | "other";

const GROUP_ORDER: GroupId[] = [
  "offense",
  "enemy",
  "defense",
  "resources",
  "attributes",
  "ailments",
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

const GROUP_STYLES: Record<GroupId, string> = {
  offense: "border-amber-600/40",
  enemy: "border-fuchsia-600/40",
  defense: "border-sky-600/40",
  resources: "border-emerald-600/40",
  attributes: "border-violet-600/40",
  ailments: "border-orange-600/40",
  other: "border-slate-600/40",
};

function getGroup(statId: string): GroupId {
  if (
    statId.includes("expected_dps")
    || statId.includes("average_hit")
    || statId.includes("crit")
    || statId.includes("attack_speed")
    || statId.includes("cast_speed")
    || statId.includes("damage")
    || statId.includes("penetration")
    || statId.includes("dps_factor")
  ) {
    return "offense";
  }

  if (
    statId.startsWith("enemy_")
    || statId.includes("damage_taken")
    || statId.includes("resistance_shred")
    || statId.includes("target_taken")
    || statId.includes("resistance")
  ) {
    return "enemy";
  }

  if (
    statId === "armor"
    || statId === "dodge_rating"
    || statId === "block_chance"
    || statId === "endurance"
    || statId === "effective_health"
    || statId === "less_damage_taken"
  ) {
    return "defense";
  }

  if (
    statId.includes("mana")
    || statId.includes("ward")
    || statId.includes("health_regen")
    || statId.includes("movement_speed")
    || statId.includes("cooldown")
    || statId === "health"
  ) {
    return "resources";
  }

  if (["strength", "dexterity", "intelligence", "vitality", "attunement"].includes(statId)) {
    return "attributes";
  }

  if (
    statId.includes("chance")
    || statId.includes("freeze")
    || statId.includes("chill")
    || statId.includes("shock")
    || statId.includes("bleed")
    || statId.includes("poison")
    || statId.includes("ignite")
    || statId.includes("stun")
  ) {
    return "ailments";
  }

  return "other";
}

function statValueClass(statId: string, value: number): string {
  if (statId === "expected_dps" || statId === "average_hit") return "text-amber-300";

  if (statId.endsWith("_resistance")) {
    if (value >= 75) return "text-green-300";
    if (value >= 50) return "text-yellow-300";
    return "text-red-300";
  }

  if (statId === "health" || statId === "ward" || statId === "mana" || statId === "effective_health") {
    return "text-emerald-300";
  }

  if (statId === "armor" || statId === "dodge_rating" || statId === "block_chance" || statId === "endurance") {
    return "text-sky-300";
  }

  return "text-slate-100";
}

function fmt(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString();
}

export default function CalculationsPanel() {
  const snapshot = useBuildStore((s) => s.snapshot);
  const previewDelta = useBuildStore((s) => s.previewDelta);
  const [query, setQuery] = useState("");

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

  const totalRows = GROUP_ORDER.reduce((sum, g) => sum + grouped[g].length, 0);

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 rounded border border-slate-700 bg-slate-900/95 p-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stats (e.g. expected_dps, cast speed, armor)"
            className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500"
          />
          <span className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300">{totalRows} stats</span>
        </div>
      </div>

      {totalRows === 0 && (
        <p className="text-xs italic text-slate-500">No matching stat breakdowns.</p>
      )}

      <div className="columns-1 gap-3 lg:columns-2 xl:columns-3">
        {GROUP_ORDER.map((groupId) => {
          const rows = grouped[groupId];
          if (rows.length === 0) return null;

          return (
            <section
              key={groupId}
              className={`mb-3 inline-block w-full break-inside-avoid rounded border bg-slate-900/70 p-2 ${GROUP_STYLES[groupId]}`}
            >
              <div className="mb-2 flex items-center justify-between border-b border-slate-700/70 pb-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">{GROUP_LABELS[groupId]}</h3>
                <span className="text-[10px] text-slate-500">{rows.length}</span>
              </div>

              <div className="space-y-1">
                {rows.map((row) => {
                  const afterAdd = row.base + row.added;
                  const afterIncreased = afterAdd * (1 + row.increased / 100);
                  const finalFromStages = afterIncreased * (1 + row.more / 100);
                  const delta = deltaMap.get(row.statId);

                  return (
                    <div
                      key={row.statId}
                      className="group relative rounded border border-slate-800 bg-slate-950/60 px-2 py-1.5"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-slate-300" title={row.statId}>{formatStat(row.statId)}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono text-xs ${statValueClass(row.statId, row.final)}`}>{fmt(row.final)}</span>
                          {delta !== undefined && delta !== 0 && (
                            <span className={`font-mono text-[10px] ${delta > 0 ? "text-green-400" : "text-red-400"}`}>
                              {delta > 0 ? "+" : ""}{fmt(delta)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                        <span className="rounded border border-slate-700 px-1 text-slate-400" title="Base">b {fmt(row.base)}</span>
                        <span className="rounded border border-emerald-800/60 px-1 text-emerald-300" title="Added">+ {fmt(row.added)}</span>
                        <span className="rounded border border-sky-800/60 px-1 text-sky-300" title="Increased %">i {fmt(row.increased)}%</span>
                        <span className="rounded border border-fuchsia-800/60 px-1 text-fuchsia-300" title="More %">m {fmt(row.more)}%</span>
                      </div>

                      <div className="pointer-events-none absolute left-2 right-2 top-full z-30 mt-1 hidden rounded border border-slate-600 bg-slate-950 p-2 text-xs shadow-xl group-hover:block">
                        <div className="mb-1 font-semibold text-slate-200">Calculation</div>
                        <div className="font-mono text-slate-300">base = {fmt(row.base)}</div>
                        <div className="font-mono text-slate-300">added = {fmt(row.added)}</div>
                        <div className="font-mono text-slate-300">increased% = {fmt(row.increased)}</div>
                        <div className="font-mono text-slate-300">more% = {fmt(row.more)}</div>
                        <div className="mt-1 font-mono text-slate-200">(base + added) = {fmt(afterAdd)}</div>
                        <div className="font-mono text-slate-200">after increased = {fmt(afterIncreased)}</div>
                        <div className="font-mono text-slate-200">after more = {fmt(finalFromStages)}</div>
                        <div className="font-mono text-amber-300">final = {fmt(row.final)}</div>

                        <div className="mt-2 mb-1 font-semibold text-slate-200">Sources</div>
                        {row.sources.length === 0 ? (
                          <div className="text-slate-500">No direct modifier sources (derived or baseline stat).</div>
                        ) : (
                          <div className="max-h-56 space-y-1 overflow-auto pr-1">
                            {row.sources.map((s, idx) => (
                              <div key={`${s.sourceType}-${s.sourceId}-${idx}`} className="rounded border border-slate-800 bg-slate-900/60 px-1.5 py-1">
                                <div className="font-mono text-slate-200">{s.operation}: {fmt(s.value)}</div>
                                <div className="text-slate-400">{s.sourceType} | {s.sourceName}</div>
                                <div className="text-slate-500">id: {s.sourceId}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
