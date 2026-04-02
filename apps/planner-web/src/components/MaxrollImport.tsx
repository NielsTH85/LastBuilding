import { useState } from "react";
import {
  parseMaxrollUrl,
  convertMaxrollBuild,
  MAXROLL_API_URL,
  type MaxrollApiResponse,
  type ImportedBuild,
} from "@eob/game-data";

export default function MaxrollImport({
  onImport,
  onCancel,
}: {
  onImport: (build: ImportedBuild, name: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<{ name: string; build: ImportedBuild }[] | null>(null);
  const [buildName, setBuildName] = useState("");

  async function handleFetch() {
    setError(null);
    const parsed = parseMaxrollUrl(url);
    if (!parsed) {
      setError("Invalid maxroll URL or build ID.");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${MAXROLL_API_URL}/${parsed.id}`, {
        headers: {
          Accept: "application/json",
          Origin: "https://maxroll.gg",
        },
      });
      if (!resp.ok) throw new Error(`API returned ${resp.status}`);
      const data: MaxrollApiResponse = await resp.json();
      const result = convertMaxrollBuild(data);

      setBuildName(result.buildName);
      setProfiles(result.profiles);

      // If URL has a fragment, auto-select that profile
      if (parsed.profileIndex < result.profiles.length && result.profiles.length > 1) {
        // Don't auto-import, just highlight but let user choose
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch build.");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectProfile(idx: number) {
    if (!profiles) return;
    const profile = profiles[idx];
    if (!profile) return;
    onImport(profile.build, `${buildName} - ${profile.name}`);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="w-full max-w-xl rounded-lg border border-slate-700 bg-slate-900 p-6">
        <h2 className="mb-4 text-xl font-bold text-amber-400">Import from Maxroll</h2>

        {/* URL input */}
        <div className="mb-4">
          <label className="mb-1 block text-xs text-slate-400">
            Paste a maxroll.gg planner link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              placeholder="https://maxroll.gg/last-epoch/planner/295tdl0o#2"
              className="flex-1 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              disabled={loading}
            />
            <button
              onClick={handleFetch}
              disabled={loading || !url.trim()}
              className="rounded border border-amber-600 bg-amber-700/30 px-4 py-2 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-700/50 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Fetch"}
            </button>
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {/* Profile list */}
        {profiles && (
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-300">
              {buildName} — Select a profile to import:
            </h3>
            <div className="space-y-2">
              {profiles.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectProfile(i)}
                  className="w-full rounded border border-slate-600 bg-slate-800 px-4 py-3 text-left transition-colors hover:border-amber-500"
                >
                  <div className="text-sm font-medium text-slate-200">{p.name}</div>
                  <div className="text-xs text-slate-500">
                    {p.build.classId}
                    {p.build.masteryId && ` → ${p.build.masteryId}`}
                    {" · Level "}
                    {p.build.level}
                    {" · "}
                    {p.build.passives.length} passive nodes
                    {" · "}
                    {p.build.skills.length} skills
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onCancel}
          className="w-full rounded border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-400 hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
