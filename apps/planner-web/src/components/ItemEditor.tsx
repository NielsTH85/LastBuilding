import { useState, useMemo, useRef } from "react";
import { useBuildStore } from "../store/useBuildStore";
import {
  itemBases,
  affixes,
  getItemSprite,
  getUniqueSprite,
  getUniqueModDisplay,
  formatTooltipDescription,
  isComplexProperty,
  hasComplexDisplayOverride,
  getUniqueItem,
  uniqueItems,
  convertUniqueMods,
  type ItemSlot,
  type AffixDef,
  type UniqueItemDef,
} from "@eob/game-data";
import type { ItemAffixRoll, EquippedItem } from "@eob/build-model";

// ── Slot Grid Layout ───────────────────────────────────

interface SlotConfig {
  slot: ItemSlot;
  label: string;
  row: number;
  col: number;
  size?: "small" | "medium" | "large";
}

const SLOT_GRID: SlotConfig[] = [
  { slot: "helmet", label: "Helmet", row: 1, col: 2, size: "medium" },
  { slot: "amulet", label: "Amulet", row: 1, col: 3, size: "small" },
  { slot: "weapon1", label: "Weapon Slot 1", row: 2, col: 1, size: "large" },
  { slot: "bodyArmor", label: "Body Armor", row: 2, col: 2, size: "large" },
  { slot: "weapon2", label: "Weapon Slot 2", row: 2, col: 3, size: "large" },
  { slot: "ring1", label: "Ring 1", row: 3, col: 1, size: "small" },
  { slot: "belt", label: "Belt", row: 3, col: 2, size: "small" },
  { slot: "ring2", label: "Ring 2", row: 3, col: 3, size: "small" },
  { slot: "gloves", label: "Gloves", row: 4, col: 1, size: "medium" },
  { slot: "boots", label: "Boots", row: 4, col: 2, size: "medium" },
  { slot: "relic", label: "Relic", row: 4, col: 3, size: "medium" },
];

const SLOT_SIZE_STYLE = {
  small: { w: 150, h: 68, image: "h-12 w-12", labelMax: "max-w-[142px]" },
  medium: { w: 150, h: 130, image: "h-20 w-20", labelMax: "max-w-[142px]" },
  large: { w: 150, h: 176, image: "h-28 w-28", labelMax: "max-w-[142px]" },
} as const;

// ── Rarity Styling ─────────────────────────────────────

const RARITY_BORDER: Record<string, string> = {
  normal: "border-slate-600",
  magic: "border-blue-500/60",
  rare: "border-yellow-500/60",
  exalted: "border-purple-500/60",
  unique: "border-orange-500/60",
  set: "border-green-500/60",
};

const RARITY_TEXT: Record<string, string> = {
  normal: "text-slate-300",
  magic: "text-blue-300",
  rare: "text-yellow-300",
  exalted: "text-purple-300",
  unique: "text-orange-300",
  set: "text-green-300",
};

const RARITY_HEADER_BG: Record<string, string> = {
  normal: "bg-slate-700/50",
  magic: "bg-blue-900/40",
  rare: "bg-yellow-900/30",
  exalted: "bg-purple-900/30",
  unique: "bg-orange-900/30",
  set: "bg-green-900/30",
};

// ── Helpers ────────────────────────────────────────────

function formatValue(value: number): string {
  if (Math.abs(value) < 1 && value !== 0) return `${Math.round(value * 100)}%`;
  return String(value);
}

function getBasesForSlot(slot: ItemSlot) {
  // ring2 uses the same bases as ring1
  const lookupSlot = slot === "ring2" ? "ring1" : slot;
  return itemBases.filter((b) => b.slot === lookupSlot);
}

/** Build a lookup from baseTypeId → slot using itemBases data. */
const baseTypeToSlot = new Map<number, ItemSlot>();
for (const b of itemBases) {
  // Extract baseTypeId from item id format "slot-baseTypeId-subTypeId"
  const parts = b.id.split("-");
  const baseTypeId = Number(parts[1]);
  if (!isNaN(baseTypeId) && !baseTypeToSlot.has(baseTypeId)) {
    baseTypeToSlot.set(baseTypeId, b.slot);
  }
}

function getUniquesForSlot(slot: ItemSlot): UniqueItemDef[] {
  const lookupSlot = slot === "ring2" ? "ring1" : slot;
  const result: UniqueItemDef[] = [];
  for (const u of uniqueItems.values()) {
    if (baseTypeToSlot.get(u.baseType) === lookupSlot) {
      result.push(u);
    }
  }
  result.sort((a, b) => (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name));
  return result;
}

/** Get the matching base id for a unique item (first matching subType). */
function getBaseIdForUnique(u: UniqueItemDef): string | undefined {
  for (const subType of u.subTypes) {
    const candidate = itemBases.find((b) => b.id.endsWith(`-${u.baseType}-${subType}`));
    if (candidate) return candidate.id;
  }
  return undefined;
}

function getItemName(item: EquippedItem): string {
  if (item.uniqueName) return item.uniqueName;
  const base = itemBases.find((b) => b.id === item.baseId);
  return base?.name ?? "Unknown";
}

/** Get the image URL for an equipped item. Prefers unique sprite, falls back to base sprite. */
function getItemImageUrl(item: EquippedItem): string | undefined {
  if (item.uniqueId) {
    const sprite = getUniqueSprite(item.uniqueId);
    if (sprite) return `/images/items/uniques/${sprite}`;
  }
  const sprite = getItemSprite(item.baseId);
  if (sprite) return `/images/items/${sprite}`;
  return undefined;
}

// ── Item Tooltip ───────────────────────────────────────

function ItemTooltip({ item, rect }: { item: EquippedItem; rect: DOMRect }) {
  const base = itemBases.find((b) => b.id === item.baseId);
  const rarity = item.rarity ?? "normal";
  const borderColor = RARITY_BORDER[rarity] ?? RARITY_BORDER.normal;
  const headerBg = RARITY_HEADER_BG[rarity] ?? RARITY_HEADER_BG.normal;
  const nameColor = RARITY_TEXT[rarity] ?? RARITY_TEXT.normal;
  const imageUrl = getItemImageUrl(item);
  const uniqueDef = item.uniqueId ? getUniqueItem(item.uniqueId) : undefined;

  const resolvedAffixes = item.affixes
    .map((roll) => ({ roll, def: affixes.find((a) => a.id === roll.affixId) }))
    .filter((a): a is { roll: ItemAffixRoll; def: AffixDef } => !!a.def);
  const prefixes = resolvedAffixes.filter((a) => a.def.type === "prefix");
  const suffixes = resolvedAffixes.filter((a) => a.def.type === "suffix");

  const left = rect.right + 12;
  const top = rect.top;

  // Unique mod display lines — filter out hidden mods.
  // For property 98 (meta/container), only show explicitly mapped templates.
  // For other complex properties, suppress when tooltipDescriptions already cover them.
  const tooltipDescs = Array.from(
    new Set(
      (uniqueDef?.tooltipDescriptions ?? [])
        .map((d) => formatTooltipDescription(d).trim())
        .filter(Boolean),
    ),
  );
  const uniqueModLines =
    uniqueDef?.mods
      .filter(
        (mod) =>
          !mod.hideInTooltip &&
          !(mod.property === 98 && !hasComplexDisplayOverride(mod)) &&
          !(
            tooltipDescs.length > 0 &&
            isComplexProperty(mod.property) &&
            !hasComplexDisplayOverride(mod)
          ),
      )
      .map((mod) => getUniqueModDisplay(mod)) ?? [];

  return (
    <div
      className={`pointer-events-none fixed z-50 w-72 rounded border-2 ${borderColor} bg-slate-900/95 shadow-xl backdrop-blur-sm`}
      style={{ left, top, maxHeight: "80vh" }}
    >
      {/* Header: image + name + type */}
      <div className={`${headerBg} rounded-t px-3 py-2 flex items-center gap-3`}>
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="h-14 w-14 object-contain drop-shadow-lg flex-shrink-0"
          />
        )}
        <div>
          <div className={`text-sm font-bold uppercase ${nameColor}`}>
            {item.uniqueName ?? base?.name ?? "Unknown"}
          </div>
          {base?.typeName && (
            <div className="text-[10px] uppercase text-slate-400">
              {rarity !== "normal" ? `${rarity} ` : ""}
              {base.name}
            </div>
          )}
          {base?.typeName && (
            <div className="text-[10px] uppercase text-slate-500">{base.typeName}</div>
          )}
        </div>
      </div>

      <div className="space-y-1 px-3 py-2 text-xs">
        {/* Weapon stats */}
        {base?.attackRate && (
          <div className="flex justify-between text-slate-500">
            <span>Base Attack Rate</span>
            <span className="text-slate-300">{base.attackRate.toFixed(2)}</span>
          </div>
        )}
        {base?.weaponRange && (
          <div className="flex justify-between text-slate-500">
            <span>Range</span>
            <span className="text-slate-300">{base.weaponRange.toFixed(1)}m</span>
          </div>
        )}
        {(base?.attackRate || base?.weaponRange) && (
          <div className="my-1 border-t border-slate-700/60" />
        )}

        {/* Implicits with display names and ranges */}
        {base && base.implicitDisplays && base.implicitDisplays.length > 0 && (
          <div>
            {base.implicitDisplays.map((imp, i) => {
              const isPct = imp.displayAsPercentage;
              const dispVal = isPct ? Math.round(imp.value * 1000) / 10 : imp.value;
              const dispMin = isPct ? Math.round(imp.value * 1000) / 10 : imp.value;
              const dispMax = isPct ? Math.round(imp.maxValue * 1000) / 10 : imp.maxValue;
              const unit = isPct ? "%" : "";
              const sign = dispVal >= 0 ? "+" : "";
              return (
                <div key={i}>
                  <div className="text-slate-300">
                    {sign}
                    {dispVal}
                    {unit} {imp.propertyName}
                  </div>
                  {dispMin !== dispMax && (
                    <div className="text-[9px] text-slate-600">
                      Range: {dispMin}
                      {unit} to {dispMax}
                      {unit}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="my-1.5 border-t border-slate-700/60" />
          </div>
        )}

        {/* Legendary Potential */}
        {equippedLPDisplay(item)}

        {/* Prefixes */}
        {prefixes.length > 0 && (
          <div>
            {prefixes.map(({ roll, def }) => {
              const tier = def.tiers.find((t) => t.tier === roll.tier);
              return (
                <div key={roll.affixId}>
                  <div className="text-teal-300">
                    +{formatValue(roll.value)} {def.name}
                    <span className="ml-1 text-[9px] text-slate-600">T{roll.tier}</span>
                  </div>
                  {tier && tier.minValue !== tier.maxValue && (
                    <div className="text-[9px] text-slate-600">
                      Range: {formatValue(tier.minValue)} to {formatValue(tier.maxValue)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Suffixes */}
        {suffixes.length > 0 && (
          <div>
            {suffixes.map(({ roll, def }) => {
              const tier = def.tiers.find((t) => t.tier === roll.tier);
              return (
                <div key={roll.affixId}>
                  <div className="text-purple-300">
                    +{formatValue(roll.value)} {def.name}
                    <span className="ml-1 text-[9px] text-slate-600">T{roll.tier}</span>
                  </div>
                  {tier && tier.minValue !== tier.maxValue && (
                    <div className="text-[9px] text-slate-600">
                      Range: {formatValue(tier.minValue)} to {formatValue(tier.maxValue)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Unique effects with proper display names */}
        {(uniqueModLines.length > 0 || tooltipDescs.length > 0) && (
          <div className="border-t border-orange-900/40 pt-1.5">
            {tooltipDescs.map((desc, i) => (
              <div key={`desc-${i}`} className="text-orange-300">
                {desc}
              </div>
            ))}
            {uniqueModLines.map((mod, i) => (
              <div key={i}>
                <div className="text-orange-300">{mod.text}</div>
                {mod.minValue !== mod.maxValue && (
                  <div className="text-[9px] text-slate-600">
                    Range: {mod.minValue}
                    {mod.isPercentage ? "%" : ""} to {mod.maxValue}
                    {mod.isPercentage ? "%" : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Lore text */}
        {uniqueDef?.loreText && (
          <div className="mt-2 border-t border-slate-700/40 pt-1.5">
            <div className="text-[10px] italic text-amber-600/70">{uniqueDef.loreText}</div>
          </div>
        )}

        {/* Level requirement */}
        {(uniqueDef?.levelRequirement ?? base?.levelRequirement ?? 0) > 0 && (
          <div className="mt-1 pt-1 border-t border-slate-700/40 text-[10px] text-slate-500">
            Requires Level {uniqueDef?.levelRequirement ?? base?.levelRequirement}
          </div>
        )}
      </div>
    </div>
  );
}

/** Show legendary potential if applicable */
function equippedLPDisplay(item: EquippedItem) {
  if (item.legendaryPotential == null || item.legendaryPotential <= 0) return null;
  return (
    <div className="mb-1 flex items-center gap-1">
      <span className="text-[10px] font-bold text-amber-400">
        {item.legendaryPotential} LEGENDARY POTENTIAL
      </span>
    </div>
  );
}

// ── Base Item Tooltip (for search list hover) ──────────

function BaseTooltip({
  baseId,
  rect,
}: {
  baseId: string;
  rect: DOMRect;
}) {
  const base = itemBases.find((b) => b.id === baseId);
  if (!base) return null;

  const sprite = getItemSprite(baseId);
  const left = rect.left - 12;
  const top = rect.top;

  return (
    <div
      className="pointer-events-none fixed z-50 w-64 rounded border-2 border-slate-600/60 bg-slate-900/95 shadow-xl backdrop-blur-sm"
      style={{ left, top, maxHeight: "80vh", transform: "translateX(-100%)" }}
    >
      <div className="flex items-center gap-3 rounded-t bg-slate-800/60 px-3 py-2">
        {sprite && (
          <img
            src={`/images/items/${sprite}`}
            alt=""
            className="h-12 w-12 flex-shrink-0 object-contain drop-shadow-lg"
          />
        )}
        <div>
          <div className="text-sm font-bold uppercase text-slate-200">{base.name}</div>
          {base.typeName && (
            <div className="text-[10px] uppercase text-slate-500">{base.typeName}</div>
          )}
        </div>
      </div>

      <div className="space-y-1 px-3 py-2 text-xs">
        {base.attackRate && (
          <div className="flex justify-between text-slate-500">
            <span>Base Attack Rate</span>
            <span className="text-slate-300">{base.attackRate.toFixed(2)}</span>
          </div>
        )}
        {base.weaponRange && (
          <div className="flex justify-between text-slate-500">
            <span>Range</span>
            <span className="text-slate-300">{base.weaponRange.toFixed(1)}m</span>
          </div>
        )}
        {(base.attackRate || base.weaponRange) && (
          <div className="my-1 border-t border-slate-700/60" />
        )}

        {base.implicitDisplays && base.implicitDisplays.length > 0 && (
          <div>
            {base.implicitDisplays.map((imp, i) => {
              const isPct = imp.displayAsPercentage;
              const dispVal = isPct ? Math.round(imp.value * 1000) / 10 : imp.value;
              const dispMin = isPct ? Math.round(imp.value * 1000) / 10 : imp.value;
              const dispMax = isPct ? Math.round(imp.maxValue * 1000) / 10 : imp.maxValue;
              const unit = isPct ? "%" : "";
              const sign = dispVal >= 0 ? "+" : "";
              return (
                <div key={i}>
                  <div className="text-slate-300">
                    {sign}
                    {dispVal}
                    {unit} {imp.propertyName}
                  </div>
                  {dispMin !== dispMax && (
                    <div className="text-[9px] text-slate-600">
                      Range: {dispMin}
                      {unit} to {dispMax}
                      {unit}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {base.levelRequirement > 0 && (
          <div className="mt-1 border-t border-slate-700/40 pt-1 text-[10px] text-slate-500">
            Requires Level {base.levelRequirement}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Unique Item Tooltip (for search list hover) ────────

function UniqueTooltip({
  uniqueId,
  rect,
}: {
  uniqueId: number;
  rect: DOMRect;
}) {
  const u = getUniqueItem(uniqueId);
  if (!u) return null;

  const baseId = getBaseIdForUnique(u);
  const base = baseId ? itemBases.find((b) => b.id === baseId) : undefined;
  const sprite = getUniqueSprite(uniqueId);
  const left = rect.left - 12;
  const top = rect.top;

  const tooltipDescs = Array.from(
    new Set(
      (u.tooltipDescriptions ?? [])
        .map((d) => formatTooltipDescription(d).trim())
        .filter(Boolean),
    ),
  );
  const modLines = u.mods
    .filter(
      (mod) =>
        !mod.hideInTooltip &&
        !(mod.property === 98 && !hasComplexDisplayOverride(mod)) &&
        !(
          tooltipDescs.length > 0 &&
          isComplexProperty(mod.property) &&
          !hasComplexDisplayOverride(mod)
        ),
    )
    .map((mod) => getUniqueModDisplay(mod));

  return (
    <div
      className="pointer-events-none fixed z-50 w-72 rounded border-2 border-orange-500/60 bg-slate-900/95 shadow-xl backdrop-blur-sm"
      style={{ left, top, maxHeight: "80vh", transform: "translateX(-100%)" }}
    >
      <div className="flex items-center gap-3 rounded-t bg-orange-900/30 px-3 py-2">
        {sprite && (
          <img
            src={`/images/items/uniques/${sprite}`}
            alt=""
            className="h-14 w-14 flex-shrink-0 object-contain drop-shadow-lg"
          />
        )}
        <div>
          <div className="text-sm font-bold uppercase text-orange-300">
            {u.displayName ?? u.name}
          </div>
          {base && (
            <div className="text-[10px] uppercase text-slate-400">{base.name}</div>
          )}
          {base?.typeName && (
            <div className="text-[10px] uppercase text-slate-500">{base.typeName}</div>
          )}
        </div>
      </div>

      <div className="space-y-1 px-3 py-2 text-xs">
        {(tooltipDescs.length > 0 || modLines.length > 0) && (
          <div>
            {tooltipDescs.map((desc, i) => (
              <div key={`desc-${i}`} className="text-orange-300">{desc}</div>
            ))}
            {modLines.map((mod, i) => (
              <div key={i}>
                <div className="text-orange-300">{mod.text}</div>
                {mod.minValue !== mod.maxValue && (
                  <div className="text-[9px] text-slate-600">
                    Range: {mod.minValue}{mod.isPercentage ? "%" : ""} to {mod.maxValue}{mod.isPercentage ? "%" : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {u.loreText && (
          <div className="border-t border-slate-700/40 pt-1">
            <div className="text-[10px] italic text-amber-600/70">{u.loreText}</div>
          </div>
        )}

        {(u.levelRequirement ?? 0) > 0 && (
          <div className="mt-1 border-t border-slate-700/40 pt-1 text-[10px] text-slate-500">
            Requires Level {u.levelRequirement}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Equipment Slot Cell ────────────────────────────────

function EquipmentSlot({
  config,
  item,
  isSelected,
  onSelect,
  onHover,
  onLeave,
}: {
  config: SlotConfig;
  item?: EquippedItem;
  isSelected: boolean;
  onSelect: () => void;
  onHover: (el: HTMLElement) => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const rarity = item?.rarity ?? "normal";
  const borderClass = item
    ? (RARITY_BORDER[rarity] ?? RARITY_BORDER.normal)
    : "border-slate-700/50";
  const imageUrl = item ? getItemImageUrl(item) : undefined;
  const size = SLOT_SIZE_STYLE[config.size ?? "medium"];

  return (
    <button
      ref={ref}
      onClick={onSelect}
      onMouseEnter={() => {
        if (item && ref.current) onHover(ref.current);
      }}
      onMouseLeave={onLeave}
      style={{ gridRow: config.row, gridColumn: config.col, width: size.w, height: size.h }}
      className={`relative flex items-center justify-center rounded-lg border-2 transition-all justify-self-center self-center ${borderClass} ${
        isSelected
          ? "ring-2 ring-amber-400/60 bg-slate-800/80"
          : "bg-slate-900/60 hover:bg-slate-800/40"
      }`}
      aria-label={config.label}
      title={config.label}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={item ? getItemName(item) : config.label}
          className={`${size.image} object-contain drop-shadow-lg`}
          draggable={false}
        />
      ) : (
        <>
          <span className={`text-xs font-medium ${item ? "text-slate-500" : "text-slate-600"}`}>
            {config.label}
          </span>
          {!item && <span className="mt-1 text-xl text-slate-700 opacity-40">+</span>}
        </>
      )}

      {item && (
        <span
          className={`absolute bottom-1.5 ${size.labelMax} truncate text-center text-[11px] font-semibold ${RARITY_TEXT[rarity] ?? RARITY_TEXT.normal}`}
        >
          {getItemName(item)}
        </span>
      )}
    </button>
  );
}

// ── Affix Row ──────────────────────────────────────────

function AffixRow({
  roll,
  def,
  onUpdate,
  onRemove,
}: {
  roll: ItemAffixRoll;
  def: AffixDef;
  onUpdate: (affixId: string, tier: number, value: number) => void;
  onRemove: (affixId: string) => void;
}) {
  const currentTier = def.tiers.find((t) => t.tier === roll.tier);
  const minVal = currentTier?.minValue ?? 0;
  const maxVal = currentTier?.maxValue ?? 0;

  return (
    <div className="mb-1.5 rounded border border-slate-700 bg-slate-800/50 p-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-slate-200">{def.name}</span>
        <button
          onClick={() => onRemove(roll.affixId)}
          className="text-[10px] text-red-400 hover:text-red-300"
        >
          ×
        </button>
      </div>
      <div className="flex items-center gap-2">
        <select
          className="rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-[10px] text-slate-300"
          value={roll.tier}
          onChange={(e) => {
            const newTier = Number(e.target.value);
            const tierDef = def.tiers.find((t) => t.tier === newTier);
            if (!tierDef) return;
            const clamped = Math.min(Math.max(roll.value, tierDef.minValue), tierDef.maxValue);
            onUpdate(roll.affixId, newTier, clamped);
          }}
        >
          {def.tiers.map((t) => (
            <option key={t.tier} value={t.tier}>
              T{t.tier}
            </option>
          ))}
        </select>
        <input
          type="range"
          className="h-1 flex-1 cursor-pointer accent-amber-500"
          min={minVal}
          max={maxVal}
          step={maxVal < 1 ? 0.01 : 1}
          value={roll.value}
          onChange={(e) => onUpdate(roll.affixId, roll.tier, Number(e.target.value))}
        />
        <span className="min-w-[50px] text-right text-[10px] text-amber-300">
          +{formatValue(roll.value)} {def.targetStat.replace(/_/g, " ")}
        </span>
      </div>
      <div className="mt-0.5 text-right text-[9px] text-slate-600">
        range: {formatValue(minVal)} – {formatValue(maxVal)}
      </div>
    </div>
  );
}

// ── Affix Section (shared between creator and editor) ──

function AffixSection({
  label,
  color,
  affixRows,
  available,
  onAdd,
  onUpdate,
  onRemove,
}: {
  label: string;
  color: string;
  affixRows: { roll: ItemAffixRoll; def: AffixDef }[];
  available: AffixDef[];
  onAdd: (affixId: string) => void;
  onUpdate: (affixId: string, tier: number, value: number) => void;
  onRemove: (affixId: string) => void;
}) {
  return (
    <div className="mb-3">
      <div className={`mb-1 text-[10px] font-semibold uppercase ${color}`}>{label}</div>
      {affixRows.map(({ roll, def }) => (
        <AffixRow
          key={roll.affixId}
          roll={roll}
          def={def}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
      {affixRows.length === 0 && <div className="mb-1 text-[10px] italic text-slate-600">None</div>}
      <select
        className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] text-slate-400"
        value=""
        onChange={(e) => {
          if (e.target.value) onAdd(e.target.value);
        }}
      >
        <option value="">+ Add {label.toLowerCase()}…</option>
        {available.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} — {a.targetStat.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Item Editor Panel ──────────────────────────────────

function ItemPanel({ slot }: { slot: ItemSlot }) {
  const build = useBuildStore((s) => s.build);
  const equipAction = useBuildStore((s) => s.equipItem);
  const unequipAction = useBuildStore((s) => s.unequipItem);
  const addAffixAction = useBuildStore((s) => s.addAffix);
  const updateAffixAction = useBuildStore((s) => s.updateAffix);
  const removeAffixAction = useBuildStore((s) => s.removeAffix);
  const equipFullItem = useBuildStore((s) => s.equipFullItem);
  const inventory = useBuildStore((s) => s.inventory);
  const equipFromInventory = useBuildStore((s) => s.equipFromInventory);
  const removeFromInventory = useBuildStore((s) => s.removeFromInventory);

  const [creatorMode, setCreatorMode] = useState(false);
  const [creatorTab, setCreatorTab] = useState<"base" | "unique">("base");
  const [creatorBase, setCreatorBase] = useState("");
  const [creatorBaseQuery, setCreatorBaseQuery] = useState("");
  const [creatorAffixes, setCreatorAffixes] = useState<ItemAffixRoll[]>([]);
  const [hoveredBase, setHoveredBase] = useState<{
    id: string;
    rect: DOMRect;
  } | null>(null);
  const [hoveredUnique, setHoveredUnique] = useState<{
    uniqueId: number;
    rect: DOMRect;
  } | null>(null);
  const [creatorUnique, setCreatorUnique] = useState<UniqueItemDef | null>(null);

  const equippedItem = build.equipment[slot];
  const equippedBase = equippedItem
    ? itemBases.find((b) => b.id === equippedItem.baseId)
    : undefined;
  const availableBases = useMemo(() => getBasesForSlot(slot), [slot]);
  const availableUniques = useMemo(() => getUniquesForSlot(slot), [slot]);
  const slotInventory = inventory[slot] ?? [];
  const slotLabel = SLOT_GRID.find((s) => s.slot === slot)?.label ?? slot;

  // Equipped item affixes
  const equippedPrefixes = useMemo(() => {
    if (!equippedItem) return [];
    return equippedItem.affixes
      .map((roll) => ({ roll, def: affixes.find((a) => a.id === roll.affixId) }))
      .filter((a): a is { roll: ItemAffixRoll; def: AffixDef } => a.def?.type === "prefix");
  }, [equippedItem]);

  const equippedSuffixes = useMemo(() => {
    if (!equippedItem) return [];
    return equippedItem.affixes
      .map((roll) => ({ roll, def: affixes.find((a) => a.id === roll.affixId) }))
      .filter((a): a is { roll: ItemAffixRoll; def: AffixDef } => a.def?.type === "suffix");
  }, [equippedItem]);

  const itemAffixIds = new Set(equippedItem?.affixes.map((a) => a.affixId) ?? []);
  const availablePrefixes = affixes.filter((a) => a.type === "prefix" && !itemAffixIds.has(a.id));
  const availableSuffixes = affixes.filter((a) => a.type === "suffix" && !itemAffixIds.has(a.id));

  // Creator affixes
  const creatorAffixIds = new Set(creatorAffixes.map((a) => a.affixId));
  const creatorPrefixes = creatorAffixes
    .map((roll) => ({ roll, def: affixes.find((a) => a.id === roll.affixId) }))
    .filter((a): a is { roll: ItemAffixRoll; def: AffixDef } => a.def?.type === "prefix");
  const creatorSuffixes = creatorAffixes
    .map((roll) => ({ roll, def: affixes.find((a) => a.id === roll.affixId) }))
    .filter((a): a is { roll: ItemAffixRoll; def: AffixDef } => a.def?.type === "suffix");
  const creatorAvailPrefixes = affixes.filter(
    (a) => a.type === "prefix" && !creatorAffixIds.has(a.id),
  );
  const creatorAvailSuffixes = affixes.filter(
    (a) => a.type === "suffix" && !creatorAffixIds.has(a.id),
  );

  function handleAddAffixToEquipped(affixId: string) {
    const def = affixes.find((a) => a.id === affixId);
    if (!def) return;
    const t1 = def.tiers[0];
    if (!t1) return;
    addAffixAction(slot, affixId, 1, t1.maxValue);
  }

  function handleCreatorAddAffix(affixId: string) {
    const def = affixes.find((a) => a.id === affixId);
    if (!def) return;
    const t1 = def.tiers[0];
    if (!t1) return;
    setCreatorAffixes((prev) => [...prev, { affixId, tier: 1, value: t1.maxValue }]);
  }

  function handleCreatorUpdateAffix(affixId: string, tier: number, value: number) {
    setCreatorAffixes((prev) =>
      prev.map((a) => (a.affixId === affixId ? { ...a, tier, value } : a)),
    );
  }

  function handleCreatorRemoveAffix(affixId: string) {
    setCreatorAffixes((prev) => prev.filter((a) => a.affixId !== affixId));
  }

  function handleAddToBuild() {
    if (creatorTab === "unique" && creatorUnique) {
      const baseId = getBaseIdForUnique(creatorUnique);
      if (!baseId) return;
      const item: EquippedItem = {
        baseId,
        rarity: "unique",
        affixes: [],
        uniqueId: creatorUnique.uniqueId,
        uniqueName: creatorUnique.displayName ?? creatorUnique.name,
        uniqueEffects: convertUniqueMods(creatorUnique.uniqueId),
      };
      if (item.uniqueEffects?.length === 0) item.uniqueEffects = undefined;
      equipFullItem(slot, item);
    } else {
      if (!creatorBase) return;
      const item: EquippedItem = {
        baseId: creatorBase,
        rarity: creatorAffixes.length > 0 ? "rare" : "normal",
        affixes: [...creatorAffixes],
      };
      equipFullItem(slot, item);
    }
    setCreatorMode(false);
    setCreatorTab("base");
    setCreatorBase("");
    setCreatorBaseQuery("");
    setCreatorAffixes([]);
    setCreatorUnique(null);
    setHoveredUnique(null);
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between border-b border-slate-700 pb-2">
        <h3 className="text-sm font-bold text-slate-200">{slotLabel}</h3>
        <div className="flex gap-2">
          {!creatorMode && (
            <button
              onClick={() => setCreatorMode(true)}
              className="rounded bg-amber-600/20 px-2 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-600/30"
            >
              + New Item
            </button>
          )}
          {equippedItem && (
            <button
              onClick={() => unequipAction(slot)}
              className="rounded bg-red-900/20 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-900/30"
            >
              Unequip
            </button>
          )}
        </div>
      </div>

      {/* Creator Mode */}
      {creatorMode && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-950/10 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-300">Create New Item</span>
            <button
              onClick={() => {
                setCreatorMode(false);
                setCreatorTab("base");
                setCreatorBase("");
                setCreatorBaseQuery("");
                setCreatorAffixes([]);
                setCreatorUnique(null);
                setHoveredUnique(null);
              }}
              className="text-[10px] text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>

          {/* Tab toggle: Base / Unique */}
          <div className="mb-2 flex rounded border border-slate-700 bg-slate-900">
            <button
              onClick={() => {
                setCreatorTab("base");
                setCreatorUnique(null);
                setHoveredUnique(null);
              }}
              className={`flex-1 px-2 py-1 text-[10px] font-medium transition-colors ${
                creatorTab === "base"
                  ? "bg-slate-700 text-slate-200"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Base Items
            </button>
            <button
              onClick={() => {
                setCreatorTab("unique");
                setCreatorBase("");
                setCreatorBaseQuery("");
                setCreatorAffixes([]);
                setHoveredBase(null);
              }}
              className={`flex-1 px-2 py-1 text-[10px] font-medium transition-colors ${
                creatorTab === "unique"
                  ? "bg-orange-900/40 text-orange-300"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Uniques ({availableUniques.length})
            </button>
          </div>

          {creatorTab === "base" && (
          <>
          <div className="mb-2">
            <label className="mb-1 block text-[10px] text-slate-500">Base Type</label>
            {creatorBase ? (
              <div className="flex items-center justify-between rounded border border-slate-600 bg-slate-800 px-2 py-1">
                <span className="text-xs text-slate-200">
                  {availableBases.find((b) => b.id === creatorBase)?.name ?? creatorBase}
                </span>
                <button
                  onClick={() => {
                    setCreatorBase("");
                    setCreatorBaseQuery("");
                    setCreatorAffixes([]);
                  }}
                  className="text-[10px] text-slate-500 hover:text-slate-300"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Search bases..."
                  value={creatorBaseQuery}
                  onChange={(e) => setCreatorBaseQuery(e.target.value)}
                  className="mb-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500"
                  autoFocus
                />
                <div className="max-h-48 overflow-y-auto rounded border border-slate-700 bg-slate-900">
                  {availableBases
                    .filter(
                      (b) =>
                        !creatorBaseQuery.trim() ||
                        b.name
                          .toLowerCase()
                          .includes(creatorBaseQuery.trim().toLowerCase()),
                    )
                    .map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setCreatorBase(b.id);
                          setCreatorBaseQuery("");
                          setHoveredBase(null);
                        }}
                        onMouseEnter={(e) =>
                          setHoveredBase({
                            id: b.id,
                            rect: e.currentTarget.getBoundingClientRect(),
                          })
                        }
                        onMouseLeave={() => setHoveredBase(null)}
                        className="w-full px-2 py-1 text-left text-xs text-slate-300 hover:bg-slate-800"
                      >
                        {b.name}
                      </button>
                    ))}
                </div>
                {hoveredBase && (
                  <BaseTooltip baseId={hoveredBase.id} rect={hoveredBase.rect} />
                )}
              </>
            )}
          </div>

          {creatorBase && (
            <>
              <AffixSection
                label="Prefixes"
                color="text-teal-400"
                affixRows={creatorPrefixes}
                available={creatorAvailPrefixes}
                onAdd={handleCreatorAddAffix}
                onUpdate={handleCreatorUpdateAffix}
                onRemove={handleCreatorRemoveAffix}
              />
              <AffixSection
                label="Suffixes"
                color="text-purple-400"
                affixRows={creatorSuffixes}
                available={creatorAvailSuffixes}
                onAdd={handleCreatorAddAffix}
                onUpdate={handleCreatorUpdateAffix}
                onRemove={handleCreatorRemoveAffix}
              />
              <button
                onClick={handleAddToBuild}
                className="w-full rounded bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-500"
              >
                Add to Build
              </button>
            </>
          )}
          </>
          )}

          {creatorTab === "unique" && (
            <div className="mb-2">
              {creatorUnique ? (
                <div>
                  <div className="flex items-center justify-between rounded border border-orange-500/40 bg-orange-950/20 px-2 py-1">
                    <span className="text-xs font-semibold text-orange-300">
                      {creatorUnique.displayName ?? creatorUnique.name}
                    </span>
                    <button
                      onClick={() => {
                        setCreatorUnique(null);
                        setHoveredUnique(null);
                      }}
                      className="text-[10px] text-slate-500 hover:text-slate-300"
                    >
                      Change
                    </button>
                  </div>
                  <button
                    onClick={handleAddToBuild}
                    className="mt-2 w-full rounded bg-orange-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-orange-500"
                  >
                    Add to Build
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Search uniques..."
                    value={creatorBaseQuery}
                    onChange={(e) => setCreatorBaseQuery(e.target.value)}
                    className="mb-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto rounded border border-orange-900/40 bg-slate-900">
                    {availableUniques
                      .filter(
                        (u) =>
                          !creatorBaseQuery.trim() ||
                          (u.displayName ?? u.name)
                            .toLowerCase()
                            .includes(creatorBaseQuery.trim().toLowerCase()),
                      )
                      .map((u) => (
                        <button
                          key={u.uniqueId}
                          onClick={() => {
                            setCreatorUnique(u);
                            setCreatorBaseQuery("");
                            setHoveredUnique(null);
                          }}
                          onMouseEnter={(e) =>
                            setHoveredUnique({
                              uniqueId: u.uniqueId,
                              rect: e.currentTarget.getBoundingClientRect(),
                            })
                          }
                          onMouseLeave={() => setHoveredUnique(null)}
                          className="w-full px-2 py-1 text-left text-xs text-orange-300 hover:bg-orange-950/30"
                        >
                          {u.displayName ?? u.name}
                          {u.isSetItem && (
                            <span className="ml-1 text-[9px] text-green-400">(Set)</span>
                          )}
                        </button>
                      ))}
                    {availableUniques.filter(
                      (u) =>
                        !creatorBaseQuery.trim() ||
                        (u.displayName ?? u.name)
                          .toLowerCase()
                          .includes(creatorBaseQuery.trim().toLowerCase()),
                    ).length === 0 && (
                      <div className="px-2 py-2 text-[10px] italic text-slate-600">
                        No uniques found for this slot
                      </div>
                    )}
                  </div>
                  {hoveredUnique && (
                    <UniqueTooltip uniqueId={hoveredUnique.uniqueId} rect={hoveredUnique.rect} />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Equipped Item Editor */}
      {equippedItem && (
        <div className="mb-4">
          <div className="mb-2 text-[10px] font-semibold uppercase text-slate-500">Equipped</div>

          {equippedItem.uniqueName && (
            <div className="mb-2 rounded bg-orange-900/30 px-2 py-1 text-xs font-semibold text-orange-400">
              {equippedItem.uniqueName}
            </div>
          )}

          <div className="mb-2">
            <label className="mb-1 block text-[10px] text-slate-500">Base Item</label>
            <select
              className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
              value={equippedItem.baseId}
              onChange={(e) => {
                if (e.target.value) equipAction(slot, e.target.value);
              }}
            >
              <option value="">— Select —</option>
              {availableBases.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {equippedBase && equippedBase.implicits.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] font-medium text-slate-500">Implicits</div>
              {equippedBase.implicits.map((m) => (
                <div key={m.id} className="text-xs text-blue-300">
                  +{formatValue(m.value)} {m.targetStat.replace(/_/g, " ")}
                </div>
              ))}
            </div>
          )}

          <AffixSection
            label="Prefixes"
            color="text-teal-400"
            affixRows={equippedPrefixes}
            available={availablePrefixes}
            onAdd={handleAddAffixToEquipped}
            onUpdate={(id, tier, val) => updateAffixAction(slot, id, tier, val)}
            onRemove={(id) => removeAffixAction(slot, id)}
          />

          <AffixSection
            label="Suffixes"
            color="text-purple-400"
            affixRows={equippedSuffixes}
            available={availableSuffixes}
            onAdd={handleAddAffixToEquipped}
            onUpdate={(id, tier, val) => updateAffixAction(slot, id, tier, val)}
            onRemove={(id) => removeAffixAction(slot, id)}
          />

          {equippedItem.uniqueId &&
            (() => {
              const uniqueDef = getUniqueItem(equippedItem.uniqueId!);
              const descs = Array.from(
                new Set(
                  (uniqueDef?.tooltipDescriptions ?? [])
                    .map((d) => formatTooltipDescription(d).trim())
                    .filter(Boolean),
                ),
              );
              const modLines =
                uniqueDef?.mods
                  .filter(
                    (mod) =>
                      !mod.hideInTooltip &&
                      !(mod.property === 98 && !hasComplexDisplayOverride(mod)) &&
                      !(
                        descs.length > 0 &&
                        isComplexProperty(mod.property) &&
                        !hasComplexDisplayOverride(mod)
                      ),
                  )
                  .map((mod) => getUniqueModDisplay(mod)) ?? [];
              if (modLines.length === 0 && descs.length === 0) return null;
              return (
                <div className="border-t border-orange-900/40 pt-2">
                  <div className="mb-1 text-[10px] font-semibold uppercase text-orange-400">
                    Unique Effects
                  </div>
                  {descs.map((desc, i) => (
                    <div key={`desc-${i}`} className="text-xs text-orange-300">
                      {desc}
                    </div>
                  ))}
                  {modLines.map((mod, i) => (
                    <div key={i} className="text-xs text-orange-300">
                      {mod.text}
                    </div>
                  ))}
                </div>
              );
            })()}
        </div>
      )}

      {/* Empty state */}
      {!equippedItem && !creatorMode && (
        <div className="flex flex-1 flex-col items-center justify-center text-slate-600">
          <span className="mb-2 text-2xl">+</span>
          <span className="text-xs">No item equipped</span>
          <button
            onClick={() => setCreatorMode(true)}
            className="mt-2 rounded bg-amber-600/20 px-3 py-1 text-xs text-amber-300 hover:bg-amber-600/30"
          >
            Create Item
          </button>
        </div>
      )}

      {/* Inventory */}
      {slotInventory.length > 0 && (
        <div className="mt-auto border-t border-slate-700 pt-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase text-slate-500">
            Inventory ({slotInventory.length})
          </div>
          <div className="space-y-1">
            {slotInventory.map((invItem, idx) => {
              const invBase = itemBases.find((b) => b.id === invItem.baseId);
              const rarity = invItem.rarity ?? "normal";
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded border border-slate-700 bg-slate-800/50 px-2 py-1"
                >
                  <span className={`text-xs ${RARITY_TEXT[rarity] ?? ""}`}>
                    {invItem.uniqueName ?? invBase?.name ?? "Unknown"}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => equipFromInventory(slot, idx)}
                      className="rounded bg-slate-700 px-1.5 py-0.5 text-[9px] text-amber-300 hover:bg-slate-600"
                    >
                      Equip
                    </button>
                    <button
                      onClick={() => removeFromInventory(slot, idx)}
                      className="rounded bg-slate-700 px-1.5 py-0.5 text-[9px] text-red-400 hover:bg-slate-600"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

export default function ItemEditor() {
  const build = useBuildStore((s) => s.build);
  const [selectedSlot, setSelectedSlot] = useState<ItemSlot | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{ slot: ItemSlot; rect: DOMRect } | null>(null);

  const tooltipItem = tooltipInfo ? build.equipment[tooltipInfo.slot] : undefined;

  return (
    <div className="flex h-full items-start justify-center gap-6">
      {/* Left: Equipment Grid */}
      <div className="flex flex-col items-center">
        <h3 className="mb-3 text-sm font-semibold uppercase text-slate-400">Equipment</h3>
        <div
          className="grid gap-3 rounded-xl border border-slate-700/50 bg-slate-900/40 p-5"
          style={{
            gridTemplateColumns: "repeat(3, 150px)",
            gridTemplateRows: "130px 176px 68px 130px",
          }}
        >
          {SLOT_GRID.map((config) => (
            <EquipmentSlot
              key={config.slot}
              config={config}
              item={build.equipment[config.slot]}
              isSelected={selectedSlot === config.slot}
              onSelect={() => setSelectedSlot(selectedSlot === config.slot ? null : config.slot)}
              onHover={(el) =>
                setTooltipInfo({ slot: config.slot, rect: el.getBoundingClientRect() })
              }
              onLeave={() => setTooltipInfo(null)}
            />
          ))}
        </div>
      </div>

      {/* Right: Editor Panel */}
      {selectedSlot && (
        <div className="w-[380px] flex-shrink-0 rounded-lg border border-slate-700 bg-slate-900 p-4 overflow-y-auto">
          <ItemPanel slot={selectedSlot} />
        </div>
      )}

      {!selectedSlot && (
        <div className="flex w-[380px] flex-shrink-0 items-center justify-center text-slate-600">
          <span className="text-sm">Select an equipment slot to edit</span>
        </div>
      )}

      {/* Floating Tooltip */}
      {tooltipInfo && tooltipItem && <ItemTooltip item={tooltipItem} rect={tooltipInfo.rect} />}
    </div>
  );
}
