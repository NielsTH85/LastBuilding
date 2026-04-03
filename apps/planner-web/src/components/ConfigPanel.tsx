import { useState, useCallback } from "react";
import { useBuildStore } from "../store/useBuildStore";
import { STAT_IDS } from "@eob/game-data";
import type { SimulationConfig } from "@eob/build-model";

// ── Types ──────────────────────────────────────────────

interface ToggleDef {
  key: keyof SimulationConfig;
  label: string;
  tooltip?: string;
}

interface NumberDef {
  key: keyof SimulationConfig;
  label: string;
  min: number;
  max: number;
  tooltip?: string;
}

// ── Section Definitions ────────────────────────────────

const DAMAGE_TYPES = ["physical", "fire", "cold", "lightning", "necrotic", "void", "poison"];

const DAMAGE_TYPE_COLORS: Record<string, string> = {
  physical: "text-slate-300",
  fire: "text-red-400",
  cold: "text-blue-400",
  lightning: "text-yellow-300",
  necrotic: "text-purple-400",
  void: "text-violet-400",
  poison: "text-green-400",
};

const ENEMY_CONDITIONS: ToggleDef[] = [
  { key: "enemyIsShocked", label: "Is the enemy Shocked?", tooltip: "Enables conditional bonuses against shocked enemies" },
  { key: "enemyIsChilled", label: "Is the enemy Chilled?", tooltip: "Enables conditional bonuses against chilled enemies" },
  { key: "enemyIsIgnited", label: "Is the enemy Ignited?", tooltip: "Enables conditional bonuses against ignited enemies" },
  { key: "enemyIsPoisoned", label: "Is the enemy Poisoned?", tooltip: "Enables conditional bonuses against poisoned enemies" },
  { key: "enemyIsBleeding", label: "Is the enemy Bleeding?", tooltip: "Enables conditional bonuses against bleeding enemies" },
  { key: "enemyIsSlowed", label: "Is the enemy Slowed?", tooltip: "Enables conditional bonuses against slowed enemies" },
  { key: "enemyIsStunned", label: "Is the enemy Stunned?", tooltip: "Enables conditional bonuses against stunned enemies" },
];

const ENEMY_NUMBERS: NumberDef[] = [
  { key: "enemyArmorShredStacks", label: "Enemy Armor Shred Stacks", min: 0, max: 100 },
];

const PLAYER_CONDITIONS: ToggleDef[] = [
  { key: "playerAtFullHealth", label: "Are you at full health?", tooltip: "Enables bonuses conditional on being at full health" },
  { key: "playerHasWard", label: "Do you have Ward?", tooltip: "Enables bonuses conditional on having ward" },
  { key: "playerRecentlyUsedPotion", label: "Did you recently use a potion?", tooltip: "Enables bonuses after potion use" },
  { key: "playerRecentlyKilled", label: "Did you recently kill an enemy?", tooltip: "Enables on-kill bonuses" },
  { key: "playerRecentlyBeenHit", label: "Have you recently been hit?", tooltip: "Enables bonuses after taking a hit" },
];

const PLAYER_NUMBERS: NumberDef[] = [
  { key: "playerMinionCount", label: "Number of Minions", min: 0, max: 30 },
];

// ── Toggle Row ─────────────────────────────────────────

function ToggleRow({
  def,
  checked,
  onChange,
}: {
  def: ToggleDef;
  checked: boolean;
  onChange: (key: string, value: boolean) => void;
}) {
  return (
    <label
      className="flex cursor-pointer items-center justify-between py-1 text-xs hover:bg-slate-800/40 px-1 rounded"
      title={def.tooltip}
    >
      <span className="text-slate-300">{def.label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(def.key, e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-500 bg-slate-800 accent-amber-500"
      />
    </label>
  );
}

// ── Number Row ─────────────────────────────────────────

function NumberRow({
  def,
  value,
  onChange,
}: {
  def: NumberDef;
  value: number;
  onChange: (key: string, value: number) => void;
}) {
  return (
    <div
      className="flex items-center justify-between py-1 text-xs px-1"
      title={def.tooltip}
    >
      <label className="text-slate-300">{def.label}</label>
      <input
        type="number"
        min={def.min}
        max={def.max}
        value={value}
        onChange={(e) => onChange(def.key, Number(e.target.value || 0))}
        className="w-16 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-right text-slate-100"
      />
    </div>
  );
}

// ── Section Wrapper ────────────────────────────────────

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded border border-slate-700 bg-slate-900/60 mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
      >
        <span>{title}</span>
        <span className="text-[10px]">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="border-t border-slate-700/50 px-3 py-2">{children}</div>}
    </div>
  );
}

// ── Custom Modifiers ───────────────────────────────────

const OPERATIONS = [
  { value: "add", label: "+" },
  { value: "increased", label: "% increased" },
  { value: "more", label: "% more" },
];

function CustomModifiersSection({
  modifiers,
  onChange,
}: {
  modifiers: { targetStat: string; operation: string; value: number }[];
  onChange: (mods: { targetStat: string; operation: string; value: number }[]) => void;
}) {
  const [stat, setStat] = useState("");
  const [op, setOp] = useState("add");
  const [val, setVal] = useState(0);

  function handleAdd() {
    if (!stat) return;
    onChange([...modifiers, { targetStat: stat, operation: op, value: val }]);
    setStat("");
    setOp("add");
    setVal(0);
  }

  function handleRemove(index: number) {
    onChange(modifiers.filter((_, i) => i !== index));
  }

  return (
    <div>
      {modifiers.length > 0 && (
        <div className="mb-2 space-y-1">
          {modifiers.map((m, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded bg-slate-800/60 px-2 py-1 text-xs"
            >
              <span className="text-amber-300">
                {m.operation === "add" ? "+" : ""}
                {m.value}
                {m.operation !== "add" ? "%" : ""}{" "}
                {m.operation !== "add" ? `${m.operation} ` : ""}
                {m.targetStat.replace(/_/g, " ")}
              </span>
              <button
                onClick={() => handleRemove(i)}
                className="text-red-400 hover:text-red-300 text-[10px]"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex gap-1">
          <input
            type="number"
            value={val}
            onChange={(e) => setVal(Number(e.target.value || 0))}
            className="w-16 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
            placeholder="Value"
          />
          <select
            value={op}
            onChange={(e) => setOp(e.target.value)}
            className="rounded border border-slate-600 bg-slate-800 px-1 py-1 text-xs text-slate-300"
          >
            {OPERATIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <select
          value={stat}
          onChange={(e) => setStat(e.target.value)}
          className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-300"
        >
          <option value="">Select stat…</option>
          {STAT_IDS.map((id) => (
            <option key={id} value={id}>
              {id.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={!stat}
          className="w-full rounded bg-amber-600/20 px-3 py-1 text-xs font-medium text-amber-300 hover:bg-amber-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add Modifier
        </button>
      </div>
    </div>
  );
}

// ── Main Config Panel ──────────────────────────────────

export default function ConfigPanel() {
  const config = useBuildStore((s) => s.build.config);
  const setEnemyLevel = useBuildStore((s) => s.setEnemyLevel);
  const setEnemyResistance = useBuildStore((s) => s.setEnemyResistance);
  const setConfigToggle = useBuildStore((s) => s.setConfigToggle);
  const setConfigNumber = useBuildStore((s) => s.setConfigNumber);
  const setCustomModifiers = useBuildStore((s) => s.setCustomModifiers);

  const handleToggle = useCallback(
    (key: string, value: boolean) => setConfigToggle(key, value),
    [setConfigToggle],
  );

  const handleNumber = useCallback(
    (key: string, value: number) => setConfigNumber(key, value),
    [setConfigNumber],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-0">
      <h2 className="mb-4 text-lg font-bold text-amber-400">Configuration</h2>

      {/* Enemy Stats */}
      <Section title="Enemy Stats">
        <div className="mb-3 flex items-center justify-between py-1 text-xs px-1">
          <label className="text-slate-300">Enemy Level</label>
          <input
            type="number"
            min={1}
            max={100}
            value={config.enemyLevel}
            onChange={(e) => setEnemyLevel(Number(e.target.value || 1))}
            className="w-16 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-right text-slate-100"
          />
        </div>

        <div className="mb-2 mt-1 px-1">
          <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">
            Enemy Resistances
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {DAMAGE_TYPES.map((type) => (
              <div key={type} className="flex items-center justify-between text-xs">
                <span className={`capitalize ${DAMAGE_TYPE_COLORS[type]}`}>{type}</span>
                <input
                  type="number"
                  min={-100}
                  max={100}
                  value={config.enemyResistances?.[type] ?? 0}
                  onChange={(e) => setEnemyResistance(type, Number(e.target.value || 0))}
                  className="w-14 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-right text-xs text-slate-100"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 border-t border-slate-700/40 pt-2 px-1">
          <ToggleRow
            def={{ key: "enemyIsBoss", label: "Is the enemy a Boss?" }}
            checked={!!config.enemyIsBoss}
            onChange={handleToggle}
          />
        </div>

        {ENEMY_NUMBERS.map((def) => (
          <NumberRow
            key={def.key}
            def={def}
            value={(config[def.key] as number) ?? 0}
            onChange={handleNumber}
          />
        ))}
      </Section>

      {/* Enemy Ailment Conditions */}
      <Section title="Enemy Conditions">
        <div className="mb-1 text-[10px] text-slate-500">
          Toggle which ailments are active on the enemy. This enables conditional damage bonuses
          from your passives, skills, and equipment.
        </div>
        {ENEMY_CONDITIONS.map((def) => (
          <ToggleRow
            key={def.key}
            def={def}
            checked={!!(config[def.key])}
            onChange={handleToggle}
          />
        ))}
      </Section>

      {/* Player Combat State */}
      <Section title="Player Combat State">
        <div className="mb-1 text-[10px] text-slate-500">
          Set your assumed combat state for conditional calculations.
        </div>
        {PLAYER_CONDITIONS.map((def) => (
          <ToggleRow
            key={def.key}
            def={def}
            checked={!!(config[def.key])}
            onChange={handleToggle}
          />
        ))}
        {PLAYER_NUMBERS.map((def) => (
          <NumberRow
            key={def.key}
            def={def}
            value={(config[def.key] as number) ?? 0}
            onChange={handleNumber}
          />
        ))}
      </Section>

      {/* Custom Modifiers */}
      <Section title="Custom Modifiers">
        <div className="mb-2 text-[10px] text-slate-500">
          Add arbitrary stat modifiers for testing. These are injected directly into the calculation
          engine.
        </div>
        <CustomModifiersSection
          modifiers={config.customModifiers ?? []}
          onChange={setCustomModifiers}
        />
      </Section>
    </div>
  );
}
