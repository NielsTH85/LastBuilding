import { useMemo, useState } from "react";
import { getGameData, getItemSprite } from "@eob/game-data";
import { useBuildStore } from "../store/useBuildStore";

function statLabel(stat: string): string {
  return stat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatEffectValue(value: number, operation: string): string {
  const pct = Math.abs(value) <= 1 ? `${Math.round(value * 1000) / 10}%` : `${Math.round(value * 100) / 100}`;
  return operation === "more" ? `${pct} more` : operation === "increased" ? `${pct} increased` : pct;
}

function getImportedIdolMeta(
  idolId: string,
): { name: string; size: { width: number; height: number }; baseType: number; subType: number } | null {
  const match = idolId.match(/^idol-(\d+)-(\d+)$/);
  if (!match) return null;
  const baseType = Number(match[1]);
  const subType = Number(match[2]);
  const size =
    baseType === 25 || baseType === 26
      ? { width: 1, height: 1 }
      : baseType === 27
        ? { width: 2, height: 1 }
        : baseType === 28
          ? { width: 1, height: 2 }
          : baseType === 29
            ? { width: 3, height: 1 }
            : baseType === 30
              ? { width: 1, height: 3 }
              : baseType === 31
                ? { width: 4, height: 1 }
                : baseType === 32
                  ? { width: 1, height: 4 }
                  : baseType === 33
                    ? { width: 2, height: 2 }
                    : null;
  if (!size) return null;
  return {
    name: `Imported Idol ${baseType}-${subType}`,
    size,
    baseType,
    subType,
  };
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function IdolGlyph({ idolId, label, compact = false }: { idolId: string; label: string; compact?: boolean }) {
  const hash = hashString(idolId);
  const hue = hash % 360;
  const ring = 35 + (hash % 25);
  const line = 60 + (hash % 25);
  const base = compact ? "h-10 w-10" : "h-full w-full";
  const textClass = compact ? "text-[9px]" : "text-[10px]";
  return (
    <div
      className={`relative overflow-hidden rounded ${base}`}
      style={{
        background: `radial-gradient(circle at 30% 30%, hsl(${hue} 85% 35%), hsl(${(hue + 50) % 360} 75% 13%))`,
      }}
      title={label}
    >
      <div
        className="absolute inset-1 rounded-full border"
        style={{ borderColor: `hsla(${ring}, 95%, 70%, 0.9)` }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-[65%] w-[2px] -translate-x-1/2 -translate-y-1/2 rotate-12 rounded"
        style={{ backgroundColor: `hsla(${line}, 100%, 82%, 0.9)` }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-[2px] w-[65%] -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded"
        style={{ backgroundColor: `hsla(${(line + 20) % 360}, 100%, 85%, 0.9)` }}
      />
      <div className={`absolute bottom-0 left-0 right-0 bg-black/45 py-0.5 text-center font-semibold uppercase tracking-wide text-slate-200 ${textClass}`}>
        {label}
      </div>
    </div>
  );
}

export default function IdolEditor() {
  const gameData = useMemo(() => getGameData(), []);
  const gridRows = gameData.idolGrid.rows;
  const gridCols = gameData.idolGrid.cols;
  const totalCells = gridRows * gridCols;

  const [selectedSlot, setSelectedSlot] = useState(0);
  const [query, setQuery] = useState("");
  const build = useBuildStore((s) => s.build);
  const setIdol = useBuildStore((s) => s.setIdol);
  const setIdolAltar = useBuildStore((s) => s.setIdolAltar);

  const idolOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gameData.idols
      .filter((i) => !q || i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [gameData.idols, query]);

  const activeAltarId = build.idolAltarId ?? gameData.idolAltars[0]?.id;
  const activeAltar = gameData.idolAltars.find((a) => a.id === activeAltarId);
  const slotIndices = useMemo(() => new Set(activeAltar?.slotIndices ?? []), [activeAltar]);
  const blockedSlots = useMemo(() => new Set(activeAltar?.blockedSlots ?? []), [activeAltar]);
  const refractedSlots = useMemo(() => new Set(activeAltar?.refractedSlots ?? []), [activeAltar]);

  const altarSprite = activeAltar ? getItemSprite(activeAltar.id) : undefined;

  const placements = useMemo(() => {
    const allowedSlots = new Set(activeAltar?.slotIndices ?? []);
    const blocked = new Set(activeAltar?.blockedSlots ?? []);
    const occupied = new Set<number>();
    const entries: Array<{
      idolId: string;
      slotIndex: number;
      cells: number[];
      size: { width: number; height: number };
      name: string;
    }> = [];

    for (const [idx, idolState] of build.idols.entries()) {
      const knownIdol = gameData.idols.find((i) => i.id === idolState.idolId);
      const importedMeta = knownIdol ? null : getImportedIdolMeta(idolState.idolId);
      if (!knownIdol && !importedMeta) continue;

      const idolName = knownIdol?.name ?? importedMeta?.name ?? idolState.idolId;
      const idolSize = knownIdol?.size ?? importedMeta?.size;
      if (!idolSize) continue;

      const slot = idolState.slotIndex ?? idx;
      const row = Math.floor(slot / gridCols);
      const col = slot % gridCols;
      const cells: number[] = [];
      let valid = true;
      for (let y = 0; y < idolSize.height; y++) {
        const cellRow = row + y;
        if (cellRow >= gridRows) {
          valid = false;
          break;
        }
        for (let x = 0; x < idolSize.width; x++) {
          const cellCol = col + x;
          if (cellCol >= gridCols) {
            valid = false;
            break;
          }
          cells.push(cellRow * gridCols + cellCol);
        }
      }
      if (!valid) continue;

      // Skip illegal placements so stale imported states don't clutter the board.
      if (cells.some((cell) => !allowedSlots.has(cell) || blocked.has(cell) || occupied.has(cell))) {
        continue;
      }

      for (const cell of cells) occupied.add(cell);

      entries.push({
        idolId: idolState.idolId,
        slotIndex: slot,
        cells,
        size: idolSize,
        name: idolName,
      });
    }
    return entries;
  }, [activeAltar, build.idols, gameData.idols, gridCols, gridRows]);

  const idolsBySlot = useMemo(() => {
    const map = new Map<number, (typeof placements)[number]>();
    for (const placement of placements) {
      for (const cell of placement.cells) {
        map.set(cell, placement);
      }
    }
    return map;
  }, [placements]);

  const selectedPlacement = idolsBySlot.get(selectedSlot);
  const selectedIdolId = selectedPlacement?.idolId ?? null;
  const selectedIdol = selectedIdolId ? gameData.idols.find((i) => i.id === selectedIdolId) : undefined;

  return (
    <div className="grid h-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_520px_minmax(780px,1fr)] 2xl:grid-cols-[minmax(0,1fr)_560px_minmax(920px,1fr)]">
      <div className="hidden xl:block" />

      <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Idol Grid</h2>
          <select
            value={activeAltarId}
            onChange={(e) => setIdolAltar(e.target.value)}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200"
          >
            {gameData.idolAltars.map((altar) => (
              <option key={altar.id} value={altar.id}>
                {altar.name}
              </option>
            ))}
          </select>
        </div>

        {activeAltar && (
          <div className="mb-3 rounded-lg border border-violet-400/40 bg-gradient-to-br from-slate-900 to-violet-950/35 p-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-md border border-violet-300/50 bg-slate-950/70 p-1">
                {altarSprite ? (
                  <img
                    src={`/images/items/${altarSprite}`}
                    alt={activeAltar.name}
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <IdolGlyph idolId={activeAltar.id} label="ALT" compact />
                )}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-violet-300/80">Active Altar</div>
                <div className="text-sm font-semibold text-violet-100">{activeAltar.name}</div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide">
          <span className="rounded border border-cyan-400/60 bg-cyan-900/30 px-2 py-0.5 text-cyan-200">Buffed Slot</span>
          <span className="rounded border border-rose-500/60 bg-rose-950/35 px-2 py-0.5 text-rose-200">Occupied Footprint</span>
          <span className="rounded border border-slate-500/70 bg-slate-900/70 px-2 py-0.5 text-slate-300">Blocked Node</span>
        </div>

        <div className="mx-auto">
          <div
            className="grid gap-2.5"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
              // gap-2.5 equals 0.625rem; used for multi-cell idol span math.
              ["--idol-cell-gap" as string]: "0.625rem",
            }}
          >
          {Array.from({ length: totalCells }).map((_, slot) => {
            const isAvailableSlot = slotIndices.has(slot);
            if (!isAvailableSlot) {
              return <div key={slot} className="aspect-square" />;
            }

            const placement = idolsBySlot.get(slot);
            const isAnchor = placement?.slotIndex === slot;
            const placementSprite = placement ? getItemSprite(placement.idolId) : undefined;
            const sprite = placement && isAnchor ? placementSprite : undefined;
            const buffsWholePlacement = Boolean(
              placement && placement.cells.some((cell) => refractedSlots.has(cell)),
            );
            const isLargeSprite = Boolean(
              placementSprite && placement && (placement.size.width > 1 || placement.size.height > 1),
            );
            const isBlockedNode = blockedSlots.has(slot);
            const isRefracted = refractedSlots.has(slot);
            const isBlockedByFootprint = Boolean(placement && !isAnchor);
            const isBuffedOccupiedCell = Boolean(isRefracted && placement && !isBlockedNode);
            const isCoveredBySpriteFootprint = Boolean(
              isBlockedByFootprint && isLargeSprite,
            );
            const suppressCellChrome = isCoveredBySpriteFootprint || (isAnchor && isLargeSprite);
            const isSelected = selectedSlot === slot;

            return (
              <button
                key={slot}
                onClick={() => setSelectedSlot(slot)}
                disabled={isBlockedNode}
                className={`relative aspect-square min-h-[78px] overflow-visible rounded border transition-colors ${
                  isSelected
                    ? "border-amber-400 bg-slate-800"
                    : isBlockedNode
                      ? "border-slate-700/60 bg-slate-900/85"
                    : isBlockedByFootprint
                      ? isCoveredBySpriteFootprint
                        ? "border-transparent bg-transparent"
                        : "border-rose-500/70 bg-rose-950/35 hover:border-rose-300"
                    : isRefracted
                      ? "border-cyan-300 bg-cyan-900/45 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.65),0_0_18px_rgba(34,211,238,0.35)] hover:border-cyan-100"
                      : "border-slate-700 bg-slate-950 hover:border-slate-500"
                }`}
                style={isBlockedNode ? { backgroundImage: 'url(/images/idols/idols-blocked.webp)', backgroundSize: 'cover' } : undefined}
                title={placement?.name ?? `Idol Slot ${slot + 1}`}
              >
                {isRefracted && !isBlockedNode && !suppressCellChrome && (
                  <span
                    className="pointer-events-none absolute inset-[-2px] z-[2]"
                    style={{ backgroundImage: 'url(/images/idols/idols-refracted.webp)', backgroundSize: '100% 100%' }}
                  />
                )}
                {isBuffedOccupiedCell && (
                  <span
                    className="pointer-events-none absolute inset-[-2px] z-30"
                    style={{ backgroundImage: 'url(/images/idols/idols-refracted-under.webp)', backgroundSize: '100% 100%' }}
                  />
                )}
                {!suppressCellChrome && <span className="absolute left-1 top-1 text-[10px] text-slate-500">{slot + 1}</span>}


                {isBlockedByFootprint && !isCoveredBySpriteFootprint && !suppressCellChrome && (
                  <span className="absolute right-1 top-1 rounded bg-rose-500/20 px-1 text-[9px] font-semibold uppercase tracking-wide text-rose-200">
                    Blocked
                  </span>
                )}
                {isAnchor && sprite && !isBlockedNode ? (
                  <div
                    className={`pointer-events-none ${
                      placement.size.width > 1 || placement.size.height > 1
                        ? "absolute left-0 top-0 z-20 rounded bg-slate-950/85"
                        : "h-full w-full"
                    }`}
                    style={
                      placement.size.width > 1 || placement.size.height > 1
                        ? {
                            width: `calc(${placement.size.width} * 100% + (${placement.size.width - 1}) * var(--idol-cell-gap))`,
                            height: `calc(${placement.size.height} * 100% + (${placement.size.height - 1}) * var(--idol-cell-gap))`,
                            border: buffsWholePlacement
                              ? "1px solid rgba(103, 232, 249, 0.85)"
                              : "1px solid rgba(125, 211, 252, 0.25)",
                            boxShadow: buffsWholePlacement
                              ? "0 0 0 1px rgba(34,211,238,0.55), 0 0 18px rgba(34,211,238,0.35)"
                              : "none",
                          }
                        : undefined
                    }
                  >
                    <img
                      src={`/images/items/${sprite}`}
                      alt={placement.name}
                      className="h-full w-full object-contain p-1"
                      draggable={false}
                    />
                  </div>
                ) : isAnchor && placement && !isBlockedNode ? (
                  <IdolGlyph
                    idolId={placement.idolId}
                    label={`${placement.size.width}x${placement.size.height}`}
                  />
                ) : isBlockedByFootprint ? (
                  isCoveredBySpriteFootprint ? null : (
                    <div
                      className="absolute inset-0 rounded"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(135deg, rgba(244,63,94,0.25) 0px, rgba(244,63,94,0.25) 6px, rgba(2,6,23,0) 6px, rgba(2,6,23,0) 12px)",
                      }}
                    >
                      <span className="flex h-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-rose-200/90">Taken</span>
                    </div>
                  )
                ) : isBlockedNode ? null : (
                  !suppressCellChrome && <span className="text-xs text-slate-600">{isRefracted ? "Boost" : "Empty"}</span>
                )}
              </button>
            );
          })}
          </div>
        </div>

        {activeAltar && (
          <div className="mt-3 rounded border border-slate-700 bg-slate-950/60 p-2 text-xs">
            <div className="font-semibold text-slate-300">{activeAltar.name} Effects</div>
            {activeAltar.effects.length === 0 ? (
              <div className="mt-1 text-slate-500">No direct altar effects.</div>
            ) : (
              <div className="mt-1 space-y-1">
                {activeAltar.effects.map((effect) => (
                  <div key={`${activeAltar.id}-${effect.propertyId}`} className="text-slate-400">
                    {formatEffectValue(effect.value, effect.operation)} {effect.propertyName}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="min-h-0 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Idol Library</h2>
            <p className="text-xs text-slate-500">Selected cell: {selectedSlot + 1}</p>
          </div>
          <button
            onClick={() => setIdol(selectedSlot, null)}
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            Clear Idol
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search idols"
          className="mb-3 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500"
        />

        {selectedPlacement && (
          <div className="mb-3 rounded border border-amber-700/40 bg-amber-950/20 p-2 text-xs">
            <div className="mb-1 font-semibold text-amber-300">Equipped Idol</div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded border border-amber-500/30 bg-slate-950/70 p-1">
                {getItemSprite(selectedPlacement.idolId) ? (
                  <img
                    src={`/images/items/${getItemSprite(selectedPlacement.idolId)}`}
                    alt={selectedPlacement.name}
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <IdolGlyph idolId={selectedPlacement.idolId} label={`${selectedPlacement.size.width}x${selectedPlacement.size.height}`} compact />
                )}
              </div>
              <div className="text-slate-300">
                {(selectedIdol?.name ?? selectedPlacement?.name)} ({selectedPlacement?.size.width}x{selectedPlacement?.size.height})
              </div>
            </div>
          </div>
        )}

        <div className="max-h-[calc(100%-140px)] space-y-2 overflow-auto pr-1">
          {idolOptions.map((idol) => (
            <button
              key={idol.id}
              onClick={() => setIdol(selectedSlot, idol.id)}
              className={`w-full rounded border p-2 text-left transition-colors ${
                selectedIdolId === idol.id
                  ? "border-amber-500 bg-amber-950/20"
                  : "border-slate-700 bg-slate-950/60 hover:border-slate-500"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded border border-slate-600 bg-slate-900/60 p-1">
                    {getItemSprite(idol.id) ? (
                      <img
                        src={`/images/items/${getItemSprite(idol.id)}`}
                        alt={idol.name}
                        className="h-full w-full object-contain"
                        draggable={false}
                      />
                    ) : (
                      <IdolGlyph idolId={idol.id} label={`${idol.size.width}x${idol.size.height}`} compact />
                    )}
                  </div>
                  <span className="text-sm text-slate-200">{idol.name}</span>
                </div>
                <span className="text-[10px] text-slate-500">{idol.id}</span>
              </div>
              <div className="space-y-0.5 text-xs">
                {idol.modifiers.length === 0 ? (
                  <div className="text-slate-500">No modifiers</div>
                ) : (
                  idol.modifiers.slice(0, 3).map((m, idx) => (
                    <div key={`${idol.id}-mod-${idx}`} className="text-slate-400">
                      {m.operation} {Math.round(m.value * 100) / 100} {statLabel(String(m.targetStat))}
                    </div>
                  ))
                )}
                {idol.modifiers.length > 3 && (
                  <div className="text-slate-500">+{idol.modifiers.length - 3} more modifiers</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
