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
}: {
  builds: SavedBuildEntry[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewBuild: () => void;
  onImportMaxroll: () => void;
}) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="w-full max-w-xl rounded-lg border border-slate-700 bg-slate-900 p-6">
        <h1 className="mb-6 text-center text-2xl font-bold text-amber-400">
          Epoch of Building
        </h1>

        <button
          onClick={onNewBuild}
          className="mb-6 w-full rounded border border-amber-600 bg-amber-700/30 px-4 py-3 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-700/50"
        >
          + New Build
        </button>

        <button
          onClick={onImportMaxroll}
          className="mb-6 w-full rounded border border-purple-600 bg-purple-700/30 px-4 py-3 text-sm font-semibold text-purple-200 transition-colors hover:bg-purple-700/50"
        >
          Import from Maxroll
        </button>

        {builds.length === 0 ? (
          <p className="text-center text-sm italic text-slate-500">
            No saved builds yet. Create one to get started!
          </p>
        ) : (
          <div className="space-y-2">
            <h2 className="mb-2 text-xs font-semibold uppercase text-slate-500">
              Saved Builds
            </h2>
            {builds.map((b) => (
              <div
                key={b.id}
                className="group flex items-center justify-between rounded border border-slate-700 bg-slate-800 px-4 py-3 transition-colors hover:border-slate-500"
              >
                <button
                  onClick={() => onSelect(b.id)}
                  className="flex-1 text-left"
                >
                  <div className="text-sm font-medium text-slate-200">
                    {b.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {CLASS_NAMES[b.classId] ?? b.classId}
                    {b.masteryId && ` → ${MASTERY_NAMES[b.masteryId] ?? b.masteryId}`}
                    {" · "}
                    {new Date(b.updatedAt).toLocaleDateString()}
                  </div>
                </button>
                <button
                  onClick={() => onDelete(b.id)}
                  className="ml-3 rounded px-2 py-1 text-xs text-slate-500 opacity-0 transition-opacity hover:bg-red-900/30 hover:text-red-400 group-hover:opacity-100"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
