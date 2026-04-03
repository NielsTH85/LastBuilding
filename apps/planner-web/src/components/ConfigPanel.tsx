import { useState, useCallback, useMemo } from "react";
import { useBuildStore } from "../store/useBuildStore";
import { STAT_IDS, getUniqueItem, getUniqueToggles, type UniqueSettingDef } from "@eob/game-data";
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
  {
    key: "enemyIsShocked",
    label: "Is the enemy Shocked?",
    tooltip: "Enables conditional bonuses against shocked enemies",
  },
  {
    key: "enemyIsChilled",
    label: "Is the enemy Chilled?",
    tooltip: "Enables conditional bonuses against chilled enemies",
  },
  {
    key: "enemyIsIgnited",
    label: "Is the enemy Ignited?",
    tooltip: "Enables conditional bonuses against ignited enemies",
  },
  {
    key: "enemyIsPoisoned",
    label: "Is the enemy Poisoned?",
    tooltip: "Enables conditional bonuses against poisoned enemies",
  },
  {
    key: "enemyIsBleeding",
    label: "Is the enemy Bleeding?",
    tooltip: "Enables conditional bonuses against bleeding enemies",
  },
  {
    key: "enemyIsSlowed",
    label: "Is the enemy Slowed?",
    tooltip: "Enables conditional bonuses against slowed enemies",
  },
  {
    key: "enemyIsStunned",
    label: "Is the enemy Stunned?",
    tooltip: "Enables conditional bonuses against stunned enemies",
  },
];

const ENEMY_NUMBERS: NumberDef[] = [
  { key: "enemyArmorShredStacks", label: "Enemy Armor Shred Stacks", min: 0, max: 100 },
];

const PLAYER_CONDITIONS: ToggleDef[] = [
  {
    key: "playerAtFullHealth",
    label: "Are you at full health?",
    tooltip: "Enables bonuses conditional on being at full health",
  },
  {
    key: "playerHasWard",
    label: "Do you have Ward?",
    tooltip: "Enables bonuses conditional on having ward",
  },
  {
    key: "playerRecentlyUsedPotion",
    label: "Did you recently use a potion?",
    tooltip: "Enables bonuses after potion use",
  },
  {
    key: "playerRecentlyKilled",
    label: "Did you recently kill an enemy?",
    tooltip: "Enables on-kill bonuses",
  },
  {
    key: "playerRecentlyBeenHit",
    label: "Have you recently been hit?",
    tooltip: "Enables bonuses after taking a hit",
  },
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
      className="le-row flex cursor-pointer items-center justify-between rounded px-1 py-1 text-xs"
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
    <div className="flex items-center justify-between py-1 text-xs px-1" title={def.tooltip}>
      <label className="text-slate-300">{def.label}</label>
      <input
        type="number"
        min={def.min}
        max={def.max}
        value={value}
        onChange={(e) => onChange(def.key, Number(e.target.value || 0))}
        className="le-input w-16 rounded px-2 py-0.5 text-right"
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
    <div className="le-panel-soft mb-3 rounded">
      <button
        onClick={() => setOpen(!open)}
        className="le-section-title flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-slate-100"
      >
        <span>{title}</span>
        <span className="text-[10px]">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="le-divider border-t px-3 py-2">{children}</div>}
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
              className="le-row flex items-center justify-between rounded bg-slate-800/50 px-2 py-1 text-xs"
            >
              <span className="text-amber-300">
                {m.operation === "add" ? "+" : ""}
                {m.value}
                {m.operation !== "add" ? "%" : ""} {m.operation !== "add" ? `${m.operation} ` : ""}
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
            className="le-input w-16 rounded px-2 py-1 text-xs"
            placeholder="Value"
          />
          <select
            value={op}
            onChange={(e) => setOp(e.target.value)}
            className="le-select rounded px-1 py-1 text-xs"
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
          className="le-select w-full rounded px-2 py-1 text-xs"
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
          className="le-button w-full rounded px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Add Modifier
        </button>
      </div>
    </div>
  );
}

// ── Unique Item Settings ───────────────────────────────

interface EquippedUniqueToggle {
  uniqueId: number;
  uniqueName: string;
  settings: UniqueSettingDef[];
}

function UniqueSettingsSection({
  uniques,
  toggles,
  onToggle,
}: {
  uniques: EquippedUniqueToggle[];
  toggles: { id: string; active: boolean; value?: number }[];
  onToggle: (id: string, active: boolean, value?: number) => void;
}) {
  if (uniques.length === 0) return null;

  return (
    <div className="space-y-3">
      {uniques.map((u) => (
        <div key={u.uniqueId} className="rounded bg-slate-800/40 px-2 py-2">
          <div className="mb-1.5 text-xs font-semibold text-amber-300">{u.uniqueName}</div>
          {u.settings.map((setting) => {
            const toggle = toggles.find((t) => t.id === setting.id);
            if (setting.type === "stacks") {
              const val = toggle?.value ?? setting.defaultValue ?? 0;
              return (
                <div
                  key={setting.id}
                  className="flex items-center justify-between py-1 text-xs px-1"
                >
                  <label className="text-slate-300">{setting.label}</label>
                  <input
                    type="number"
                    min={0}
                    max={setting.max ?? 20}
                    value={val}
                    onChange={(e) => {
                      const n = Math.max(
                        0,
                        Math.min(setting.max ?? 20, Number(e.target.value || 0)),
                      );
                      onToggle(setting.id, n > 0, n);
                    }}
                    className="w-16 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-right text-slate-100"
                  />
                </div>
              );
            }
            return (
              <label
                key={setting.id}
                className="flex cursor-pointer items-center justify-between py-1 text-xs hover:bg-slate-800/40 px-1 rounded"
              >
                <span className="text-slate-300">{setting.label}</span>
                <input
                  type="checkbox"
                  checked={toggle?.active ?? false}
                  onChange={(e) => onToggle(setting.id, e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-500 bg-slate-800 accent-amber-500"
                />
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Main Config Panel ──────────────────────────────────

export default function ConfigPanel() {
  const config = useBuildStore((s) => s.build.config);
  const toggles = useBuildStore((s) => s.build.toggles);
  const equipment = useBuildStore((s) => s.build.equipment);
  const setEnemyLevel = useBuildStore((s) => s.setEnemyLevel);
  const setEnemyResistance = useBuildStore((s) => s.setEnemyResistance);
  const setConfigToggle = useBuildStore((s) => s.setConfigToggle);
  const setConfigNumber = useBuildStore((s) => s.setConfigNumber);
  const setCustomModifiers = useBuildStore((s) => s.setCustomModifiers);
  const setToggle = useBuildStore((s) => s.setToggle);

  // Discover equipped uniques that have toggle definitions
  const equippedUniqueToggles = useMemo(() => {
    const results: EquippedUniqueToggle[] = [];
    for (const item of Object.values(equipment)) {
      if (!item?.uniqueId) continue;
      const toggleDef = getUniqueToggles(item.uniqueId);
      if (!toggleDef) continue;
      const uniqueDef = getUniqueItem(item.uniqueId);
      results.push({
        uniqueId: item.uniqueId,
        uniqueName:
          toggleDef.name ?? item.uniqueName ?? uniqueDef?.displayName ?? uniqueDef?.name ?? `Unique #${item.uniqueId}`,
        settings: toggleDef.settings,
      });
    }
    return results;
  }, [equipment]);

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
      <h2 className="le-title mb-4 text-lg font-bold text-amber-200">Configuration</h2>

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
            className="le-input w-16 rounded px-2 py-0.5 text-right"
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
                  className="le-input w-14 rounded px-1.5 py-0.5 text-right text-xs"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="le-divider mt-2 border-t pt-2 px-1">
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
          <ToggleRow key={def.key} def={def} checked={!!config[def.key]} onChange={handleToggle} />
        ))}
      </Section>

      {/* Player Combat State */}
      <Section title="Player Combat State">
        <div className="mb-1 text-[10px] text-slate-500">
          Set your assumed combat state for conditional calculations.
        </div>
        {PLAYER_CONDITIONS.map((def) => (
          <ToggleRow key={def.key} def={def} checked={!!config[def.key]} onChange={handleToggle} />
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

      {/* Unique Item Settings */}
      {equippedUniqueToggles.length > 0 && (
        <Section title="Unique Item Settings">
          <div className="mb-2 text-[10px] text-slate-500">
            Configure conditional effects from your equipped unique items.
          </div>
          <UniqueSettingsSection
            uniques={equippedUniqueToggles}
            toggles={toggles}
            onToggle={setToggle}
          />
        </Section>
      )}

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
