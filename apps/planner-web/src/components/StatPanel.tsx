import { type ReactNode, useMemo, useState } from "react";
import { useBuildStore } from "../store/useBuildStore";
import { getGameData } from "@eob/game-data";

type Tab = "overview" | "offense" | "defense" | "sustain";

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "offense", label: "Offense" },
  { id: "defense", label: "Defense" },
  { id: "sustain", label: "Sustain" },
];

function getVal(obj: object, key: string): number {
  return (obj as unknown as Record<string, number>)[key] ?? 0;
}

function formatStat(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatRow({ label, value, delta }: { label: ReactNode; value: number; delta?: number }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className="text-slate-300">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-slate-100">{Math.round(value * 100) / 100}</span>
        {delta !== undefined && delta !== 0 && (
          <span className={`text-xs font-mono ${delta > 0 ? "text-green-400" : "text-red-400"}`}>
            {delta > 0 ? "+" : ""}{Math.round(delta * 100) / 100}
          </span>
        )}
      </span>
    </div>
  );
}

function LabelWithTooltip({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <span
        className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-slate-500 text-[9px] leading-none text-slate-400"
        title={tooltip}
        aria-label={`${label} formula info`}
      >
        ?
      </span>
    </span>
  );
}

export default function StatPanel() {
  const [tab, setTab] = useState<Tab>("overview");
  const snapshot = useBuildStore((s) => s.snapshot);
  const previewDelta = useBuildStore((s) => s.previewDelta);
  const buildConfig = useBuildStore((s) => s.build.config);
  const skills = useBuildStore((s) => s.build.skills);
  const activeSkillId = useBuildStore((s) => s.activeSkillId);
  const setActiveSkillId = useBuildStore((s) => s.setActiveSkillId);
  const setEnemyLevel = useBuildStore((s) => s.setEnemyLevel);
  const setEnemyResistance = useBuildStore((s) => s.setEnemyResistance);

  const gameData = useMemo(() => getGameData(), []);
  const skillOptions = useMemo(() => {
    return skills
      .filter((s) => s.allocatedNodes.length > 0)
      .map((s) => {
        const def = gameData.skills.find((sk) => sk.id === s.skillId);
        return { id: s.skillId, name: def?.name ?? s.skillId };
      });
  }, [skills, gameData]);

  const deltaMap = new Map<string, number>();
  if (previewDelta) {
    for (const d of previewDelta) {
      deltaMap.set(d.statId, d.diff);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Active skill selector */}
      {skillOptions.length > 0 && (
        <div className="border-b border-slate-700 px-2 py-1.5">
          <select
            className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
            value={activeSkillId ?? ""}
            onChange={(e) => setActiveSkillId(e.target.value || null)}
          >
            <option value="">All Skills (combined)</option>
            {skillOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {TAB_LABELS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-amber-400 text-amber-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {tab === "overview" && <OverviewTab stats={snapshot.stats} deltaMap={deltaMap} />}
        {tab === "offense" && (
          <OffenseTab
            snapshot={snapshot}
            deltaMap={deltaMap}
            config={buildConfig}
            onEnemyLevelChange={setEnemyLevel}
            onEnemyResistanceChange={setEnemyResistance}
          />
        )}
        {tab === "defense" && <DefenseTab snapshot={snapshot} deltaMap={deltaMap} />}
        {tab === "sustain" && <SustainTab snapshot={snapshot} deltaMap={deltaMap} />}
      </div>
    </div>
  );
}

const STAT_GROUPS: { label: string; keys: string[] }[] = [
  {
    label: "Attributes",
    keys: ["strength", "dexterity", "intelligence", "vitality", "attunement"],
  },
  {
    label: "Resources",
    keys: ["health", "mana", "effective_health"],
  },
  {
    label: "Regeneration",
    keys: ["health_regen", "mana_regen", "mana_cost", "mana_gain", "mana_efficiency"],
  },
  {
    label: "Damage",
    keys: [
      "damage", "increased_damage", "spell_damage", "increased_spell_damage",
      "increased_fire_damage", "increased_cold_damage", "increased_lightning_damage",
      "increased_elemental_damage", "increased_necrotic_damage", "increased_void_damage",
      "increased_poison_damage", "increased_physical_damage", "increased_throwing_damage",
      "increased_melee_damage", "increased_minion_damage", "increased_damage_over_time",
      "more_damage", "more_melee_damage", "more_spell_damage",
      "added_spell_lightning_damage", "added_spell_fire_damage", "added_spell_cold_damage",
      "melee_damage", "physical_damage", "throwing_damage", "minion_damage",
      "hit_damage", "damage_over_time",
    ],
  },
  {
    label: "Critical",
    keys: ["base_crit_chance", "crit_chance", "increased_crit_chance", "crit_multiplier"],
  },
  {
    label: "Speed",
    keys: ["attack_speed", "cast_speed", "movement_speed", "cooldown_recovery_speed"],
  },
  {
    label: "Penetration",
    keys: [
      "penetration_elemental", "penetration_lightning", "penetration_fire", "penetration_cold",
      "fire_penetration", "cold_penetration", "lightning_penetration",
      "physical_penetration", "necrotic_penetration", "void_penetration", "elemental_penetration",
    ],
  },
  {
    label: "Resistances",
    keys: [
      "fire_resistance", "cold_resistance", "lightning_resistance",
      "necrotic_resistance", "void_resistance", "poison_resistance", "physical_resistance",
    ],
  },
  {
    label: "Defense",
    keys: [
      "armor", "dodge_rating", "endurance", "endurance_threshold",
      "less_damage_taken", "block_chance",
    ],
  },
  {
    label: "Ward",
    keys: ["ward_retention", "ward_gained", "ward_generation", "ward_per_second"],
  },
  {
    label: "Ailments",
    keys: [
      "ailment_chance", "bleed_chance", "poison_chance", "ignite_chance",
      "shock_chance", "chill_chance", "freeze_rate_multiplier",
      "slow_chance", "armor_shred_chance", "increased_stun_chance",
    ],
  },
  {
    label: "Area",
    keys: ["area", "increased_area"],
  },
  {
    label: "Computed",
    keys: [
      "average_hit",
      "expected_dps",
      "dps_factor_speed",
      "dps_factor_cast",
      "dps_factor_hit_count",
      "dps_factor_penetration",
      "dps_factor_target_taken",
      "dps_factor_resistance",
      "dps_factor_increased_taken",
      "dps_factor_enemy_mitigation",
      "enemy_level_dr",
    ],
  },
];

const GROUPED_KEYS = new Set(STAT_GROUPS.flatMap((g) => g.keys));

function GroupHeader({ label }: { label: string }) {
  return (
    <div className="mt-2 mb-1 border-b border-slate-700/60 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 first:mt-0">
      {label}
    </div>
  );
}

function OverviewTab({ stats, deltaMap }: { stats: Record<string, number>; deltaMap: Map<string, number> }) {
  const entries = Object.entries(stats).filter(([, v]) => v !== 0);
  if (entries.length === 0) {
    return <p className="text-xs text-slate-500 italic">No stats yet. Allocate passives or equip items.</p>;
  }
  const statMap = new Map(entries);
  const ungrouped = entries.filter(([key]) => !GROUPED_KEYS.has(key));

  return (
    <div>
      {STAT_GROUPS.map((group) => {
        const rows = group.keys.filter((k) => statMap.has(k));
        if (rows.length === 0) return null;
        return (
          <div key={group.label}>
            <GroupHeader label={group.label} />
            {rows.map((key) => (
              <StatRow key={key} label={formatStat(key)} value={statMap.get(key)!} delta={deltaMap.get(key)} />
            ))}
          </div>
        );
      })}
      {ungrouped.length > 0 && (
        <div>
          <GroupHeader label="Other" />
          {ungrouped.map(([key, val]) => (
            <StatRow key={key} label={formatStat(key)} value={val} delta={deltaMap.get(key)} />
          ))}
        </div>
      )}
    </div>
  );
}

const DAMAGE_TYPES = ["physical", "fire", "cold", "lightning", "necrotic", "void", "poison"];

function OffenseTab({
  snapshot,
  deltaMap,
  config,
  onEnemyLevelChange,
  onEnemyResistanceChange,
}: {
  snapshot: Pick<import("@eob/build-model").BuildSnapshot, "offensive" | "stats">;
  deltaMap: Map<string, number>;
  config: import("@eob/build-model").SimulationConfig;
  onEnemyLevelChange: (enemyLevel: number) => void;
  onEnemyResistanceChange: (damageType: string, resistance: number) => void;
}) {
  const rows: [string, string][] = [
    ["averageHit", "average_hit"],
    ["critChance", "crit_chance"],
    ["critMultiplier", "crit_multiplier"],
    ["castSpeed", "cast_speed"],
    ["attackSpeed", "attack_speed"],
    ["expectedDps", "expected_dps"],
    ["spellDamage", "spell_damage"],
    ["increasedSpellDamage", "increased_spell_damage"],
    ["increasedElementalDamage", "increased_elemental_damage"],
  ];

  const averageHit = snapshot.stats.average_hit ?? 0;
  const speedFactor = snapshot.stats.dps_factor_speed ?? 1;
  const castFactor = snapshot.stats.dps_factor_cast ?? 1;
  const hitCountFactor = snapshot.stats.dps_factor_hit_count ?? 1;
  const penetrationFactor = snapshot.stats.dps_factor_penetration ?? 1;
  const targetTakenFactor = snapshot.stats.dps_factor_target_taken ?? 1;
  const resistanceFactor = snapshot.stats.dps_factor_resistance ?? 1;
  const increasedTakenFactor = snapshot.stats.dps_factor_increased_taken ?? 1;
  const enemyMitigationFactor = snapshot.stats.dps_factor_enemy_mitigation ?? 1;
  const reconstructedDps =
    averageHit
    * speedFactor
    * castFactor
    * hitCountFactor
    * penetrationFactor
    * targetTakenFactor
    * resistanceFactor
    * increasedTakenFactor
    * enemyMitigationFactor;

  return (
    <div className="space-y-3">
      <div className="rounded border border-slate-700 bg-slate-900/60 p-2">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Enemy Assumptions</div>
        <div className="mb-2 grid grid-cols-2 items-center gap-2 text-xs">
          <label className="text-slate-300">Enemy Level</label>
          <input
            type="number"
            min={1}
            max={100}
            value={config.enemyLevel}
            onChange={(e) => onEnemyLevelChange(Number(e.target.value || 1))}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {DAMAGE_TYPES.map((type) => (
            <div key={type} className="grid grid-cols-2 items-center gap-2">
              <label className="capitalize text-slate-300">{type}</label>
              <input
                type="number"
                min={-100}
                max={100}
                value={config.enemyResistances?.[type] ?? 0}
                onChange={(e) => onEnemyResistanceChange(type, Number(e.target.value || 0))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded border border-slate-700 bg-slate-900/60 p-2">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Offense Summary</div>
        <div className="space-y-0.5">
          {rows.map(([key, statId]) => (
            <StatRow
              key={key}
              label={formatStat(statId)}
              value={getVal(snapshot.offensive, key)}
              delta={deltaMap.get(statId)}
            />
          ))}
        </div>
      </div>

      <div className="rounded border border-slate-700 bg-slate-900/60 p-2">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Damage Model Breakdown</div>
        <div className="space-y-0.5">
          <StatRow
            label={<LabelWithTooltip label="Average Hit" tooltip="Expected hit damage after base, added damage, increased/more modifiers, and crit expectation." />}
            value={averageHit}
            delta={deltaMap.get("average_hit")}
          />
          <StatRow
            label={<LabelWithTooltip label="Speed Factor" tooltip="Base hits per second multiplied by attack/cast speed scaling for the active skill profile." />}
            value={speedFactor}
            delta={deltaMap.get("dps_factor_speed")}
          />
          <StatRow
            label={<LabelWithTooltip label="Cast Factor" tooltip="Extra casts per action from skill mechanics (multicast, repeats, channels) in active-skill mode." />}
            value={castFactor}
            delta={deltaMap.get("dps_factor_cast")}
          />
          <StatRow
            label={<LabelWithTooltip label="Hit Count Factor" tooltip="Average number of hits per cast from chain, fork, and other multi-hit behavior." />}
            value={hitCountFactor}
            delta={deltaMap.get("dps_factor_hit_count")}
          />
          <StatRow
            label={<LabelWithTooltip label="Penetration Factor" tooltip="Multiplier from penetration and similar resistance-bypass effects applied for the dominant damage type." />}
            value={penetrationFactor}
            delta={deltaMap.get("dps_factor_penetration")}
          />
          <StatRow
            label={<LabelWithTooltip label="Target Taken Factor" tooltip="Target-side damage taken multipliers from skill conditions (for example shocked or skill-specific taken effects)." />}
            value={targetTakenFactor}
            delta={deltaMap.get("dps_factor_target_taken")}
          />
          <StatRow
            label={<LabelWithTooltip label="Resistance Factor" tooltip="Computed from enemy configured resistance minus penetration/shred, converted as max(0.1, 1 - res/100)." />}
            value={resistanceFactor}
            delta={deltaMap.get("dps_factor_resistance")}
          />
          <StatRow
            label={<LabelWithTooltip label="Increased Damage Taken Factor" tooltip="Generic plus type-specific increased damage taken on the enemy, converted to 1 + taken/100." />}
            value={increasedTakenFactor}
            delta={deltaMap.get("dps_factor_increased_taken")}
          />
          <StatRow
            label={<LabelWithTooltip label="Enemy Mitigation Factor" tooltip="Enemy level DR factor using the configured enemy level, where level 100 corresponds to 87% DR before clamping." />}
            value={enemyMitigationFactor}
            delta={deltaMap.get("dps_factor_enemy_mitigation")}
          />
          <StatRow
            label={<LabelWithTooltip label="Enemy Level DR %" tooltip="Raw enemy damage reduction percentage derived from enemy level assumption." />}
            value={snapshot.stats.enemy_level_dr ?? 0}
            delta={deltaMap.get("enemy_level_dr")}
          />
          <StatRow
            label={<LabelWithTooltip label="Reconstructed DPS" tooltip="Average Hit multiplied by all factors shown above." />}
            value={reconstructedDps}
          />
          <StatRow
            label={<LabelWithTooltip label="Expected DPS" tooltip="Final engine expected DPS for the selected active skill context." />}
            value={snapshot.offensive.expectedDps}
            delta={deltaMap.get("expected_dps")}
          />
        </div>
      </div>
    </div>
  );
}

function DefenseTab({
  snapshot,
  deltaMap,
}: {
  snapshot: Pick<import("@eob/build-model").BuildSnapshot, "defensive">;
  deltaMap: Map<string, number>;
}) {
  const rows: [string, string][] = [
    ["health", "health"],
    ["ward", "ward"],
    ["effectiveHealth", "effective_health"],
    ["armor", "armor"],
    ["dodgeRating", "dodge_rating"],
    ["blockChance", "block_chance"],
    ["endurance", "endurance"],
    ["fireResistance", "fire_resistance"],
    ["coldResistance", "cold_resistance"],
    ["lightningResistance", "lightning_resistance"],
    ["necroticResistance", "necrotic_resistance"],
    ["voidResistance", "void_resistance"],
    ["poisonResistance", "poison_resistance"],
  ];
  return (
    <div className="space-y-0.5">
      {rows.map(([key, statId]) => (
        <StatRow
          key={key}
          label={formatStat(statId)}
          value={getVal(snapshot.defensive, key)}
          delta={deltaMap.get(statId)}
        />
      ))}
    </div>
  );
}

function SustainTab({
  snapshot,
  deltaMap,
}: {
  snapshot: Pick<import("@eob/build-model").BuildSnapshot, "sustain">;
  deltaMap: Map<string, number>;
}) {
  const rows: [string, string][] = [
    ["mana", "mana"],
    ["manaRegen", "mana_regen"],
    ["healthRegen", "health_regen"],
    ["wardRetention", "ward_retention"],
    ["movementSpeed", "movement_speed"],
  ];
  return (
    <div className="space-y-0.5">
      {rows.map(([key, statId]) => (
        <StatRow
          key={key}
          label={formatStat(statId)}
          value={getVal(snapshot.sustain, key)}
          delta={deltaMap.get(statId)}
        />
      ))}
    </div>
  );
}

