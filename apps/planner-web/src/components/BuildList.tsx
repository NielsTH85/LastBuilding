import type { SavedBuildEntry } from "../store/buildStorage";

const CLASS_NAMES: Record<string, string> = {
  mage: "Mage",
};

const MASTERY_NAMES: Record<string, string> = {
  runemaster: "Runemaster",
};

export default function BuildList({
  builds,
  onSelect,
  onDelete,
  onNewBuild,
  onImportMaxroll,
  updateChecking,
  updateAvailable,
  updateLabel,
  onCheckUpdates,
  onInstallUpdate,
}: {
  builds: SavedBuildEntry[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewBuild: () => void;
  onImportMaxroll: () => void;
  updateChecking: boolean;
  updateAvailable: boolean;
  updateLabel: string;
  onCheckUpdates: () => void;
  onInstallUpdate: () => void;
}) {
  return (
    <div className="le-screen">
      <div className="le-screen-overlay flex min-h-screen items-center justify-center px-4">
      <div className="le-card w-full max-w-xl rounded-lg p-6">
        <h1 className="le-title mb-6 text-center text-2xl font-bold text-amber-200">Last Building</h1>

        <button
          onClick={onNewBuild}
          className="le-button mb-6 w-full rounded px-4 py-3 text-sm font-semibold transition-colors"
        >
          + New Build
        </button>

        <button
          onClick={onImportMaxroll}
          className="le-button-arcane mb-6 w-full rounded px-4 py-3 text-sm font-semibold transition-colors"
        >
          Import from Maxroll
        </button>

        <div className="mb-4 flex items-center justify-between gap-2 rounded border border-slate-700/70 bg-slate-900/50 px-3 py-2">
          <div className="text-xs text-slate-400">{updateLabel}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCheckUpdates}
              disabled={updateChecking}
              className="le-button-ghost rounded px-2 py-1 text-xs disabled:opacity-50"
            >
              {updateChecking ? "Checking..." : "Check"}
            </button>
            {updateAvailable && (
              <button
                onClick={onInstallUpdate}
                className="le-button rounded px-2 py-1 text-xs"
              >
                Update
              </button>
            )}
          </div>
        </div>

        {builds.length === 0 ? (
          <p className="text-center text-sm italic text-slate-500">
            No saved builds yet. Create one to get started!
          </p>
        ) : (
          <div className="space-y-2">
            <h2 className="le-title mb-2 text-xs font-semibold uppercase text-slate-400">Saved Builds</h2>
            {builds.map((b) => (
              <div
                key={b.id}
                className="le-row group flex items-center justify-between rounded border border-slate-700/70 bg-slate-800/60 px-4 py-3 transition-colors hover:border-amber-300/35"
              >
                <button onClick={() => onSelect(b.id)} className="flex-1 text-left">
                  <div className="text-sm font-medium text-slate-100">{b.name}</div>
                  <div className="text-xs text-slate-400">
                    {CLASS_NAMES[b.classId] ?? b.classId}
                    {b.masteryId && ` → ${MASTERY_NAMES[b.masteryId] ?? b.masteryId}`}
                    {" · "}
                    {new Date(b.updatedAt).toLocaleDateString()}
                  </div>
                </button>
                <button
                  onClick={() => onDelete(b.id)}
                  className="ml-3 rounded px-2 py-1 text-xs text-slate-500 opacity-0 transition-opacity hover:bg-red-900/30 hover:text-red-300 group-hover:opacity-100"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 border-t border-slate-700/60 pt-3 text-center text-xs text-slate-500">
          Made by Nieroth,
          <a
            href="https://github.com/NielsTH85/LastBuilding"
            target="_blank"
            rel="noreferrer"
            className="ml-1 text-amber-300/90 hover:text-amber-200"
          >
            https://github.com/NielsTH85/LastBuilding
          </a>
          <div className="mt-1 text-[10px] text-slate-600">Release marker: 0.3.4</div>
        </div>
      </div>
      </div>
    </div>
  );
}
