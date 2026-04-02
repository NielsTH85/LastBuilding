import { getImportedClasses } from "@eob/game-data";

const CLASS_STYLES: Record<string, { color: string; borderColor: string; bgColor: string; hoverBg: string }> = {
  primalist: { color: "text-green-300", borderColor: "border-green-500", bgColor: "bg-green-900/20", hoverBg: "hover:bg-green-900/40" },
  mage: { color: "text-blue-300", borderColor: "border-blue-500", bgColor: "bg-blue-900/20", hoverBg: "hover:bg-blue-900/40" },
  sentinel: { color: "text-yellow-300", borderColor: "border-yellow-500", bgColor: "bg-yellow-900/20", hoverBg: "hover:bg-yellow-900/40" },
  acolyte: { color: "text-purple-300", borderColor: "border-purple-500", bgColor: "bg-purple-900/20", hoverBg: "hover:bg-purple-900/40" },
  rogue: { color: "text-red-300", borderColor: "border-red-500", bgColor: "bg-red-900/20", hoverBg: "hover:bg-red-900/40" },
};

const DEFAULT_STYLE = { color: "text-slate-300", borderColor: "border-slate-500", bgColor: "bg-slate-900/20", hoverBg: "hover:bg-slate-900/40" };

const CLASSES = getImportedClasses();

export default function ClassSelect({
  onSelect,
  onBack,
}: {
  onSelect: (classId: string, masteryId?: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-amber-400">Choose a Class</h1>
          <button
            onClick={onBack}
            className="rounded px-3 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            ← Back
          </button>
        </div>

        <div className="space-y-3">
          {CLASSES.map((cls) => {
            const style = CLASS_STYLES[cls.id] ?? DEFAULT_STYLE;
            return (
            <div key={cls.id}>
              <button
                onClick={() => onSelect(cls.id)}
                className={`w-full rounded border ${style.borderColor} ${style.bgColor} ${style.hoverBg} px-4 py-3 text-left transition-colors`}
              >
                <div className={`text-lg font-semibold ${style.color}`}>
                  {cls.name}
                </div>
                <div className="text-xs text-slate-500">
                  Masteries: {cls.masteries.map((m) => m.name).join(", ")}
                </div>
              </button>

              {/* Mastery sub-buttons */}
              <div className="mt-1 ml-4 space-y-1">
                {cls.masteries.map((mastery) => (
                  <button
                    key={mastery.id}
                    onClick={() => onSelect(cls.id, mastery.id)}
                    className="w-full rounded border border-slate-700 bg-slate-800 px-4 py-2 text-left text-sm text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
                  >
                    {mastery.name}
                  </button>
                ))}
              </div>
            </div>
          );
          })}
        </div>

      </div>
    </div>
  );
}
